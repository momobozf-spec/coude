# Zet alle ingevulde waarden uit .env.local in Vercel (production). Toont nooit de waarden zelf.
param([string]$SiteUrl = "")
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
$skip = @("VERCEL_OIDC_TOKEN", "NEXT_PUBLIC_SITE_URL")
$done = @(); $empty = @(); $failed = @()
function Push-Var($k, $v) {
  $type = if ($k -like "NEXT_PUBLIC_*") { "--no-sensitive" } else { "--sensitive" }
  $out = npx --yes vercel@latest env add $k --environment production --value $v --force --yes $type 2>&1
  return ($LASTEXITCODE -eq 0)
}
foreach ($line in Get-Content .env.local) {
  if ($line -notmatch '^\s*([A-Z0-9_]+)=(.*)$') { continue }
  $k = $Matches[1]; $v = $Matches[2].Trim()
  if ($skip -contains $k) { continue }
  if ($v -eq "" -or $v -eq "???") { $empty += $k; continue }
  if (Push-Var $k $v) { $done += $k } else { $failed += $k }
}
if ($SiteUrl) { if (Push-Var "NEXT_PUBLIC_SITE_URL" $SiteUrl) { $done += "NEXT_PUBLIC_SITE_URL" } else { $failed += "NEXT_PUBLIC_SITE_URL" } }
Write-Output ("Gezet: " + ($done -join ", "))
Write-Output ("Nog leeg: " + ($empty -join ", "))
Write-Output ("Mislukt: " + ($failed -join ", "))
