# Binary Option Market

## Features

- Create binary option markets for any trading pair
- Bid on Long or Short positions for a market
- Automatic market resolution using real-time price data 
- Claim rewards when a market resolves in your favor

## How It Works

1. **Market Creation**: Anyone can create a binary option market by specifying a trading pair, strike price, and maturity time.
2. **Bidding Phase**: Users can place bids on either the Long side (price will be >= strike price) or Short side (price will be < strike price).
3. **Market Resolution**: At maturity time, the market owner can trigger resolution, which will fetch the current price.
4. **Reward Claiming**: If your chosen side wins, you can claim your reward proportional to your bid amount.

## Getting Started

### Prerequisites

- Node.js and npm installed
- Access to a OG Network node (mainnet or testnet)

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

## License

This project is licensed under the MIT License - see the LICENSE file for details.
