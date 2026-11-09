# Familiestem lokaal starten op Windows (testmodus: geen echte betalingen, geen echte transcriptie).
# Gebruik: rechtsklik > "Uitvoeren met PowerShell", of: powershell -ExecutionPolicy Bypass -File start-lokaal.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Test-Path ".venv")) { python -m venv .venv }
.\.venv\Scripts\python.exe -m pip install --quiet --upgrade pip
.\.venv\Scripts\python.exe -m pip install --quiet -r requirements.txt imageio-ffmpeg
$env:FS_DATA_DIR = "$PSScriptRoot\data"
$env:FS_PUBLIC_URL = "http://localhost:8000"
$env:FS_OPS_KEY = "lokaal-testen-familiestem-123456"
.\.venv\Scripts\python.exe -m app.seed_demo
Write-Host ""
Write-Host "Familiestem draait op http://localhost:8000  (stoppen: Ctrl+C)" -ForegroundColor Green
Write-Host "Meetpunten: http://localhost:8000/ops?key=lokaal-testen-familiestem-123456"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
