terraform {
  backend "s3" {
    bucket = "fiap-soat-backend-bucket"
    key    = "lambda/terraform.tfstate"
    region = "us-east-1"
  }
}