#!/usr/bin/env pwsh
# create-api.ps1
# Creates HTTP API Gateway and wires routes to Lambda functions.
# Run from backend/ directory AFTER deploy-lambdas.ps1 succeeds.

$AWS    = "C:\Users\am\AppData\Local\Programs\Amazon\AWSCLIV2\aws.exe"
$REGION = "us-east-1"
$ACCT   = "135977257539"

# ── Step 1: Create HTTP API ───────────────────────────────────────────────────
Write-Host "`n>>> Creating HTTP API..." -ForegroundColor Cyan
$API_JSON = & $AWS apigatewayv2 create-api `
    --name "origyn-api" `
    --protocol-type HTTP `
    --cors-configuration "AllowOrigins=*,AllowMethods=GET,POST,OPTIONS,AllowHeaders=Content-Type,Authorization,X-Requested-With,x-origyn-workspace-id" `
    --no-cli-pager `
    --output json
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create API"; exit 1 }

$API = $API_JSON | ConvertFrom-Json
$API_ID = $API.ApiId
Write-Host "API ID: $API_ID" -ForegroundColor Green

# ── Step 2: Create integrations ───────────────────────────────────────────────
function Add-Integration {
    param($FunctionName)
    $ARN = "arn:aws:lambda:${REGION}:${ACCT}:function:$FunctionName"
    $URI = "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${ARN}/invocations"
    $RESULT = & $AWS apigatewayv2 create-integration `
        --api-id $API_ID `
        --integration-type AWS_PROXY `
        --integration-uri $URI `
        --payload-format-version "1.0" `
        --no-cli-pager `
        --output json | ConvertFrom-Json
    return $RESULT.IntegrationId
}

Write-Host "`n>>> Creating integrations..." -ForegroundColor Cyan
$INT_HEALTH  = Add-Integration "origyn-health"
$INT_UPLOAD  = Add-Integration "origyn-uploadDocument"
$INT_LIST    = Add-Integration "origyn-getDocuments"
$INT_DETAIL  = Add-Integration "origyn-getDocument"
$INT_GRAPH   = Add-Integration "origyn-getGraph"
Write-Host "Integrations created." -ForegroundColor Green

# ── Step 3: Create routes ─────────────────────────────────────────────────────
function Add-Route {
    param($Method, $Path, $IntegrationId)
    $KEY = "$Method $Path"
    & $AWS apigatewayv2 create-route `
        --api-id $API_ID `
        --route-key $KEY `
        --target "integrations/$IntegrationId" `
        --no-cli-pager | Out-Null
    Write-Host "Route: $KEY" -ForegroundColor Gray
}

Write-Host "`n>>> Creating routes..." -ForegroundColor Cyan
Add-Route "GET"  "/health"          $INT_HEALTH
Add-Route "POST" "/documents"       $INT_UPLOAD
Add-Route "GET"  "/documents"       $INT_LIST
Add-Route "GET"  "/documents/{id}"  $INT_DETAIL
Add-Route "GET"  "/graph"           $INT_GRAPH

# ── Step 4: Deploy to $default stage ─────────────────────────────────────────
Write-Host "`n>>> Deploying to `$default stage..." -ForegroundColor Cyan
& $AWS apigatewayv2 create-stage `
    --api-id $API_ID `
    --stage-name '$default' `
    --auto-deploy `
    --no-cli-pager | Out-Null

# ── Step 5: Grant API Gateway permission to invoke each Lambda ────────────────
Write-Host "`n>>> Granting invoke permissions..." -ForegroundColor Cyan
$FUNCTIONS = @(
    @{Name="origyn-health";         Route="GET-health"},
    @{Name="origyn-uploadDocument"; Route="POST-documents"},
    @{Name="origyn-getDocuments";   Route="GET-documents"},
    @{Name="origyn-getDocument";    Route="GET-documents-id"},
    @{Name="origyn-getGraph";       Route="GET-graph"}
)
foreach ($F in $FUNCTIONS) {
    & $AWS lambda add-permission `
        --function-name $F.Name `
        --statement-id "allow-apigw-$($F.Route)" `
        --action lambda:InvokeFunction `
        --principal apigateway.amazonaws.com `
        --source-arn "arn:aws:execute-api:${REGION}:${ACCT}:${API_ID}/*" `
        --no-cli-pager | Out-Null
    Write-Host "Permission granted: $($F.Name)" -ForegroundColor Gray
}

# ── Print base URL ────────────────────────────────────────────────────────────
$BASE_URL = "https://${API_ID}.execute-api.${REGION}.amazonaws.com"
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "API BASE URL: $BASE_URL" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Yellow

Write-Host "Test with:" -ForegroundColor Cyan
Write-Host "  Invoke-RestMethod -Uri '$BASE_URL/health'"
