# ⚡ P2P Energy Marketplace

A blockchain-based peer-to-peer energy trading platform built with Solidity smart contracts and React frontend. Producers can sell renewable energy and consumers can purchase it, with automatic escrow settlement and certificate generation.

**Live on:** Sepolia Testnet

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [System Architecture](#-system-architecture)
- [User Roles & Actions](#-user-roles--actions)
- [Deployment Instructions](#-deployment-instructions)
- [Frontend Setup & Running](#-frontend-setup--running)
- [Project Features](#-project-features)

---

## 🚀 Quick Start

### Prerequisites

- Node.js v18+
- npm or yarn
- MetaMask wallet or compatible Web3 wallet
- Sepolia testnet funds (for gas fees)

### 1. Deploy Smart Contracts

```bash
# Install dependencies
npm install

# Configure deployment (see Deployment Instructions section)
# Edit .env file with your private key

# Deploy to Sepolia
npm run deploy:sepolia

# Note: Save the contract addresses from the output!
```

### 2. Run Frontend

```bash
cd frontend
npm install
npm run dev

# Frontend runs at http://localhost:5173
```

---

## 🏗️ System Architecture

### Smart Contracts (Solidity 0.8.20)

```
EnergyMarketplace.sol (Main Trading Contract)
├── Offer Management (SELL/BUY bidirectional trading)
├── Trade Execution & Escrow System
├── Token Locking (prevents double-spending by producers)
└── Oracle-based Settlement

EnergyToken.sol (ERC20 Token)
├── Energy units represented as tokens (18 decimals)
├── TRANSFER_ROLE for marketplace-approved transfers
└── Minting capability for producers

UserRegistry.sol (User Role Management)
├── Producer/Consumer registration
└── Role-based access control

RenewableEnergyCertificate.sol (Certificate System)
├── Automatic certificate issuance with trades
├── Energy source tracking (Solar, Wind, Hydro, etc.)
└── Certificate validity and expiry management

EscrowSettlement.sol (Payment Escrow)
└── Secure payment holding during trade settlement
```

### Frontend Stack

- **React 18** with TypeScript
- **ethers.js v6** for blockchain interaction
- **Vite** for rapid development
- **Tailwind CSS** for styling
- **React Router** for navigation

### Context Providers

- `AuthContext` - User registration and authentication state
- `Web3Context` - Wallet connection and blockchain provider
- `RefreshContext` - Global signal to refresh balances after transactions
- `NotificationProvider` - Notification system (extensible)

---

## 👥 User Roles & Actions

### **Producers** 🌱 (Energy Generators)

Producers register to sell renewable energy they generate.

**Actions Available:**
1. **Register as Producer** - Complete registration with name and wallet
2. **Create SELL Offers** - List energy for sale at a specific price
   - Specify amount (kWh) and price per unit
   - Energy tokens auto-mint when offer created
3. **Accept BUY Offers** - Fulfill consumer energy requests
   - Check available balance (not locked in other trades)
   - Energy tokens are locked until oracle confirms delivery
4. **View Locked Balance** - See reserved tokens in pending trades
5. **View MyTrades** - Track all accepted offers and their status
   - 📜 View Renewable Energy Certificate for each trade
   - See payment received and settlement status
6. **Monitor Oracle Actions** (if oracle account)
   - Confirm deliveries and settle trades in Oracle Dashboard

**Process Flow:**
```
1. Register as Producer
2. Create SELL offer (auto-mint energy tokens)
   ↓
3. Consumer accepts → Trade created, tokens locked
   ↓
4. Oracle confirms delivery → Tokens transferred to consumer
   ↓
5. Oracle settles trade → Payment released to producer
```

---

### **Consumers** ⚡ (Energy Buyers)

Consumers register to purchase renewable energy from producers.

**Actions Available:**
1. **Register as Consumer** - Complete registration with name and wallet
2. **Browse Marketplace** - View all active SELL and BUY offers
3. **Accept SELL Offers** - Purchase energy from producers
   - Pay full amount immediately (locked in escrow)
   - Payment released only after oracle confirms delivery
4. **Create BUY Offers** - Request specific energy at a price
   - Deposit payment amount to escrow
   - Wait for producer to accept
5. **View MyTrades** - Track all accepted offers
   - 📜 View Renewable Energy Certificate for purchased energy
   - See energy received and payment status
6. **Cancel BUY Offers** - Refund escrowed payment before cancellation deadline
   - Only possible before delivery confirmation

**Process Flow:**
```
1. Register as Consumer
2. Accept SELL offer → Pay immediately to escrow
   ↓
3. If producer accepts BUY offer → Escrow payment locked
   ↓
4. Oracle confirms delivery → Energy transferred
   ↓
5. Oracle settles trade → Payment released to producer
```

---

### **Oracle** 🛡️ (Admin Account)

The oracle (deployer) manages trade settlement and delivery confirmation.

**Actions Available:**
1. **Access Oracle Dashboard** - Secure admin interface (requires oracle private key)
2. **Confirm Deliveries** - Verify energy was delivered
   - Transfers energy tokens from producer to consumer
   - Unreserves producer's locked tokens
3. **Settle Trades** - Release payment to producer
   - Marks trade as settled
   - Can only settle after delivery confirmed
4. **Cancel Trades** - Refund consumer in case of issues
   - Only before delivery confirmation
   - Unreserves producer tokens

---

## 📝 Deployment Instructions

### Step 1: Configure Environment

Create/update `.env` file with your deployment account's private key:

```bash
# .env
INFURA_API_KEY=your_infura_api_key
PRIVATE_KEY=your_deployer_private_key_here  # ⚠️ KEEP THIS SECRET!
NETWORK=sepolia
```

**⚠️ SECURITY WARNING:**
- **NEVER commit `.env` to version control**
- Use a testnet account with minimal funds
- Consider using a dedicated deployment account
- Rotate keys after deployment if using on mainnet

### Step 2: Get Deployer Address

To find your deployer's address from the private key:

```bash
node -e "const ethers = require('ethers'); const wallet = new ethers.Wallet(process.env.PRIVATE_KEY); console.log('Deployer address:', wallet.address);"
```

### Step 3: Fund Account

Visit https://www.sepolia-faucet.pk910.de/ and request testnet funds to your deployer address:
- Minimum: 0.5 Sepolia ETH recommended for gas fees

### Step 4: Deploy Contracts

```bash
npm install          # Install dependencies
npm run deploy:sepolia  # Deploy all contracts
```

**Output will show:**
```
✅ All contracts deployed successfully!

Contract Addresses:
  UserRegistry:              0x...
  EnergyToken:               0x...
  EscrowSettlement:          0x...
  EnergyMarketplace:         0x...
  RenewableEnergyCertificate: 0x...
```

### Step 5: Update Frontend Configuration

Copy the contract addresses to `frontend/.env.local`:

```bash
# frontend/.env.local
VITE_MARKETPLACE_ADDRESS=0x...
VITE_USER_REGISTRY_ADDRESS=0x...
VITE_ENERGY_TOKEN_ADDRESS=0x...
VITE_ESCROW_ADDRESS=0x...
VITE_CERTIFICATE_ADDRESS=0x...
VITE_ORACLE_PRIVATE_KEY=your_oracle_private_key  # For oracle dashboard access
VITE_NETWORK=sepolia
```

**Oracle Account Configuration:**
- `VITE_ORACLE_PRIVATE_KEY` should match the deployer's private key used in contracts
- Only accounts with this key can access the Oracle Dashboard
- The deployer is automatically granted ORACLE_ROLE during deployment

### Step 6: Verify Deployment

Check contract on Sepolia Etherscan:
```
https://sepolia.etherscan.io/address/0x[marketplace_address]
```

---

## 🎨 Frontend Setup & Running

### Install Dependencies

```bash
cd frontend
npm install
```

### Environment Configuration

Create `frontend/.env.local`:

```env
VITE_MARKETPLACE_ADDRESS=0x...
VITE_USER_REGISTRY_ADDRESS=0x...
VITE_ENERGY_TOKEN_ADDRESS=0x...
VITE_ESCROW_ADDRESS=0x...
VITE_CERTIFICATE_ADDRESS=0x...
VITE_ORACLE_PRIVATE_KEY=your_oracle_private_key
VITE_NETWORK=sepolia
```

### Run Development Server

```bash
npm run dev
```

Frontend available at: **http://localhost:5173**

### Build for Production

```bash
npm run build
npm run preview
```

---

## ✨ Project Features

### Core Features ✅

- **Bidirectional Trading**: Producers create SELL offers, Consumers create BUY offers
- **Automatic Escrow**: Payment locked until oracle confirms delivery
- **Token Locking**: Producer tokens reserved to prevent double-spending
- **Renewable Energy Certificates**: Auto-issued for each trade with:
  - Energy source tracking (Solar, Wind, Hydro, Geothermal, Biomass)
  - Validity period and expiration tracking
  - Proof of renewable energy purchase
- **Oracle Settlement**: Admin interface for confirming deliveries and settling trades
- **Role-Based Access**: Producers/Consumers have appropriate UI restrictions
- **Balance Refresh**: Automatic balance updates after all operations
- **Decimal Scaling**: Proper handling of ERC20 18-decimal tokens

### Smart Contract Features ✅

- OpenZeppelin AccessControl for role management
- Reentrancy guard protection on all state-changing functions
- Comprehensive event logging for all transactions
- Metadata storage for certificates (JSON-compatible)
- Trade history tracking for both parties
- Offer expiration management

### UI/UX Features ✅

- **Responsive Design**: Works on desktop, tablet, mobile
- **Clear Visual Feedback**: Status badges, icons, color-coding
- **MetaMask Integration**: Direct wallet connection
- **Certificate Display**: Beautiful card layout with all details
- **Trade Timeline**: Shows process progress visually
- **Error Handling**: User-friendly error messages
- **Transaction Status**: Real-time feedback on blockchain operations

### Security Features ✅

- Private key never exposed to frontend (MetaMask handles it)
- ORACLE_ROLE restricts admin operations to deployer
- Transfer approval via TRANSFER_ROLE (not user approval)
- Escrow prevents payment fraud
- Token locking prevents producer double-spending
- Reentrancy protection on all contract functions

---

## 📊 Trade Settlement Flow

```
User Registration
        ↓
    [Home Page]
        ↓
├─ Producer Path           │  Consumer Path
│      ↓                   │      ↓
│  Create SELL offer       │  Accept SELL offer OR
│  (Tokens auto-mint)      │  Create BUY offer (Pay escrow)
│      ↓                   │
│  View Marketplace        │  View Marketplace
│  Wait for consumer       │  Wait for producer
│      ↓                   │
│  Trade starts            │  Trade starts
│  (Tokens locked)         │  (Payment locked)
│      ↓──────────────────────────┘
│
├─ Oracle Path
│      ↓
│  [Oracle Dashboard]
│      ↓
│  1. Confirm Delivery
│     └─ Transfer tokens consumer
│        Unlock reserved tokens
│      ↓
│  2. Settle Trade
│     └─ Release payment to producer
│        Generate Certificate
│      ↓
│  Both parties: View completed trade + Certificate
```

---

## 🔧 Helpful Commands

### Contract Interaction

```bash
# Check contract balance
node -e "const ethers = require('ethers'); const token = new ethers.Contract('0x...', ['function balanceOf(address) view returns (uint256)'], new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/API_KEY')); token.balanceOf('0x...').then(console.log);"

# View transaction on Sepolia
# https://sepolia.etherscan.io/tx/0x[tx_hash]
```

### Testing Frontend

```bash
# Hard refresh (clear cache)
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)

# Open DevTools
F12 or Cmd+Option+I (Mac)
```

---

## 📚 Additional Resources

- [Solidity Docs](https://docs.soliditylang.org/)
- [ethers.js Documentation](https://docs.ethers.org/v6/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Sepolia Testnet Faucet](https://www.sepolia-faucet.pk910.de/)
- [Sepolia Etherscan](https://sepolia.etherscan.io/)

---

## 📄 License

MIT License - See LICENSE file for details

---

## ❓ Troubleshooting

### "Insufficient balance for gas"
→ Fund your account on Sepolia faucet: https://www.sepolia-faucet.pk910.de/

### "Contract not found"
→ Verify contract addresses in `frontend/.env.local` match deployment output

### "permission denied" on oracle actions
→ Ensure `VITE_ORACLE_PRIVATE_KEY` matches deployer's private key

### "Cannot read property 'confirm' of undefined"
→ Hard refresh browser (Ctrl+Shift+R) and ensure contracts deployed

### MetaMask shows "Wrong Network"
→ Switch to Sepolia network in MetaMask Settings → Networks → Add Network

---

**Built with ❤️ for sustainable energy trading**
