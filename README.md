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
   git clone https://github.com/MrSufferer/oreka.git
   cd oreka
   cd evm-frontend
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
