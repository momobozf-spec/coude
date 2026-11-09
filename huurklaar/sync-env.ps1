# Zet alle ingevulde waarden uit .env.local in Vercel (production). Toont nooit de waarden zelf.
param([string]$SiteUrl = "")
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
$skip = @("VERCEL_OIDC_TOKEN", "NEXT_PUBLIC_SITE_URL")
$done = @(); $empty = @()
foreach ($line in Get-Content .env.local) {
  if ($line -notmatch '^\s*([A-Z0-9_]+)=(.*)$') { continue }
  $k = $Matches[1]; $v = $Matches[2].Trim()
  if ($skip -contains $k) { continue }
  if ($v -eq "" -or $v -eq "???") { $empty += $k; continue }
  $v | npx --yes vercel@latest env add $k production --force *> $null
  if ($LASTEXITCODE -ne 0) { Write-Output "FOUT bij $k"; exit 1 }
  $done += $k
}
if ($SiteUrl) {
  $SiteUrl | npx --yes vercel@latest env add NEXT_PUBLIC_SITE_URL production --force *> $null
  $done += "NEXT_PUBLIC_SITE_URL"
}
Write-Output ("Gezet: " + ($done -join ", "))
Write-Output ("Nog leeg: " + ($empty -join ", "))
