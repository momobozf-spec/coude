# Plant de nachtelijke Superette-prijsupdate in via Windows Taakplanner.
# Rechtsklik op dit bestand -> "Uitvoeren met PowerShell" (geen beheerdersrechten nodig).
# Elke nacht om 03:30; wekt de laptop als die slaapt; loopt een gemiste run in als de laptop toen uit stond.
# Weer verwijderen: Unregister-ScheduledTask -TaskName 'Superette nachtelijke prijsupdate'

$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot
$node = (Get-Command node).Source
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$dir\nachtelijke-update.mjs`"" -WorkingDirectory $dir
$trigger = New-ScheduledTaskTrigger -Daily -At 03:30
$settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 10) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'Superette nachtelijke prijsupdate' -Action $action -Trigger $trigger -Settings $settings `
  -Description 'Haalt elke nacht verse supermarktprijzen op voor Superette (coude\lokaal\nachtelijke-update.mjs).' -Force | Out-Null

$info = Get-ScheduledTaskInfo -TaskName 'Superette nachtelijke prijsupdate'
Write-Host "Ingepland. Volgende run: $($info.NextRunTime)" -ForegroundColor Green
Write-Host "Logs: superette-pro\apps\api\data\logs\update-<datum>.log"
Read-Host 'Druk op Enter om te sluiten'
