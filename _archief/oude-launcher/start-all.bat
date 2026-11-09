@echo off
REM ============================================================================
REM  Start al je webapps tegelijk, elk in een eigen venster op een eigen poort.
REM  Dubbelklik dit bestand, of draai het in een terminal:  start-all.bat
REM
REM  Sluit een venster om die ene app te stoppen. Sluit ze allemaal om te stoppen.
REM
REM  %~dp0 = de map waar dit bestand staat (met \ op het eind). Door met
REM  start "titel" /d "map" cmd /k <commando> te werken hoeft het commando zelf
REM  geen aanhalingstekens — dat vermijdt alle quote-ellende op paden met spaties.
REM ============================================================================

echo.
echo   Alles opstarten. Elk venster is een app.
echo.

REM -- Statische sites (allemaal onder een server) -----------------------------
start "Statische sites :3010" /d "%~dp0" cmd /k node launch.mjs all-static
echo   * statische sites        http://localhost:3010

REM -- Next.js -----------------------------------------------------------------
start "eid-luxe-shop :3001" /d "%~dp0eid-luxe-shop" cmd /k npx next dev -p 3001
echo   * eid-luxe-shop          http://localhost:3001

start "noor-tracker :3004" /d "%~dp0noor-tracker" cmd /k npx next dev -p 3004
echo   * noor-tracker           http://localhost:3004

start "printable-generator :3005" /d "%~dp0printable-generator" cmd /k npx next dev -p 3005
echo   * printable-generator    http://localhost:3005

REM -- Vite --------------------------------------------------------------------
start "webshop :3006" /d "%~dp0webshop" cmd /k npx vite --port 3006 --strictPort
echo   * webshop                http://localhost:3006

REM -- Express -----------------------------------------------------------------
start "marktonderzoek :3008" /d "%~dp0marktonderzoek" cmd /k "set PORT=3008 && node server.js"
echo   * marktonderzoek         http://localhost:3008

echo.
echo   Deze starten NIET automatisch (ze hebben eerst iets nodig):
echo     - jamal-jamila / luxe-store : database   ^(cd map ^&^& npm run db:push^)
echo     - superette                 : 4 processen ^(zie LAUNCH.md^)
echo     - noor-app                  : cd noor-app ^&^& npx expo start --web
echo     - resume-roaster            : node resume-roaster\server.js  ^(+ npx vite --port 3007^)
echo.
echo   Klaar. De vensters compileren nu; geef Next.js ~15s.
echo.
