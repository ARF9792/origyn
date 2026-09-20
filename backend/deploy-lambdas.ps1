#!/usr/bin/env pwsh
# deploy-lambdas.ps1
# Creates 5 Lambda functions from origyn-backend.zip
# Run from backend/ directory after packaging.

$AWS   = "C:\Users\am\AppData\Local\Programs\Amazon\AWSCLIV2\aws.exe"
$ROLE  = "arn:aws:iam::135977257539:role/origyn-lambda-role"
$ZIP   = "fileb://origyn-backend.zip"
$RT    = "nodejs20.x"
$MEM   = 512   # MB
$TO    = 30    # seconds (Crossref call may take a few seconds)

$ENV_VARS = "Variables={S3_BUCKET_NAME=origyn-documents-135977257539,DYNAMODB_DOCUMENTS_TABLE=origyn-documents,DYNAMODB_CLAIMS_TABLE=origyn-claims,DYNAMODB_ANSWERS_TABLE=origyn-answers,CROSSREF_CONTACT_EMAIL=parthmalhotra905@gmail.com,CROSSREF_BASE_URL=https://api.crossref.org,BEDROCK_MODEL_ID=us.anthropic.claude-3-haiku-20240307-v1:0}"

function Create-Lambda {
    param($Name, $Handler)
    Write-Host "`n>>> Creating Lambda: $Name" -ForegroundColor Cyan
    & $AWS lambda create-function `
        --function-name $Name `
        --runtime $RT `
        --role $ROLE `
        --handler $Handler `
        --zip-file $ZIP `
        --memory-size $MEM `
        --timeout $TO `
        --environment $ENV_VARS `
        --no-cli-pager
    if ($LASTEXITCODE -ne 0) { Write-Error "FAILED: $Name"; exit 1 }
    Write-Host "OK: $Name" -ForegroundColor Green
}

Create-Lambda "origyn-health"          "handlers/health.handler"
Create-Lambda "origyn-uploadDocument"  "handlers/uploadDocument.handler"
Create-Lambda "origyn-getDocuments"    "handlers/getDocuments.handler"
Create-Lambda "origyn-getDocument"     "handlers/getDocument.handler"
Create-Lambda "origyn-getGraph"        "handlers/getGraph.handler"
Create-Lambda "origyn-deleteDocument"  "handlers/deleteDocument.handler"
Create-Lambda "origyn-getDocumentUrl"  "handlers/getDocumentUrl.handler"

Write-Host "`nAll Lambda functions created." -ForegroundColor Green
