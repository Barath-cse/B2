@echo off
REM BlockSecure Project Setup Script (Windows)

echo.
echo ==========================================
echo 🚀 BlockSecure - Project Setup
echo ==========================================

REM Check if Node.js is installed
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed
    echo 📥 Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i

echo ✅ Node.js version: %NODE_VERSION%
echo ✅ npm version: %NPM_VERSION%

REM Create directories
echo.
echo 📁 Creating directories...
if not exist "backend\uploads" mkdir backend\uploads
if not exist "frontend\src\components" mkdir frontend\src\components
if not exist "frontend\src\styles" mkdir frontend\src\styles
if not exist "frontend\src\utils" mkdir frontend\src\utils
if not exist "frontend\public" mkdir frontend\public
if not exist "contracts" mkdir contracts

echo ✅ Directories created

REM Setup Backend
echo.
echo Backend Setup
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd backend

if not exist "node_modules" (
    echo 📥 Installing backend dependencies...
    call npm install
) else (
    echo ✅ Backend dependencies already installed
)

if not exist ".env" (
    echo ⚙️  Creating .env file from template...
    copy .env.example .env
    echo.
    echo ⚠️  Please edit .env with your configuration:
    echo    - BLOCKCHAIN_RPC
    echo    - CONTRACT_ADDRESS
    echo    - PRIVATE_KEY
)

cd ..

REM Setup Frontend
echo.
echo Frontend Setup
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd frontend

if not exist "node_modules" (
    echo 📥 Installing frontend dependencies...
    call npm install
) else (
    echo ✅ Frontend dependencies already installed
)

cd ..

REM Summary
echo.
echo ==========================================
echo ✅ Setup Complete!
echo ==========================================
echo.
echo 📋 Next Steps:
echo.
echo 1. Configure Backend (.env):
echo    cd backend
echo    notepad .env
echo.
echo 2. Start Backend (Command Prompt 1):
echo    cd backend
echo    npm start
echo.
echo 3. Start Frontend (Command Prompt 2):
echo    cd frontend
echo    npm start
echo.
echo 4. Open Browser:
echo    http://localhost:3000
echo.
echo 5. Read Setup Guide:
echo    type SETUP_GUIDE.md
echo.
echo ==========================================
pause
