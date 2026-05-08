#!/bin/bash

# Setup script for MQTT integration
# Run this once to get everything ready

set -e

echo "🔧 Setting up MQTT Integration for P2P Energy Trading"
echo "======================================================"
echo ""

# Check if Node.js installed
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Please install Node.js 16+"
  exit 1
fi

# Check if Docker installed
if ! command -v docker &> /dev/null; then
  echo "❌ Docker not found. Please install Docker"
  exit 1
fi

# Check if Docker daemon is running
if ! docker ps &> /dev/null; then
  echo "❌ Docker daemon is not running. Please start Docker and try again."
  exit 1
fi

echo "✅ Prerequisites OK"
echo ""

# Install MQTT package
echo "📦 Installing mqtt package (if not already installed)..."
npm list mqtt &> /dev/null || npm install mqtt

echo "✅ Dependencies ready"
echo ""

# Create .env.mqtt if it doesn't exist
if [ ! -f ".env.mqtt" ]; then
  echo "⚙️  Creating .env.mqtt configuration file..."
  cat > .env.mqtt << 'EOF'
# MQTT Configuration
MQTT_BROKER_URL=mqtt://localhost:1883
METER_PUBLISH_INTERVAL=5000

# Blockchain Configuration
RPC_URL=http://localhost:8545
VITE_MARKETPLACE_ADDRESS=0xc514BF2a6fDB4410B5a60F403470339148F87EeA
ORACLE_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000
VITE_NETWORK=localhost
EOF
  
  echo "⚠️  Edit .env.mqtt with your contract addresses!"
  echo ""
fi

# Start Mosquitto Docker container
echo "🐝 Starting Mosquitto MQTT Broker..."
docker-compose -f docker/docker-compose.yml up -d mosquitto

# Wait for broker to be ready
echo "⏳ Waiting for broker to start..."
RETRIES=30
COUNTER=0
until COUNTER=$((COUNTER + 1)) && [ $COUNTER -gt $RETRIES ] || docker exec energy-mqtt-broker mosquitto_sub -h localhost -t test -C 1 >/dev/null 2>&1; do
  sleep 1
done

if [ $COUNTER -gt $RETRIES ]; then
  echo "❌ Broker failed to start after $RETRIES seconds"
  exit 1
fi

echo "✅ Broker is ready"
echo ""

# Create helpful scripts
mkdir -p .bin
chmod +x mqtt/quickstart.sh

echo "🎉 Setup Complete!"
echo ""
echo "Next steps:"
echo "==========="
echo ""
echo "1. Edit .env.mqtt with your contract addresses"
echo "   nano .env.mqtt"
echo ""
echo "2. In Terminal 1, start your Hardhat local network (if not running):"
echo "   npm run node"
echo ""
echo "3. In Terminal 2, start the Oracle service:"
echo "   npm run oracle:start"
echo ""
echo "4. In Terminal 3, start the Smart Meter simulator:"
echo "   npm run meter:start"
echo ""
echo "5. Create a trade in the frontend and watch it settle automatically!"
echo ""
echo "To stop the MQTT broker:"
echo "   docker-compose -f docker/docker-compose.yml down"
echo ""
echo "Documentation: MQTT_SETUP.md"
echo ""
