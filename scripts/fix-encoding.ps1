# PowerShell UTF-8 Encoding Configuration
# Purpose: Fix garbled Chinese characters in test output

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Configuring PowerShell Encoding" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Set console and PowerShell output encoding to UTF-8
Write-Host "Setting Console.OutputEncoding to UTF-8..." -ForegroundColor Yellow
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Setting OutputEncoding to UTF-8..." -ForegroundColor Yellow
$global:OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Setting default file encoding to UTF-8..." -ForegroundColor Yellow
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

# Verify settings
Write-Host ""
Write-Host "Current Encoding Settings:" -ForegroundColor Green
Write-Host "  Console.OutputEncoding: $([Console]::OutputEncoding.EncodingName)" -ForegroundColor White
Write-Host "  OutputEncoding: $($OutputEncoding.EncodingName)" -ForegroundColor White

# Test Chinese display
Write-Host ""
Write-Host "Testing Chinese Character Display:" -ForegroundColor Green
Write-Host "  Timeline component integration tests" -ForegroundColor White
Write-Host "  EventList component integration tests" -ForegroundColor White
Write-Host "  API timeout handling" -ForegroundColor White

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Configuration Complete!" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run tests to verify:" -ForegroundColor Yellow
Write-Host "  npm run test:unit" -ForegroundColor White
Write-Host "  npm run test:integration" -ForegroundColor White
Write-Host ""

Write-Host "Note: This configuration applies to current session only." -ForegroundColor Gray
Write-Host "To make it permanent, add these lines to your PowerShell profile:" -ForegroundColor Gray
Write-Host ""
Write-Host "  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8" -ForegroundColor Cyan
Write-Host "  `$OutputEncoding = [System.Text.Encoding]::UTF8" -ForegroundColor Cyan
Write-Host ""
