# FIAP SOAT Tech Challenge — Lambda Authorizer

## Visão geral

Este repositório provisiona um **API Gateway HTTP v2 com Lambda Authorizer** que protege as rotas `/customer/*` do backend EC2 do projeto FIAP SOAT Tech Challenge.

**Fluxo de autenticação:**

1. Cliente envia request com header `x-document: <CPF>` para o API Gateway HTTP v2.
2. API Gateway invoca o Lambda Authorizer (`handler.handler`) para validar a requisição.
3. Lambda valida o formato do CPF via regex, depois busca o usuário no RDS PostgreSQL via `pg`.
4. Se válido: retorna `isAuthorized: true` e inclui o JWT gerado no contexto da resposta.
5. API Gateway encaminha a requisição ao backend EC2 via VPC Link (HTTP_PROXY).
6. Backend EC2 lê o JWT do contexto e responde ao cliente.

> Rotas `/admin/*` e `/health` são encaminhadas sem authorizer.

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime Lambda | Node.js 22.x |
| Linguagem | TypeScript 5.x |
| Cliente PostgreSQL | `pg` |
| JWT | `jsonwebtoken` |
| Testes | Jest 29 |
| Build CI | Node.js 18 (**TODO**: alinhar com runtime 22.x) |
| Infra | Terraform >= 1.0, AWS Provider ~> 5.0 |

## Estrutura do projeto

```
src/
  handler.ts       # Lambda entrypoint (API Gateway Authorizer v2)
  auth/            # Geração de JWT
  database/        # User repository (pg pool)
  validators/      # Validação de CPF
  config/          # Carregamento de variáveis de ambiente
terraform/
  main.tf          # Lambda + API Gateway + Authorizer + VPC Link + SG
  variables.tf     # Variáveis de entrada
  outputs.tf       # Outputs exportados
  backend.tf       # Backend S3 (bucket injetado via -backend-config)
.github/workflows/
  ci.yml           # Lint + testes + build do zip
  deploy.yml       # Build + terraform init/apply
docs/
  lambda-flow.mmd  # Diagrama mermaid do fluxo de autenticação
```

## Dependências entre repos

A ordem de criação é: **infra-k8s → infra-db → lambda**.

O Lambda lê remote state de ambos os repos anteriores:

| Remote state | Outputs consumidos |
|---|---|
| `infra-k8s` | `vpc_id`, `private_subnet_ids`, `eks_cluster_security_group_id` |
| `infra-db` | `rds_address`, `rds_port`, `rds_database_name` |

O backend EC2 é descoberto via data source `aws_instance` pela tag `Name=fiap-soat-dev-backend`.

## Variáveis de ambiente (runtime Lambda)

As variáveis abaixo são injetadas pelo Terraform no bloco `environment` da função Lambda. Em testes locais, podem ser carregadas via `.env` (usar `.env.sample` como base).

| Variável | Descrição |
|---|---|
| `DB_HOST` | Endereço do RDS (lido do remote state de infra-db) |
| `DB_PORT` | Porta do RDS (lido do remote state de infra-db) |
| `DB_NAME` | Nome do banco de dados (lido do remote state de infra-db) |
| `DB_USER` | Usuário do banco (passado via `TF_VAR_db_user`) |
| `DB_PASSWORD` | Senha do banco (passada via `TF_VAR_db_password`) |
| `JWT_SECRET` | Segredo HMAC para assinar tokens (passado via `TF_VAR_jwt_secret`) |
| `JWT_EXPIRES_IN` | TTL do token (ex: `24h`) — passado via `TF_VAR_jwt_expires_in` |

## Variáveis Terraform

| Variável | Tipo | Default | Sensitive | Descrição |
|---|---|---|---|---|
| `project_name` | string | `fiap-soat` | não | Prefixo usado nos nomes dos recursos |
| `environment` | string | `dev` | não | Ambiente de deploy |
| `aws_region` | string | `us-east-1` | não | Região AWS |
| `lambda_role_arn` | string | — | não | ARN da IAM role do Lambda (no Academy: `arn:aws:iam::<acct>:role/LabRole`) |
| `lambda_zip_path` | string | `../dist/lambda.zip` | não | Caminho do artifact gerado por `npm run package` |
| `db_user` | string | — | sim | Usuário master do PostgreSQL |
| `db_password` | string | — | sim | Senha master do PostgreSQL |
| `jwt_secret` | string | — | sim | Segredo HMAC para assinar JWTs |
| `jwt_expires_in` | string | — | não | TTL do token JWT (ex: `24h`, `7d`) |
| `backend_port` | number | `3000` | não | Porta do backend EC2 |

