output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.auth.function_name
}

output "lambda_function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.auth.arn
}

output "api_gateway_url" {
  description = "API Gateway URL"
  value       = aws_apigatewayv2_api.auth.api_endpoint
}

output "authorizer_id" {
  description = "Lambda authorizer ID attached to /customer/* routes"
  value       = aws_apigatewayv2_authorizer.lambda.id
}
