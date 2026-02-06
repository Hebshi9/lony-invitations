@echo off
echo Checking Docker status...
docker ps

echo.
echo Checking Evolution API...
curl http://localhost:8081 2>nul
if %errorlevel% neq 0 (
    echo Evolution API not responding yet. Waiting...
    timeout /t 10
)

echo.
echo All services status:
echo - Evolution API: http://localhost:8081
echo - WhatsApp Server: http://localhost:3001
echo - Frontend: http://localhost:5173
echo.
pause
