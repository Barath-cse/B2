#!/bin/bash

# BlockSecure Project Setup Script
# This script automates the setup process

echo "=========================================="
echo "🚀 BlockSecure - Project Setup"
echo "=========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "📥 Please install Node.js from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo "✅ npm version: $(npm -v)"

# Create directories
echo ""
echo "📁 Creating directories..."
mkdir -p backend/uploads
mkdir -p frontend/src/components
mkdir -p frontend/src/styles
mkdir -p frontend/src/utils
mkdir -p frontend/public
mkdir -p contracts

echo "✅ Directories created"

# Setup Backend
echo ""
echo "Backend Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd backend

if [ ! -f "package.json" ]; then
    echo "📦 Creating backend package.json..."
fi

if [ ! -d "node_modules" ]; then
    echo "📥 Installing backend dependencies..."
    npm install
else
    echo "✅ Backend dependencies already installed"
fi

if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your configuration:"
    echo "   - BLOCKCHAIN_RPC"
    echo "   - CONTRACT_ADDRESS"
    echo "   - PRIVATE_KEY"
fi

cd ..

# Setup Frontend
echo ""
echo "Frontend Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd frontend

if [ ! -d "node_modules" ]; then
    echo "📥 Installing frontend dependencies..."
    npm install
else
    echo "✅ Frontend dependencies already installed"
fi

cd ..

# Summary
echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Configure Backend (.env):"
echo "   cd backend && nano .env"
echo ""
echo "2. Start Backend (Terminal 1):"
echo "   cd backend && npm start"
echo ""
echo "3. Start Frontend (Terminal 2):"
echo "   cd frontend && npm start"
echo ""
echo "4. Open Browser:"
echo "   http://localhost:3000"
echo ""
echo "5. Read Setup Guide:"
echo "   cat SETUP_GUIDE.md"
echo ""
echo "=========================================="
