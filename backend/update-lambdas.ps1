#!/usr/bin/env pwsh
# update-lambdas.ps1
# Compiles TS, validates dist, packages zip with dist preserved, and updates Lambdas.

$ErrorActionPreference = "Stop"
$AWS = "C:\Users\am\AppData\Local\Programs\Amazon\AWSCLIV2\aws.exe"
$ZIP = "origyn-backend.zip"
$ZIP_URI = "fileb://$ZIP"

Write-Host "1. Compiling TypeScript..." -ForegroundColor Cyan
npm run build:js

Write-Host "2. Verifying dist/ exists..." -ForegroundColor Cyan
if (-not (Test-Path "dist")) {
    Write-Error "dist/ directory not found! Compilation failed?"
    exit 1
}

Write-Host "3. Verifying expected handler JS files exist..." -ForegroundColor Cyan
$expectedHandlers = @(
    "dist/handlers/getAnswers.js",
    "dist/handlers/health.js",
    "dist/handlers/extractClaims.js",
    "dist/handlers/getGraph.js",
    "dist/handlers/getDocument.js",
    "dist/handlers/invalidateDocument.js",
    "dist/handlers/recheckDocument.js",
    "dist/handlers/regenerateAnswer.js",
    "dist/handlers/getAnswer.js",
    "dist/handlers/getDocumentUrl.js",
    "dist/handlers/deleteDocument.js",
    "dist/handlers/chat.js",
    "dist/handlers/getDocumentImpact.js",
    "dist/handlers/uploadDocument.js",
    "dist/handlers/getDocuments.js"
)

foreach ($handler in $expectedHandlers) {
    if (-not (Test-Path $handler)) {
        Write-Error "Missing handler entrypoint: $handler"
        exit 1
    }
}
Write-Host "All expected handlers found." -ForegroundColor Green

Write-Host "4. Packaging ZIP..." -ForegroundColor Cyan
if (Test-Path $ZIP) {
    Remove-Item $ZIP -Force
}
# Compress-Archive preserves the top-level directories when given directory names.
Compress-Archive -Path dist, node_modules -DestinationPath $ZIP

$functions = @(
    "origyn-getAnswers",
    "origyn-health",
    "origyn-extractClaims",
    "origyn-getGraph",
    "origyn-getDocument",
    "origyn-invalidateDocument",
    "origyn-recheckDocument",
    "origyn-regenerateAnswer",
    "origyn-getAnswer",
    "origyn-getDocumentUrl",
    "origyn-deleteDocument",
    "origyn-chat",
    "origyn-getDocumentImpact",
    "origyn-uploadDocument",
    "origyn-getDocuments"
)

Write-Host "5. Updating Lambda functions..." -ForegroundColor Cyan
foreach ($func in $functions) {
    Write-Host "Updating $func..."
    # First, ensure the handler configuration matches our dist/ zip structure exactly
    $handlerName = $func.Replace("origyn-", "")
    $handlerPath = "dist/handlers/$handlerName.handler"
    & $AWS lambda update-function-configuration --function-name $func --handler $handlerPath --no-cli-pager | Out-Null
    
    # Wait for configuration update to finish
    & $AWS lambda wait function-updated --function-name $func
    
    # Now update the code
    & $AWS lambda update-function-code --function-name $func --zip-file $ZIP_URI --no-cli-pager | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to update $func"
    } else {
        Write-Host "OK: $func" -ForegroundColor Green
    }
}
Write-Host "Done"
