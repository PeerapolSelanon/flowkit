@echo off
setlocal
:: Flow Kit pre-flight: start API (:8100) + dashboard (:5173) if not already up,
:: wait for /health, then report whether the extension is connected.
:: Run from anywhere: scripts\start.bat
cd /d "%~dp0.."

set PY=venv\Scripts\python.exe
if not exist "%PY%" set PY=uv run --python 3.11 --with-requirements requirements.txt python

netstat -ano | findstr /r /c:":8100 .*LISTENING" >nul
if errorlevel 1 (
    echo [start] API on :8100
    start "flowkit-api" cmd /k "%PY% -m agent.main"
) else (
    echo [skip]  API already listening on :8100
)

netstat -ano | findstr /r /c:":5173 .*LISTENING" >nul
if errorlevel 1 (
    if not exist dashboard\node_modules (
        echo [start] npm install for dashboard ^(first run^)
        call npm install --prefix dashboard --no-audit --no-fund
    )
    echo [start] dashboard on :5173
    start "flowkit-dashboard" cmd /k "npm run dev --prefix dashboard"
) else (
    echo [skip]  dashboard already listening on :5173
)

echo [wait]  API health...
for /l %%i in (1,1,30) do (
    curl -s -m 2 http://127.0.0.1:8100/health >nul 2>&1 && goto :up
    timeout /t 1 /nobreak >nul
)
echo [fail]  API did not answer on :8100 after 30s. Check the flowkit-api window.
exit /b 1

:up
curl -s http://127.0.0.1:8100/health | findstr /c:"\"extension_connected\":true" >nul
if errorlevel 1 (
    echo [warn]  extension_connected: false
    echo         Open one signed-in https://flow.google.com/ tab and load the extension, then re-run.
) else (
    echo [ok]    extension connected
)
echo [ok]    dashboard: http://localhost:5173
endlocal
