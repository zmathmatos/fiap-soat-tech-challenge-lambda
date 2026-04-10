terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "fiap-soat-terraform-state-283756756385"
    key    = "lambda/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

data "terraform_remote_state" "infra_k8s" {
  backend = "s3"
  config = {
    bucket = "fiap-soat-terraform-state-283756756385"
    key    = "infra-k8s/terraform.tfstate"
    region = "us-east-1"
  }
}

data "terraform_remote_state" "infra_db" {
  backend = "s3"
  config = {
    bucket = "fiap-soat-terraform-state-283756756385"
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

# IAM Role for Lambda
data "aws_iam_role" "lab_role" {
  name = "LabRole"
}

# Lambda function
resource "aws_lambda_function" "auth" {
  filename         = var.lambda_zip_path
  function_name    = "${var.project_name}-${var.environment}-auth"
  role             = data.aws_iam_role.lab_role.arn
  handler          = "handler.handler"
  runtime          = "nodejs18.x"
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

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.auth.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
    })
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_integration" "auth" {
  api_id                 = aws_apigatewayv2_api.auth.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.auth.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "auth" {
  api_id    = aws_apigatewayv2_api.auth.id
  route_key = "POST /auth"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.auth.execution_arn}/*/*"
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${aws_lambda_function.auth.function_name}"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${aws_apigatewayv2_api.auth.name}"
  retention_in_days = 14
  tags              = local.common_tags
}
