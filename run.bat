@echo off
title Faculty ^& Staff Leave ^& Attendance Payroll Management System Launcher
mode con: cols=95 lines=34 >nul 2>&1
color 0F

echo.
echo  =================================================================================
echo    FACULTY AND STAFF LEAVE AND ATTENDANCE PAYROLL MANAGEMENT SYSTEM
echo  =================================================================================
echo.
echo  [SYSTEM CHECK] Initializing launch sequence...
echo.

:: Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    color 0C
    echo  [ERROR] Node.js is not installed or not in your PATH.
    echo          Please install Node.js version 18 or higher to run this system.
    echo.
    pause
    exit /b 1
)

:: Check node_modules
if not exist node_modules (
    color 0E
    echo  [INFO] node_modules folder is missing.
    echo         Installing dependencies, this may take a minute...
    echo.
    call npm install
    if %ERRORLEVEL% neq 0 (
        color 0C
        echo  [ERROR] npm install failed. Please check your internet connection.
        pause
        exit /b 1
    )
    color 0F
    echo  [SUCCESS] Dependencies installed successfully.
    echo.
)

:: Check Prisma Client
if not exist src\generated\prisma (
    color 0E
    echo  [INFO] Prisma Client is not generated. Generating client...
    echo.
    call npm run prisma:generate
    if %ERRORLEVEL% neq 0 (
        color 0C
        echo  [ERROR] Prisma Client generation failed.
        pause
        exit /b 1
    )
    color 0F
    echo  [SUCCESS] Prisma Client generated.
    echo.
)

:: Check Database Connection
color 0B
echo  [INFO] Verifying database connection...
call npx tsx scripts/check-db.ts
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo  [ERROR] Failed to connect to the database.
    echo          Please make sure the SQLite database file dev.db is not locked.
    echo.
    pause
    exit /b 1
)
color 0F
echo.

:: Start Next.js server
color 0B
echo  [INFO] Starting Next.js development server...
:: Start in a separate window so compiler logs don't clutter this status window
start "Next.js Dev Server (KurtSystem)" cmd /k "npm run dev"

:: Start Prisma Studio (SQLite Dashboard)
echo  [INFO] Starting SQLite Dashboard (Prisma Studio)...
:: Run without opening browser automatically since we open it cleanly at the end
start "Prisma Studio (KurtSystem)" cmd /k "npx prisma studio --browser none"
echo.

:: Wait for Web Connection (Port 3000)
echo  [INFO] Establishing connection to web server on port 3000...
call npx tsx scripts/check-port.ts 3000
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo  [ERROR] Timeout waiting for Next.js server to start.
    echo          Please check if port 3000 is already in use.
    echo.
    pause
    exit /b 1
)

:: Wait for SQLite Dashboard Connection (Port 5555)
echo  [INFO] Establishing connection to SQLite dashboard on port 5555...
call npx tsx scripts/check-port.ts 5555
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo  [ERROR] Timeout waiting for SQLite Dashboard to start.
    echo          Please check if port 5555 is already in use.
    echo.
    pause
    exit /b 1
)

color 0A
echo.
echo  =================================================================================
echo    [SUCCESS] ALL CONNECTIONS ARE ESTABLISHED AND ACTIVE!
echo  =================================================================================
echo     - Database Connection : CONNECTED [SQLite dev.db]
echo     - Web Server Port     : CONNECTED [http://localhost:3000]
echo     - SQLite Dashboard    : CONNECTED [http://localhost:5555]
echo  =================================================================================
echo.
echo  Opening system and database dashboard in your default browser...
start http://localhost:3000
start http://localhost:5555
echo.

color 0E
echo  ---------------------------------------------------------------------------------
echo   To STOP the system: Press any key in this window to stop both servers
echo   and free ports 3000 and 5555, or simply close this window.
echo  ---------------------------------------------------------------------------------
pause > nul

echo.
echo  [INFO] Shutting down web server on port 3000 and dashboard on port 5555...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5555 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
echo  [SUCCESS] System stopped successfully.
timeout /t 2 >nul
