@echo off
setlocal enabledelayedexpansion
title TRO SYSTEM
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto nonode

if not exist ".env" goto asktoken
goto checksecret

:asktoken
echo.
echo  ==== SETUP PERTAMA TRO SYSTEM ====
echo.
set /p TOKEN= Paste TOKEN bot lalu tekan Enter:
> .env echo DISCORD_TOKEN=!TOKEN!
>> .env echo GUILD_ID=1437179205740658899
echo  [OK] Token disimpan.

:checksecret
findstr /b /c:"CLIENT_SECRET=" .env >nul 2>nul
if not errorlevel 1 goto install
echo.
echo  ==== SETUP DASHBOARD WEB ====
echo  Ambil di Developer Portal: TRO SYSTEM - OAuth2 - Client Secret - Reset Secret - Copy
echo.
set /p SECRET= Paste CLIENT SECRET lalu tekan Enter:
>> .env echo CLIENT_ID=1567251006528688278
>> .env echo CLIENT_SECRET=!SECRET!
>> .env echo BASE_URL=http://localhost:3000
>> .env echo SESSION_SECRET=tro%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%
echo  [OK] Dashboard siap.

:install
if exist "node_modules\express\package.json" if exist "node_modules\express-session\package.json" goto run
echo.
echo  Menginstall komponen bot dan dashboard, sekali saja...
call npm install discord.js@14 dotenv@16 express@4 express-session@1 --no-audit --no-fund

:run
echo.
echo  Menjalankan TRO SYSTEM... tutup jendela ini untuk mematikan bot
echo  Dashboard: http://localhost:3000
start "" "http://localhost:3000"
:loop
node index.js
echo  Bot berhenti. Restart otomatis dalam 5 detik...
timeout /t 5 >nul
goto loop

:nonode
echo.
echo  [X] Node.js belum terinstall.
echo      Download versi LTS di https://nodejs.org lalu jalankan start.bat lagi.
echo.
start https://nodejs.org
pause
