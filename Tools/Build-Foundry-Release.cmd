@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Build-Foundry-Release.ps1"
set "EXITCODE=%ERRORLEVEL%"

echo.
if not "%EXITCODE%"=="0" (
    echo ERREUR : la creation de la release a echoue.
) else (
    echo Termine.
)
echo.
pause
exit /b %EXITCODE%
