#!/usr/bin/env pwsh
# create-api-v2.ps1
# Creates a new HTTP API Gateway for the single-account Origyn deployment.
# All 13 routes mapped to their Lambda functions.
# Run AFTER Lambda deployment is complete.

param(
    [string]$AccountId = "015524245486",
    [string]$Region = "us-east-1"
)

$AWS = "C:\Users\am\AppData\Local\Programs\Amazon\AWSCLIV2\aws.exe"

Write-Host "=== Creating Origyn HTTP API ===" -ForegroundColor Cyan

$API_JSON = & $AWS apigatewayv2 create-api `
    --name "origyn-api" `
    --protocol-type HTTP `
    --cors-configuration "AllowOrigins=*,AllowMethods=GET,POST,DELETE,OPTIONS,AllowHeaders=Content-Type,Authorization,X-Requested-With,x-origyn-workspace-id" `
    --region $Region `
    --no-cli-pager `
    --output json

if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create API"; exit 1 }

$API = $API_JSON | ConvertFrom-Json
$API_ID = $API.ApiId
Write-Host "API ID: $API_ID" -ForegroundColor Green

# ── Integration factory ───────────────────────────────────────────────────────
function Add-Integration {
    param($FunctionName)
    $ARN = "arn:aws:lambda:${Region}:${AccountId}:function:$FunctionName"
    $URI = "arn:aws:apigateway:${Region}:lambda:path/2015-03-31/functions/${ARN}/invocations"
    $result = & $AWS apigatewayv2 create-integration `
        --api-id $API_ID `
        --integration-type AWS_PROXY `
        --integration-uri $URI `
        --payload-format-version "2.0" `
        --region $Region `
        --no-cli-pager `
        --output json | ConvertFrom-Json
    return $result.IntegrationId
}

# ── Route factory ─────────────────────────────────────────────────────────────
function Add-Route {
    param($Method, $Path, $IntId)
    & $AWS apigatewayv2 create-route `
        --api-id $API_ID `
        --route-key "$Method $Path" `
        --target "integrations/$IntId" `
        --region $Region `
        --no-cli-pager | Out-Null
    Write-Host "  $Method $Path" -ForegroundColor Gray
}

Write-Host "`n>>> Creating integrations..." -ForegroundColor Cyan

$INT_HEALTH   = Add-Integration "origyn-health"
$INT_UPLOAD   = Add-Integration "origyn-uploadDocument"
$INT_LIST     = Add-Integration "origyn-getDocuments"
$INT_DETAIL   = Add-Integration "origyn-getDocument"
$INT_GRAPH    = Add-Integration "origyn-getGraph"
$INT_ANSWERS  = Add-Integration "origyn-getAnswers"
$INT_ANSWER   = Add-Integration "origyn-getAnswer"
$INT_EXTRACT  = Add-Integration "origyn-extractClaims"
$INT_CHAT     = Add-Integration "origyn-chat"
$INT_REGEN    = Add-Integration "origyn-regenerateAnswer"
$INT_RECHECK  = Add-Integration "origyn-recheckDocument"
$INT_INVALID  = Add-Integration "origyn-invalidateDocument"
$INT_IMPACT   = Add-Integration "origyn-getDocumentImpact"

Write-Host "`n>>> Creating routes..." -ForegroundColor Cyan

Add-Route "GET"  "/health"                          $INT_HEALTH
Add-Route "POST" "/documents"                       $INT_UPLOAD
Add-Route "GET"  "/documents"                       $INT_LIST
Add-Route "GET"  "/documents/{id}"                  $INT_DETAIL
Add-Route "POST" "/documents/{id}/claims/extract"   $INT_EXTRACT
Add-Route "POST" "/documents/{id}/recheck"          $INT_RECHECK
Add-Route "POST" "/documents/{id}/invalidate"       $INT_INVALID
Add-Route "GET"  "/documents/{id}/impact"           $INT_IMPACT
Add-Route "GET"  "/graph"                           $INT_GRAPH
Add-Route "GET"  "/answers"                         $INT_ANSWERS
Add-Route "GET"  "/answers/{id}"                    $INT_ANSWER
Add-Route "POST" "/chat"                            $INT_CHAT
Add-Route "POST" "/answers/{id}/regenerate"         $INT_REGEN

# ── Deploy stage ──────────────────────────────────────────────────────────────
Write-Host "`n>>> Deploying to `$default stage..." -ForegroundColor Cyan
& $AWS apigatewayv2 create-stage `
    --api-id $API_ID `
    --stage-name '$default' `
    --auto-deploy `
    --region $Region `
    --no-cli-pager | Out-Null

# ── Lambda invoke permissions ─────────────────────────────────────────────────
Write-Host "`n>>> Granting Lambda invoke permissions..." -ForegroundColor Cyan

$FUNCTIONS = @(
    "origyn-health", "origyn-uploadDocument", "origyn-getDocuments",
    "origyn-getDocument", "origyn-getGraph", "origyn-getAnswers",
    "origyn-getAnswer", "origyn-extractClaims", "origyn-chat",
    "origyn-regenerateAnswer", "origyn-recheckDocument",
    "origyn-invalidateDocument", "origyn-getDocumentImpact"
)

foreach ($F in $FUNCTIONS) {
    & $AWS lambda add-permission `
        --function-name $F `
        --statement-id "allow-apigw-$(Get-Random -Maximum 9999)" `
        --action lambda:InvokeFunction `
        --principal apigateway.amazonaws.com `
        --source-arn "arn:aws:execute-api:${Region}:${AccountId}:${API_ID}/*/*" `
        --region $Region `
        --no-cli-pager 2>&1

    if ($LASTEXITCODE -eq 0 -or $_ -match "ResourceConflictException") {
        Write-Host "  Permission: $F" -ForegroundColor Gray
    } else {
        Write-Warning "Failed to add permission for $F"
    }
}

$BASE_URL = "https://${API_ID}.execute-api.${Region}.amazonaws.com"

Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "API GATEWAY COMPLETE" -ForegroundColor Yellow  
Write-Host "Base URL: $BASE_URL" -ForegroundColor Green
Write-Host "API ID:   $API_ID" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Yellow

# Save API ID for reference
Set-Content -Path ".api-id" -Value $API_ID
Write-Host "`nAPI ID saved to .api-id"
