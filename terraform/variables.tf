variable "project_name" {
  description = "Project name"
  type        = string
  default     = "fiap-soat"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "lambda_role_arn" {
  description = "ARN of the IAM role for Lambda"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "lambda_zip_path" {
  description = "Path to the Lambda deployment package"
  type        = string
  default     = "../dist/lambda.zip"
}

variable "db_user" {
  description = "Database user"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret key"
  type        = string
  sensitive   = true
}

variable "jwt_expires_in" {
  description = "JWT expiration time"
  type        = string
}

variable "backend_port" {
  description = "Port the EC2 Node.js backend listens on"
  type        = number
  default     = 3000
}

variable "terraform_state_bucket" {
  description = "S3 bucket for Terraform state"
  type        = string
}
