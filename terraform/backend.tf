terraform {
  backend "s3" {
    key    = "lambda/terraform.tfstate"
    region = "us-east-1"
  }
}