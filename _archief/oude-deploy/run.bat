@echo off
setlocal EnableDelayedExpansion
title Coude project launcher
cd /d "%~dp0"

:menu
cls
echo ============================================================
echo   Coude project launcher  (everything boots with no setup)
echo ============================================================
echo.
echo   Static (open in browser, no install)
echo     1. brandstofprijzen.html
echo     2. noor-growth-funnel
echo     3. simple-webapp
echo.
echo   Node servers (no DB / no API key needed)
echo     4. webshop                  Vite/React           port 5173
echo     5. marktonderzoek           Express survey       port 3000
echo.
echo   Needs ANTHROPIC_API_KEY in .env (else AI roast won't work)
echo     6. resume-roaster           Vite + Express       port 5173
echo.
echo   Next.js + local SQLite (zero external services)
echo     7. jamal-jamila             Next.js              port 3000
echo     8. luxe-store               Next.js              port 3000
echo     9. noor-tracker             Next.js              port 3000
echo    10. printable-generator      Next.js              port 3000
echo.
echo   Mobile
echo    11. noor-app                 Expo (needs Expo Go on phone)
echo.
echo    H. Open HOW-TO-RUN guide
echo    Q. Quit
echo.
set /p choice=Pick a number:

if /i "%choice%"=="1"  start "" "%~dp0brandstofprijzen.html" & goto menu
if /i "%choice%"=="2"  start "" "%~dp0noor-growth-funnel\index.html" & goto menu
if /i "%choice%"=="3"  start "" "%~dp0simple-webapp\index.html" & goto menu
if /i "%choice%"=="4"  call :node "webshop"             "npm run dev" "http://localhost:5173" "" & goto menu
if /i "%choice%"=="5"  call :node "marktonderzoek"      "npm start"   "http://localhost:3000" "" & goto menu
if /i "%choice%"=="6"  call :node "resume-roaster"      "npm run dev" "http://localhost:5173" "" & goto menu
if /i "%choice%"=="7"  call :node "jamal-jamila"        "npm run dev" "http://localhost:3000" "prisma" & goto menu
if /i "%choice%"=="8"  call :node "luxe-store"          "npm run dev" "http://localhost:3000" "prisma" & goto menu
if /i "%choice%"=="9"  call :node "noor-tracker"        "npm run dev" "http://localhost:3000" "prisma" & goto menu
if /i "%choice%"=="10" call :node "printable-generator" "npm run dev" "http://localhost:3000" "prisma" & goto menu
if /i "%choice%"=="11" call :node "noor-app"            "npm start"   ""                        "" & goto menu
if /i "%choice%"=="h"  start "" notepad "%~dp0HOW-TO-RUN.md" & goto menu
if /i "%choice%"=="q"  exit /b 0
goto menu

:node
set "proj=%~1"
set "cmd=%~2"
set "url=%~3"
set "needs_prisma=%~4"
if not exist "%~dp0%proj%\package.json" ( echo [!] %proj%\package.json not found & pause & exit /b 1 )
where node >nul 2>nul || ( echo [!] Node.js is not installed. Get it from https://nodejs.org & pause & exit /b 1 )

pushd "%~dp0%proj%"

if not exist "node_modules" (
    echo [*] Installing dependencies for %proj% ^(one-time, ~1-2 min^)...
    call npm install
    if errorlevel 1 ( echo [!] npm install failed & popd & pause & exit /b 1 )
)

if "%needs_prisma%"=="prisma" (
    if not exist "prisma\dev.db" (
        echo [*] First-run Prisma setup for %proj%...

        rem Stale generated client from the old Postgres setup
        if exist "src\generated\prisma" (
            echo     - removing stale src\generated\prisma folder
            rmdir /s /q "src\generated\prisma"
        )

        rem Re-sync dependencies from package.json (picks up any new deps like the libsql adapter)
        echo     - npm install ^(syncing dependencies^)
        call npm install
        if errorlevel 1 ( echo [!] npm install failed & popd & pause & exit /b 1 )

        rem Generate the Prisma client and create the SQLite database file
        echo     - npx prisma generate
        call npx prisma generate
        if errorlevel 1 ( echo [!] prisma generate failed & popd & pause & exit /b 1 )

        echo     - npx prisma db push
        call npx prisma db push
        if errorlevel 1 ( echo [!] prisma db push failed & popd & pause & exit /b 1 )

        echo [*] Database created at prisma\dev.db
    )
)

if not "%url%"=="" (
    echo [*] Will open %url% in 18 seconds (giving the server time to start)...
    start "" cmd /c "timeout /t 18 >nul & start """" %url%"
)
echo.
echo ============================================================
echo   Starting %proj%        ^(Ctrl+C in this window to stop^)
echo ============================================================
echo.
%cmd%
echo.
echo ============================================================
echo   Server stopped or crashed. Press any key to return to menu.
echo ============================================================
pause >nul
popd
exit /b 0
