# push-to-github.ps1
# Zet deze repo deploy-klaar op GitHub. Draai dit op je eigen pc (PowerShell).
# Eenmalig: maak eerst een LEGE repo aan op https://github.com/new
#   - Owner: momobozf-spec
#   - Repository name: coude
#   - GEEN README/.gitignore/license aanvinken (leeg laten)
# Daarna dit script draaien.

$ErrorActionPreference = "Stop"
Set-Location "C:\Users\mo-bo\OneDrive\Documenten\coude"

Write-Host "1/5  Vastgelopen git-lock opruimen..." -ForegroundColor Cyan
Remove-Item ".git\index.lock" -Force -ErrorAction SilentlyContinue

Write-Host "2/5  node_modules / builds uit Git halen (blijven op schijf)..." -ForegroundColor Cyan
# Untrack alles en her-stage volgens .gitignore -> node_modules, .next, dist, *.db, .env vallen eruit
git rm -r --cached --quiet . | Out-Null
git add .

Write-Host "3/5  Commit maken..." -ForegroundColor Cyan
git commit -m "Render deploy-klaar: blueprint + gitignore" | Out-Null

Write-Host "4/5  Koppelen aan je GitHub-repo..." -ForegroundColor Cyan
git remote remove origin 2>$null
git remote add origin https://github.com/momobozf-spec/coude.git
git branch -M main

Write-Host "5/5  Pushen naar GitHub..." -ForegroundColor Cyan
git push -u origin main

Write-Host ""
Write-Host "KLAAR. Code staat op https://github.com/momobozf-spec/coude" -ForegroundColor Green
Write-Host "Volgende stap: dashboard.render.com -> New + -> Blueprint -> kies deze repo -> Apply" -ForegroundColor Green
