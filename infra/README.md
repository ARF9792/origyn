# infra — Deployment Notes

## Status

Infrastructure-as-code setup is pending AWS CLI installation and credential configuration.

## Planned approach

Lambda functions will be deployed using **AWS SAM** (Serverless Application Model) or manually via the AWS Console for Day 1 speed.

## Required AWS resources

| Resource | Purpose |
|---|---|
| S3 Bucket | Store uploaded PDFs |
| DynamoDB Table: Documents | Document records |
| DynamoDB Table: Claims | Extracted claims (optional Day 1) |
| Lambda functions | Handler compute |
| API Gateway (HTTP API) | HTTP routing to Lambdas |

## Pre-deployment checklist

- [ ] AWS CLI installed (`aws --version`)
- [ ] AWS credentials configured (`aws configure`)
- [ ] S3 bucket created — set `S3_BUCKET_NAME` in Lambda env
- [ ] DynamoDB Documents table created — set `DYNAMODB_DOCUMENTS_TABLE`
- [ ] DynamoDB Claims table created — set `DYNAMODB_CLAIMS_TABLE`
- [ ] Lambda functions created and code deployed
- [ ] API Gateway routes configured
- [ ] CORS configured on API Gateway

## DynamoDB Documents table schema

| Attribute | Type | Key |
|---|---|---|
| `id` | String | Partition key |
| `createdAt` | String | — |

## Security

- No credentials in code or Git.
- Lambda execution role must have permissions for S3 (PutObject, GetObject) and DynamoDB (PutItem, GetItem, Scan).
- Bedrock access requires `bedrock:InvokeModel` in the execution role.