## Outputs Terraform

| Output | Descrição |
|---|---|
| `lambda_function_name` | Nome da função Lambda criada |
| `lambda_function_arn` | ARN da função Lambda |
| `api_gateway_url` | URL base do API Gateway HTTP v2 |
| `authorizer_id` | ID do Lambda Authorizer (anexado às rotas `/customer/*`) |

## Desenvolvimento local

```bash
cp .env.sample .env
# editar .env com credenciais locais (ex: PostgreSQL via docker-compose)
npm install
npm test
npm run build
npm run package   # gera dist/lambda.zip
```

## GitHub Actions

### `ci.yml`

Roda em todo push e PR: instala dependências (Node 18), executa testes Jest e gera o artifact `dist/lambda.zip`.

### `deploy.yml`

Disparado em push para `main` ou manualmente via `workflow_dispatch`. Sequência: build → package → configure AWS credentials → terraform init (backend parametrizado) → terraform apply.

### Secrets e variáveis necessários

| Nome | Tipo | Descrição |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | secret | Chave de acesso AWS Academy |
| `AWS_SECRET_ACCESS_KEY` | secret | Chave secreta AWS Academy |
| `AWS_SESSION_TOKEN` | secret | Token de sessão temporária AWS Academy |
| `DB_USER` | secret | Usuário do banco — passado como `TF_VAR_db_user` |
| `DB_PASSWORD` | secret | Senha do banco — passada como `TF_VAR_db_password` |
| `JWT_SECRET` | secret | Segredo JWT — passado como `TF_VAR_jwt_secret` |
| `TF_STATE_BUCKET` | var | Nome do bucket S3 de state (ex: `fiap-soat-backend-430891654117`) |
| `JWT_EXPIRES_IN` | var | TTL do token (default `24h`) — passado como `TF_VAR_jwt_expires_in` |

## Como deployar manualmente

### Pré-requisitos

- Node.js 18+, npm
- Terraform >= 1.0
- AWS CLI configurado com credenciais válidas
- Bucket S3 de state pré-existente (criar com `aws s3 mb s3://fiap-soat-backend-<ACCOUNT_ID> --region us-east-1`)
- `infra-k8s` e `infra-db` já aplicados (remote state disponível)

### Passos

```bash
npm run build && npm run package   # gera dist/lambda.zip

cd terraform

export TF_STATE_BUCKET=fiap-soat-backend-<ACCOUNT_ID>

terraform init \
  -backend-config="bucket=$TF_STATE_BUCKET" \
  -backend-config="key=lambda/terraform.tfstate" \
  -backend-config="region=us-east-1"

terraform apply -var-file=terraform.tfvars
```

> O arquivo `terraform.tfvars` deve conter `lambda_role_arn`, `db_user`, `db_password`, `jwt_secret`, `jwt_expires_in`. Nunca commitar esse arquivo com credenciais reais.

## Como testar end-to-end

```bash
API_URL=$(terraform output -raw api_gateway_url)

# Request sem header (deve retornar 401 - Unauthorized)
curl -i $API_URL/customer/orders

# Request com CPF válido no header
curl -i -H "x-document: 12345678909" $API_URL/customer/orders

# Verificar logs da função Lambda
aws logs tail /aws/lambda/fiap-soat-dev-auth --follow --region us-east-1
```

## Como destruir

A ordem correta de destruição é: **app → lambda → infra-db → infra-k8s**.

```bash
cd terraform
terraform destroy -auto-approve
```

> Lambda e API Gateway HTTP são praticamente gratuitos em idle (~$0 sem requests). O VPC Link cobra ~$0.01/hora enquanto existir — destruir entre as sessões do AWS Academy.

## Troubleshooting

| Problema | Causa provável | Solução |
|---|---|---|
| `InvalidS3Bucket` no `terraform init` | Bucket de state não existe | Criar o bucket: `aws s3 mb s3://$TF_STATE_BUCKET --region us-east-1` |
| Lambda timeout ao conectar no RDS | Security Group incorreto | Verificar que o SG do Lambda tem egress para o SG do RDS na porta 5432 |
| Authorizer retorna 500 | Erro no código do Lambda | Ver logs: `aws logs tail /aws/lambda/fiap-soat-dev-auth --region us-east-1` |
| `jwt_expires_in` vazio no apply | Var não definida em CI | Garantir que `vars.JWT_EXPIRES_IN` está configurada no GitHub (default `24h`) |
| Node 18 (CI) vs 22.x (runtime) | Versões desalinhadas | TODO: atualizar `ci.yml` para usar Node 22 |
