#!/usr/bin/env pwsh
# update-lambdas.ps1
# Compiles TS, validates dist, packages zip with dist preserved, and updates Lambdas via S3.

$ErrorActionPreference = "Stop"
$AWS = "C:\Users\am\AppData\Local\Programs\Amazon\AWSCLIV2\aws.exe"
$ZIP = "origyn-backend.zip"
$S3_BUCKET = "origyn-documents-015524245486"
$S3_KEY = "deployments/origyn-backend.zip"

Write-Host "1. Compiling TypeScript..." -ForegroundColor Cyan
npm run build:js

Write-Host "2. Verifying dist/ exists..." -ForegroundColor Cyan
if (-not (Test-Path "dist")) {
    Write-Error "dist/ directory not found! Compilation failed?"
    exit 1
}

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

Write-Host "3. Packaging ZIP (preserving dist/ structure)..." -ForegroundColor Cyan
if (Test-Path $ZIP) { Remove-Item $ZIP -Force }

# Use Python to ensure correct structure and forward-slashes in the ZIP
python -c "
import zipfile, os

zip_path = '$ZIP'
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for d in ['dist', 'node_modules']:
        for root, dirs, files in os.walk(d):
            # Skip .bin directory in node_modules
            dirs[:] = [dir_name for dir_name in dirs if dir_name != '.bin' or root != 'node_modules']
            for f in files:
                full = os.path.join(root, f)
                # Ensure forward slashes for AWS Lambda
                arc = full.replace(os.sep, '/')
                z.write(full, arc)
"
if ($LASTEXITCODE -ne 0) { Write-Error "ZIP creation failed!"; exit 1 }
Write-Host "ZIP created successfully." -ForegroundColor Green

Write-Host "4. Automated Handler Validation..." -ForegroundColor Cyan
$MissingHandlers = 0
foreach ($func in $functions) {
    $handlerName = $func.Replace("origyn-", "")
    $expectedJs = "dist/handlers/${handlerName}.js"
    
    # Check if the expected JS file is physically in the ZIP
    $exists = python -c "
import zipfile, sys
z = zipfile.ZipFile('$ZIP')
sys.exit(0 if '$expectedJs' in z.namelist() else 1)
"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Lambda $func expects handler file $expectedJs, but deployment artifact does not contain it." -ForegroundColor Red
        $MissingHandlers++
    }
}

if ($MissingHandlers -gt 0) {
    Write-Error "ABORTING DEPLOYMENT: $MissingHandlers handlers are missing from the artifact."
    exit 1
}
Write-Host "Validated $($functions.Count) handlers successfully in artifact." -ForegroundColor Green

Write-Host "5. Uploading deployment artifact to S3 ($S3_BUCKET/$S3_KEY)..." -ForegroundColor Cyan
& $AWS s3 cp $ZIP s3://${S3_BUCKET}/${S3_KEY} --region us-east-1
if ($LASTEXITCODE -ne 0) { Write-Error "S3 upload failed!"; exit 1 }

Write-Host "6. Updating Lambda functions from S3..." -ForegroundColor Cyan
$jobs = @()
foreach ($func in $functions) {
    $handlerName = $func.Replace("origyn-", "")
    $handlerPath = "dist/handlers/${handlerName}.handler"

    # Update configuration
    & $AWS lambda update-function-configuration --function-name $func --handler $handlerPath --no-cli-pager | Out-Null

    # Spawn background job for the code update to run them in parallel
    $jobs += Start-Job -ScriptBlock {
        param($aws_exe, $fn, $bucket, $key)
        & $aws_exe lambda update-function-code --function-name $fn --s3-bucket $bucket --s3-key $key --no-cli-pager 2>&1 | Out-Null
        Write-Output "OK: $fn"
    } -ArgumentList $AWS, $func, $S3_BUCKET, $S3_KEY
}

Write-Host "Waiting for parallel Lambda updates to complete..."
$jobs | Wait-Job | Receive-Job
$jobs | Remove-Job

Write-Host "Done! Deployment successful." -ForegroundColor Green
