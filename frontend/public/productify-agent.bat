@echo off
title Productify Host Node Agent
color 0A
echo =================================================================
echo   PRODUCTIFY HOST NODE AGENT - HARDWARE AUTO-PROBE
echo =================================================================
echo  Connecting to Productify host hypervisor probe...
echo.

where py >nul 2>nul
if %errorlevel% equ 0 (
    py -c "import urllib.request; exec(urllib.request.urlopen('https://raw.githubusercontent.com/Crimson-ripper/Productify-/main/scripts/productify_agent.py').read().decode())"
    goto end
)

where python >nul 2>nul
if %errorlevel% equ 0 (
    python -c "import urllib.request; exec(urllib.request.urlopen('https://raw.githubusercontent.com/Crimson-ripper/Productify-/main/scripts/productify_agent.py').read().decode())"
    goto end
)

where python3 >nul 2>nul
if %errorlevel% equ 0 (
    python3 -c "import urllib.request; exec(urllib.request.urlopen('https://raw.githubusercontent.com/Crimson-ripper/Productify-/main/scripts/productify_agent.py').read().decode())"
    goto end
)

echo [ERROR] Python 3 was not detected on your system.
echo Please install Python 3.8+ from https://www.python.org/downloads/
echo (Be sure to check 'Add python.exe to PATH' during installation).
echo.
pause

:end
