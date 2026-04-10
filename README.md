# FIAP SOAT Tech Challenge - Lambda Autenticação CPF

Lambda Serverless para autenticação via CPF, usando API Gateway + AWS Lambda.

## Fluxo

1. Cliente envia POST /auth com `{ "cpf": "12345678901" }`
2. Lambda valida formato do CPF
3. Busca usuário no RDS PostgreSQL pelo campo document
4. Gera JWT token com mesmo formato do monolito
5. Retorna `{ token, user }` 

## Desenvolvimento

```bash
npm install
npm test
npm run build
```

## Deploy

```bash
npm run build
cd dist && zip -r lambda.zip . && cd ..
cd terraform
terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

## Dependências

- **infra-k8s**: VPC e subnets privadas (Lambda é deployed na VPC)
- **infra-db**: Endpoint do RDS PostgreSQL
