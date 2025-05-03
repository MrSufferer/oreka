# ICP Prediction Market Layer 🎯

A decentralized binary options trading platform built on the Internet Computer Protocol (ICP), allowing users to make price direction predictions on cryptocurrency pairs.

## Overview 🌟

The Binary Options Market is a proof-of-concept prediction market that leverages ICP's infrastructure to create a transparent and decentralized trading environment. Users can participate by predicting whether an asset's price will go up or down within a specified timeframe.

### Key Features
- 📈 Resolved with price feeds via HTTP Outcalls
- ⚡ 30-second trading windows
- 🎲 Entire-pool reward/loss per correct/incorrect prediction
- 🔒 Secure identity management via Internet Identity
- 💱 Support for multiple cryptocurrency pairs
- 🏭 Factory canister for deploying custom markets

## Demo 🎮

![Trading Interface](./docs/images/UI-demo.png)

- [Demo 1](https://drive.google.com/file/d/1C3wPzyXKbTXys8lZsR3-WREsOCCNbdZB/view?usp=sharing)
- [Demo 2](https://drive.google.com/file/d/1P47yfKLGNXfwjS3YHDA9k1iZrf9nMMRy/view?usp=sharing)

![Diagram](./docs/images/diagram.png)
## Architecture 📐

The project consists of three main components:

1. **Factory Canister** (`canisters/factory/`)
   - Creates and manages binary option market canisters
   - Allows customization of trading pairs and fees
   - Tracks deployed markets by owner
   - Manages canister lifecycle

2. **Binary Option Market Canister** (`canisters/binary_option_market/`)
   - Core trading/managing logic
   - HTTP Outcalls for price feeds based on trading pairs
   - State management
   - Account management
   - Support for customizable fees
   - Public resolveMarket function

3. **Frontend** (`icp-asset/`)
   - React/Next.js interface
   - Internet Identity integration
   - Real-time updates
   - Market creation and management UI

### Factory Canister Architecture

The Factory Canister serves as the central hub for creating and managing Binary Option Markets. It provides the following capabilities:

x#### Key Components

1. **Market Deployment**
   - Creates customizable prediction markets with:
     - Custom trading pairs (e.g., "ICP-USD", "BTC-USD")
     - Customizable fee structures
     - Configurable maturity times
     - Unique strike prices

2. **Contract Management**
   - Tracks all deployed contracts
   - Filters contracts by owner
   - Manages canister settings and controllers

3. **Events Tracking**
   - Records deployment events
   - Maintains historical market creation data

#### Data Structures

- `Contract`: Stores metadata about each deployed market
- `ContractType`: Categorizes different types of contracts
- `DeployEvent`: Records market creation events

#### Deployment Flow

1. User calls `deployMarket` with parameters
2. Factory creates a new canister
3. Factory installs Binary Option Market code with provided parameters
4. Factory sets controllers for the new canister
5. Factory records the new market in its registry

## Technical Stack 🛠

- **Backend**: Motoko
- **Frontend**: Next.js, TypeScript, Chakra UI
- **Identity**: Internet Identity
- **Price Feeds**: HTTP Outcalls
- **State Management**: Redux Toolkit

## Getting Started 🚀

### Prerequisites
- dfx CLI
- Node.js >= 14
- NPM

### Local Development

1. Start the local replica:

```bash
cd oreka/

dfx start --clean
```

2. Deploy the Factory and Binary Option Market canister:

```bash
export MINTER=$(dfx --identity anonymous identity get-principal)
export DEFAULT=$(dfx identity get-principal)

# deploy icp_ledger_canister dependency first
dfx deploy icp_ledger_canister --argument "(variant { Init =
record {
     token_symbol = \"ICRC1\";
     token_name = \"L-ICRC1\";
     minting_account = record { owner = principal \"${MINTER}\" };
     transfer_fee = 10_000;
     metadata = vec {};
     initial_balances = vec { record { record { owner = principal \"${DEFAULT}\"; }; 10_000_000_000; }; };
     archive_options = record {
         num_blocks_to_archive = 1000;
         trigger_threshold = 2000;
         controller_id = principal \"${MINTER}\";
     };
     feature_flags = opt record {
         icrc2 = true;
     };
 }
})"

# transfer ICP to player
dfx canister call icp_ledger_canister icrc1_transfer "(record {
  to = record {
    owner = principal \"${DEFAULT}\";
  };
  amount = 1_000_000_000;
})"

# deploy factory canister
dfx deploy factory

# (Optional) Deploy a test market directly for testing
dfx deploy binary_option_market --argument '(12.0, 1743880750, "ICP-USD", 10)'

# optional: deploy test canister
dfx deploy binary_option_market_test
dfx canister call binary_option_market_test test
```

3. Install frontend dependencies:

```bash
# deploy the internet identity
dfx deps deploy

cd icp-asset
npm install --legacy-peer-deps
```

4. Start the frontend development server:

```bash
npm run dev
```

### Creating a Market

You can create a new market through the factory canister with:

```bash
dfx canister call factory deployMarket '("My Market", 12.0, 3600000000000, 10, "ICP-USD")'
```

Parameters:
- `"My Market"`: Market name
- `12.0`: Strike price (float)
- `3600000000000`: Maturity time in nanoseconds (1 hour)
- `10`: Fee percentage (10%)
- `"ICP-USD"`: Trading pair

## Project Status 📊

Current Features:
- ✅ Core prediction market contracts
- ✅ HTTP Outcalls price feed integration
- ✅ Basic trading interface
- ✅ Internet Identity integration
- ✅ Factory for deploying custom markets
- ✅ Support for multiple cryptocurrency pairs

Roadmap:
- 🔄 Advanced trading features
- 🔄 Multi-asset support
- 🔄 Shared liquidity infrastructure

## Future Development 🔮

We have exciting plans to enhance the platform:

1. **ChainFusion Integration**
   - Implementation of ChainFusion as an oracle solution
   - Support for EVM-compatible smart contracts

2. **Shared Liquidity Infrastructure**
   - Cross-chain liquidity pools
   - Unified prediction market ecosystem

## Contributing 🤝

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments 🙏

- DFINITY Foundation
- Internet Computer Community

## Contact 📧

For questions and support, please open an issue or reach out to the maintainers.

## Deployment Backend API

The project now includes a dedicated API for automating the deployment of WASM modules to created canisters. This eliminates the need to manually run the `deploy-market.sh` script after creating a market.

### Running the Deployment API

1. Install the required dependencies:
   ```
   npm install
   ```

2. Start the API server:
   ```
   npm run start:api
   ```

3. For development with auto-reload:
   ```
   npm run dev:api
   ```

The API server runs on port 3001 by default. You can change this by setting the `API_PORT` environment variable.

### API Endpoints

- `GET /health` - Health check endpoint
- `POST /api/deploy/market` - Deploy WASM to a market canister
  - Body parameters:
    - `canisterId` - The canister ID to deploy to
    - `strikePrice` - The strike price for the market
    - `maturityTimestamp` - The maturity timestamp in seconds
    - `feePercentage` - The fee percentage (0-100)
    - `tradingPair` - The trading pair (default: ICP-USD)
- `GET /api/deploy/status/:canisterId` - Check deployment status of a canister

### Configuration

Configure the frontend to use the API by setting these environment variables:

```
NEXT_PUBLIC_DEPLOYMENT_API_URL=http://localhost:3001/api/deploy
```

---

Built with ❤️ for the Internet Computer ecosystem.

# Binary Option Market with Flare FTSO

This project implements a binary option market smart contract that uses Flare's Time Series Oracle (FTSO) for price feeds. It allows users to create and participate in binary option markets for various trading pairs available on the Flare Network.

## Overview

Binary options are financial instruments that provide a fixed payout if the market reaches or exceeds a predetermined strike price at maturity. This project implements this concept as a decentralized application on the Flare Network.

## Contracts

- **BinaryOptionMarketFlare**: The main contract that implements the binary option market using Flare's FTSO for price feeds.
- **BinaryOptionMarketFlareFactory**: A factory contract that deploys new BinaryOptionMarketFlare contracts.
- **FlarePriceFeedHelper**: A helper contract with common FTSO price feed IDs and utility functions.

## Features

- Create binary option markets for any trading pair supported by Flare's FTSO
- Bid on Long or Short positions for a market
- Automatic market resolution using real-time price data from Flare's FTSO
- Claim rewards when a market resolves in your favor
- Low gas fees due to Flare's efficient blockchain

## How It Works

1. **Market Creation**: Anyone can create a binary option market by specifying a trading pair, strike price, and maturity time.
2. **Bidding Phase**: Users can place bids on either the Long side (price will be >= strike price) or Short side (price will be < strike price).
3. **Market Resolution**: At maturity time, the market owner can trigger resolution, which will fetch the current price from Flare's FTSO.
4. **Reward Claiming**: If your chosen side wins, you can claim your reward proportional to your bid amount.

## Price Feed IDs

Flare's FTSO provides price feeds for various trading pairs. Each trading pair is identified by a unique `bytes21` ID. Common price feed IDs are available in the `FlarePriceFeedHelper` contract.

Examples:
- FLR/USD: `0x01464c522f55534400000000000000000000000000`
- BTC/USD: `0x014254432f55534400000000000000000000000000`
- ETH/USD: `0x014554482f55534400000000000000000000000000`

## Getting Started

### Prerequisites

- Node.js and npm installed
- Access to a Flare Network node (mainnet or testnet)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/binary-option-market-flare.git
   cd binary-option-market-flare
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Compile contracts:
   ```
   npm run compile
   ```

### Deployment

#### Testnet (Coston2)

To deploy to Flare's Coston2 testnet:

```
npm run deploy-testnet
```

#### Mainnet

To deploy to Flare's mainnet:

```
npm run deploy-mainnet
```

## Usage Examples

### Creating a Market

```javascript
// Get the factory contract
const factory = await ethers.getContractAt("BinaryOptionMarketFlareFactory", factoryAddress);

// Create a market for BTC/USD with a strike price of 50000 USD
// maturity time is 24 hours from now
const maturityTime = Math.floor(Date.now() / 1000) + 86400;
const btcUsdFeedId = "0x014254432f55534400000000000000000000000000"; // BTC/USD
await factory.createMarket(
  "BTC/USD",
  btcUsdFeedId,
  ethers.utils.parseUnits("50000", 18), // Strike price
  maturityTime,
  10, // 1% fee
  1 // Background index
);
```

### Placing a Bid

```javascript
// Get the market contract
const market = await ethers.getContractAt("BinaryOptionMarketFlare", marketAddress);

// Place a bid on the Long side
await market.bid(0, { value: ethers.utils.parseEther("1.0") });

// Place a bid on the Short side
await market.bid(1, { value: ethers.utils.parseEther("1.0") });
```

### Resolving a Market

```javascript
// Only the market owner can resolve the market
await market.resolveMarket();
```

### Claiming Rewards

```javascript
// Any user can claim rewards if they won
await market.claimReward();
```

## Networks

- **Flare Mainnet**: Chain ID 14
- **Coston2 Testnet**: Chain ID 114

## License

This project is licensed under the MIT License - see the LICENSE file for details.
