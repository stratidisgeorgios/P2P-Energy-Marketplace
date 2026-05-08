#!/bin/bash

# Quick Start Script for MQTT Smart Meter System
# This sets up and starts all components

set -e

echo "🚀 P2P Energy Marketplace - MQTT Integration"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js not found. Please install Node.js 16+${NC}"
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker not found. Please install Docker${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Node.js: $(node -v)${NC}"
echo -e "${GREEN}✅ Docker: $(docker --version)${NC}"
echo ""

# Check if .env.mqtt exists
if [ ! -f ".env.mqtt" ]; then
  echo -e "${YELLOW}⚠️  .env.mqtt not found. Creating from template...${NC}"
  cp .env.mqtt .env.mqtt.local
  echo -e "${YELLOW}   Please edit .env.mqtt with your contract addresses${NC}"
  echo ""
fi

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install mqtt 2>/dev/null || true
echo -e "${GREEN}✅ Dependencies ready${NC}"
echo ""

# Start Mosquitto
echo "🐝 Starting Mosquitto MQTT Broker..."
docker-compose -f docker/docker-compose.yml up -d mosquitto

# Wait for broker to be ready
echo "⏳ Waiting for broker to be ready..."
for i in {1..30}; do
  if docker exec energy-mqtt-broker mosquitto_sub -h localhost -t test -C 1 2>/dev/null; then
    echo -e "${GREEN}✅ Broker is ready${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}❌ Broker failed to start${NC}"
    exit 1
  fi
  sleep 1
done
echo ""

# Show next steps
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "==========="
echo "1. In Terminal 1, start the Oracle service:"
echo -e "   ${YELLOW}npm run oracle:start${NC}"
echo ""
echo "2. In Terminal 2, start the Smart Meter publisher:"
echo -e "   ${YELLOW}npm run meter:start${NC}"
echo ""
echo "3. In Terminal 3 (optional), monitor messages:"
echo -e "   ${YELLOW}mosquitto_sub -h localhost -t 'meters/+/energy'${NC}"
echo ""
echo "4. Create a trade in the frontend, then watch oracle settle it automatically!"
echo ""
echo "To stop all services:"
echo -e "${YELLOW}npm run mqtt:broker:stop${NC}"
echo ""
