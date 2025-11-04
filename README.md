# Oreka Multi-Chain Binary Option Market

## Features

- Create binary option markets for any trading pair
- Support for Chainlink and LLM oracles
- Bid on Long or Short positions
- Automatic market resolution using real-time price data
- Claim rewards when a market resolves in your favor

## Deployment Addresses

### 0G Galileo Testnet
- **LLM Factory**: `0xbD50d4EdFf462C845887cD58C17Bab4991A9A643`
- **Chain ID**: 16602 (0x40da)
- **RPC URL**: `https://evmrpc-testnet.0g.ai`

## App Flow

### Market Creation Flow
1. **Select Oracle Type**: Choose between Chainlink (traditional) or LLM (AI-powered) oracle
2. **Configure Market**: Set trading pair, strike price, maturity time, and fee percentage
3. **For LLM Markets**: Provide oracle wallet address authorized to resolve markets
4. **Deploy**: Contract is deployed via factory (Chainlink) or LLM Factory (LLM markets)

### Trading Flow
1. **Bidding Phase**: Users place bids on Long (price >= strike) or Short (price < strike)
2. **Market Resolution**: 
   - **Chainlink**: Automatic resolution via Chainlink price feeds
   - **LLM**: Oracle service queries LLM via 0G Network and calls `resolveWithPrice()`
3. **Reward Claiming**: Winners claim rewards proportional to their bid amount

## Running the Frontend

### Prerequisites
- Node.js 16+ and npm
- MetaMask or compatible wallet
- Testnet ETH for transactions

### Quick Start

1. **Navigate to frontend**:
   ```bash
   cd evm-frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Open browser**:
   - Navigate to `http://localhost:3000`
   - Connect your wallet
   - Switch to 0G Galileo Testnet (Chain ID: 16602)

### Environment Variables (Optional)

Create `.env.local` in `evm-frontend/`:
```env
NEXT_PUBLIC_LLM_FACTORY_ADDRESS=0xbD50d4EdFf462C845887cD58C17Bab4991A9A643
NEXT_PUBLIC_ORACLE_API_URL=http://localhost:4000/api
```

## Work-In-Progress 🚧

- **Liquidity Tree AMM Design Diagram**
```
                                  +-------------------+
                                  |   Liquidity Tree  |
                                  |   AMM for Markets |
                                  +-------------------+
                                           |
                          +----------------+---------------+
                          |                                |
              +-----------v------------+      +-----------v------------+
              |    Liquidity Pool      |      |   Prediction Markets   |
              |  (Single Token Pool)   <----->|   (Betting Conditions) |
              +-----------+------------+      +-----------+------------+
                          |                                |
      +-------------------+-------------------+            |
      |                   |                   |            |
+-----v------+     +-----v------+     +------v-----+      |
|   Leaf 1   |     |   Leaf 2   |     |   Leaf 3   |      |
| (LP Node)  |     | (LP Node)  |     | (LP Node)  |      |
+-----+------+     +-----+------+     +------+-----+      |
      |                   |                   |            |
      |                   |                   |            |
+-----v------+     +-----v------+     +------v-----+      |
| Liquidity  |     | Liquidity  |     | Liquidity  |      |
| Provider 1 |     | Provider 2 |     | Provider 3 |      |
+------------+     +------------+     +------------+      |
                                                          |
                          +-------------------------------|
                          |                               |
               +----------v-----------+      +------------v-----------+
               |  Market Resolution   |      |   Outcome Settlement   |
               | (Oracle Resolution)  |      | (Profit/Loss Handling) |
               +----------------------+      +------------------------+
```

## License

MIT License - see LICENSE file for details.
