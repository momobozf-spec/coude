@echo off
title Coude lokaal
cd /d "%~dp0lokaal"
if not exist node_modules (
  echo Eerste keer: lokale database-pakketten installeren...
  call npm install --no-audit --no-fund
)
node start.mjs
pause
