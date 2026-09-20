#!/usr/bin/env pwsh
$AWS = "C:\Users\am\AppData\Local\Programs\Amazon\AWSCLIV2\aws.exe"
$REGION = "us-east-1"
$ACCOUNT_ID = "015524245486"

Write-Host "=== Creating Origyn DynamoDB Tables ===" -ForegroundColor Cyan

$TABLES = @("origyn-documents", "origyn-claims", "origyn-answers")

foreach ($table in $TABLES) {
    Write-Host "`n>>> Creating $table..." -ForegroundColor Yellow
    
    # Check if table exists
    $exists = & $AWS dynamodb describe-table --table-name $table --region $REGION --no-cli-pager 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Table $table already exists. Skipping creation." -ForegroundColor Gray
        continue
    }

    # Create table with id as Partition Key and ownerId-index as Global Secondary Index
    $GSI_SCHEMA = '[{"IndexName": "ownerId-index","KeySchema":[{"AttributeName":"ownerId","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}]'
    
    & $AWS dynamodb create-table `
        --table-name $table `
        --attribute-definitions AttributeName=id,AttributeType=S AttributeName=ownerId,AttributeType=S `
        --key-schema AttributeName=id,KeyType=HASH `
        --global-secondary-indexes $GSI_SCHEMA `
        --billing-mode PAY_PER_REQUEST `
        --region $REGION `
        --no-cli-pager
        
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Table $table created successfully" -ForegroundColor Green
    } else {
        Write-Error "Failed to create table $table"
    }
}

Write-Host "`nAll tables created." -ForegroundColor Green
