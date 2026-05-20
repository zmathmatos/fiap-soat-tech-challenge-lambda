terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "terraform_remote_state" "infra_k8s" {
  backend = "s3"
  config = {
    bucket = "fiap-soat-terraform-state-bucket"
    key    = "infra-k8s/terraform.tfstate"
    region = "us-east-1"
  }
}

data "terraform_remote_state" "infra_db" {
  backend = "s3"
  config = {
    bucket = "fiap-soat-terraform-state-bucket"
    key    = "infra-db/terraform.tfstate"
    region = "us-east-1"
  }
}

locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

data "aws_instance" "backend" {
  filter {
    name   = "tag:Name"
    values = ["fiap-soat-dev-backend"]
  }

  filter {
    name   = "instance-state-name"
    values = ["running"]
  }
}

# Lambda function
resource "aws_lambda_function" "auth" {
  filename         = var.lambda_zip_path
  function_name    = "${var.project_name}-${var.environment}-auth"
  role             = var.lambda_role_arn
  handler          = "handler.handler"
  runtime          = "nodejs22.x"
  timeout          = 30
  memory_size      = 256
  source_code_hash = filebase64sha256(var.lambda_zip_path)

  vpc_config {
    subnet_ids         = data.terraform_remote_state.infra_k8s.outputs.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DB_HOST        = data.terraform_remote_state.infra_db.outputs.rds_address
      DB_PORT        = tostring(data.terraform_remote_state.infra_db.outputs.rds_port)
      DB_NAME        = data.terraform_remote_state.infra_db.outputs.rds_database_name
      DB_USER        = var.db_user
      DB_PASSWORD    = var.db_password
      JWT_SECRET     = var.jwt_secret
      JWT_EXPIRES_IN = var.jwt_expires_in
    }
  }

  tags = local.common_tags
}

# Security Group for Lambda (to access RDS)
resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-${var.environment}-lambda-sg"
  description = "Security group for Lambda function"
  vpc_id      = data.terraform_remote_state.infra_k8s.outputs.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${var.project_name}-${var.environment}-lambda-sg" })
}

# API Gateway
resource "aws_apigatewayv2_api" "auth" {
  name          = "${var.project_name}-${var.environment}-auth-api"
  protocol_type = "HTTP"
  tags          = local.common_tags
}

# The deployment stage
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.auth.id
  name        = "$default"
  # `auto_deploy = true` means any route change is deployed automatically without a manual deploy step
  auto_deploy = true

  tags = local.common_tags
}

# VPC Link allows API Gateway to reach private resources inside the VPC
resource "aws_apigatewayv2_vpc_link" "backend" {
  name               = "${var.project_name}-${var.environment}-vpc-link"
  subnet_ids         = data.terraform_remote_state.infra_k8s.outputs.private_subnet_ids
  security_group_ids = [aws_security_group.lambda.id]
  tags               = local.common_tags
}

# Lambda authorizer — validates the x-document header for all /customer/* routes
resource "aws_apigatewayv2_authorizer" "lambda" {
  api_id                            = aws_apigatewayv2_api.auth.id
  authorizer_type                   = "REQUEST"
  authorizer_uri                    = aws_lambda_function.auth.invoke_arn
  identity_sources                  = ["$request.header.x-document"]
  name                              = "${var.project_name}-${var.environment}-authorizer"
  authorizer_payload_format_version = "2.0"
  enable_simple_responses           = true
}

# This connects the API Gateway to the EC2 backend via VPC Link
resource "aws_apigatewayv2_integration" "backend" {
  api_id             = aws_apigatewayv2_api.auth.id
  integration_type   = "HTTP_PROXY"
  integration_uri    = "http://${data.aws_instance.backend.private_ip}:${var.backend_port}/{proxy}"
  integration_method = "ANY"
  connection_type    = "VPC_LINK"
  connection_id      = aws_apigatewayv2_vpc_link.backend.id
}

# /customer/* routes are protected by the Lambda authorizer; traffic is forwarded to the EC2 backend
resource "aws_apigatewayv2_route" "customer_routes" {
  api_id             = aws_apigatewayv2_api.auth.id
  route_key          = "ANY /customer/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.backend.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.lambda.id
  authorization_type = "CUSTOM"
}

resource "aws_apigatewayv2_route" "admin_routes" {
  api_id    = aws_apigatewayv2_api.auth.id
  route_key = "ANY /admin/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.backend.id}"
}

resource "aws_apigatewayv2_route" "health_route" {
  api_id    = aws_apigatewayv2_api.auth.id
  route_key = "ANY /health"
  target    = "integrations/${aws_apigatewayv2_integration.backend.id}"
}

# AWS requires an explicit permission for API Gateway to call Lambda.
# Without this, the invocation would be denied even if everything else is wired up correctly.
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.auth.execution_arn}/*/*"
}
