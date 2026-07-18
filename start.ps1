# Golden Cut Barber Appointment System Startup Script
Write-Host "Golden Cut Uygulaması Başlatılıyor..." -ForegroundColor Gold

# Check if port 5001 is in use and prompt
$portCheck = Get-NetTCPConnection -LocalPort 5001 -ErrorAction SilentlyContinue
if ($portCheck) {
    Write-Host "Uyarı: 5001 numaralı port (Backend) zaten kullanımda! Lütfen çakışan uygulamayı kapatın." -ForegroundColor Yellow
}

# Start backend server in a new window
Write-Host "Sunucu başlatılıyor (Port 5001)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location backend; npm run dev"

# Start frontend Vite server in a new window
Write-Host "Arayüz başlatılıyor..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location frontend; npm run dev"

Write-Host "Golden Cut başarıyla başlatıldı!" -ForegroundColor Green
Write-Host "Tarayıcınızda frontend adresini açarak (genellikle http://localhost:5173) kullanmaya başlayabilirsiniz." -ForegroundColor Gold
