# Wave Dashboard - Start Script
Write-Host "Starting Wave Dashboard..." -ForegroundColor Cyan

# Start backend
Write-Host ">> Backend on http://localhost:3001" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; node server.js"

Start-Sleep -Seconds 1

# Start frontend
Write-Host ">> Frontend on http://localhost:5173" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host ""
Write-Host "  App: http://localhost:5173" -ForegroundColor Yellow
Write-Host "  API: http://localhost:3001" -ForegroundColor Yellow
