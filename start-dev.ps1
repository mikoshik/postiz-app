# start-dev.ps1
Write-Host "Start Postiz Dev Environment..." -ForegroundColor Cyan

$projectPath = "C:\RVM_AUTO_ADMIN\postiz-app"

# Запуск в отдельных окнах с правильным путём
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$projectPath'; pnpm --filter=postiz-backend dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$projectPath'; pnpm --filter=postiz-frontend dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$projectPath'; pnpm --filter=postiz-workers dev"
# Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$projectPath\python_service'; python main.py"

Write-Host "working!" -ForegroundColor Green