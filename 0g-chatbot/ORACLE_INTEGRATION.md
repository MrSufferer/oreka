# LLM Oracle Integration for Binary Option Markets

This document explains how to use the LLM-based oracle system to resolve Binary Option Markets instead of using Chainlink price feeds.

## Overview

The LLM Oracle system replaces Chainlink price feeds with queries to Large Language Models (LLMs) via the 0G Compute Network. The system works as follows:

1. **Contract**: `BinaryOptionMarketLLM.sol` - Smart contract that accepts price data from an external oracle
2. **Oracle Service**: Off-chain service that queries LLM for current prices and calls the contract
3. **Integration**: Uses the 0G chatbot broker service to query LLM models

## Architecture

### Contract (`BinaryOptionMarketLLM.sol`)

The contract replaces the Chainlink dependency with an oracle pattern:

- **Removed**: Chainlink `AggregatorV3Interface` dependency
- **Added**: `oracleAddress` - Address that can resolve markets (in addition to owner)
- **New Function**: `resolveWithPrice(int price, uint256 timestamp)` - Accepts price from oracle service
- **Access Control**: Only owner or authorized oracle address can resolve markets

### Oracle Service (`oracleService.ts`)

The oracle service:

1. Monitors markets that need resolution
2. Queries LLM for current price based on trading pair
3. Parses LLM response to extract price value
4. Calls contract's `resolveWithPrice()` function with the price

### Key Components

- **OracleService Class**: Main service for querying LLM and resolving markets
- **REST API Endpoints**: HTTP endpoints for resolving markets
- **CLI Script**: Command-line tool for manual market resolution

## Usage

### 1. Deploy the Contract

```solidity
// Deploy BinaryOptionMarketLLM contract
BinaryOptionMarketLLM market = new BinaryOptionMarketLLM(
    strikePrice,      // int256
    owner,            // address
    tradingPair,      // string (e.g., "BTC-USD")
    oracleAddress,    // address (oracle service wallet address)
    maturityTime,     // uint256
    feePercentage,    // uint256 (1-200, representing 0.1% to 20%)
    indexBg          // uint256 (1-10)
);
```

### 2. Set Up Oracle Service

Configure environment variables in `.env`:

```env
PRIVATE_KEY=your_oracle_service_private_key
RPC_URL=https://evmrpc-testnet.0g.ai
LLM_PROVIDER=0xf07240Efa67755B5311bc75784a061eDB47165Dd  # Optional, defaults to llama-3.3-70b-instruct
```

### 3. Resolve Market via REST API

```bash
curl -X POST http://localhost:4000/api/oracle/resolve-market \
  -H "Content-Type: application/json" \
  -d '{
    "marketAddress": "0x1234...",
    "tradingPair": "BTC-USD",
    "providerAddress": "0xf07240Efa67755B5311bc75784a061eDB47165Dd"
  }'
```

### 4. Resolve Market via CLI Script

```bash
ts-node src/scripts/resolve-market-oracle.ts 0x1234... BTC-USD
```

### 5. Query Price Only (without resolving)

```bash
curl -X POST http://localhost:4000/api/oracle/query-price \
  -H "Content-Type: application/json" \
  -d '{
    "tradingPair": "BTC-USD",
    "providerAddress": "0xf07240Efa67755B5311bc75784a061eDB47165Dd"
  }'
```

## API Endpoints

### POST `/api/oracle/resolve-market`

Resolve a Binary Option Market using LLM Oracle.

**Request Body:**
```json
{
  "marketAddress": "0x1234...",
  "tradingPair": "BTC-USD",  // Optional, will be fetched from contract
  "providerAddress": "0xf07240Efa67755B5311bc75784a061eDB47165Dd"  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Market resolved successfully",
  "transaction": {
    "hash": "0x...",
    "blockNumber": "12345",
    "gasUsed": "150000"
  },
  "marketInfo": {
    "tradingPair": "BTC-USD",
    "address": "0x1234..."
  }
}
```

### POST `/api/oracle/query-price`

Query LLM for current price of a trading pair without resolving a market.

**Request Body:**
```json
{
  "tradingPair": "BTC-USD",
  "providerAddress": "0xf07240Efa67755B5311bc75784a061eDB47165Dd"  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "tradingPair": "BTC-USD",
  "price": 50000.5,
  "priceIn8Decimals": "5000050000000",
  "provider": "0xf07240Efa67755B5311bc75784a061eDB47165Dd"
}
```

## LLM Query Format

The oracle service queries the LLM with a specific format:

```
What is the current price of {tradingPair}? Please provide only the numerical price value in USD, without any currency symbols, commas, or additional text. For example, if the price is $50,000, respond with only: 50000
```

The LLM response is then parsed to extract the numerical price value.

## Price Format

- **LLM Returns**: Price in standard format (e.g., 50000 for $50,000)
- **Contract Expects**: Price in 8 decimals format (e.g., 5000000000000 for $50,000)
- **Conversion**: Price is multiplied by 10^8 before being sent to contract

## Monitoring Markets

The oracle service includes a monitoring function that can automatically resolve markets:

```typescript
import { OracleService } from './services/oracleService';
import { MARKET_ABI } from './contracts';

const oracleService = new OracleService(rpcUrl, privateKey);

// Monitor and auto-resolve markets
await oracleService.monitorAndResolveMarkets(
  ['0x1234...', '0x5678...'],  // Market addresses
  MARKET_ABI,
  60000  // Check interval in milliseconds (1 minute)
);
```

## Differences from Chainlink Version

### Contract Changes

| Feature | Chainlink Version | LLM Version |
|---------|------------------|-------------|
| Price Source | Chainlink Data Feed | LLM Oracle Service |
| Resolution | `resolveMarket()` calls Chainlink directly | `resolveWithPrice()` accepts price parameter |
| Dependencies | Requires Chainlink Aggregator | No external price feed dependency |
| Oracle | Built-in Chainlink integration | External oracle service |
| Access Control | Anyone can call `resolveMarket()` | Only owner or authorized oracle |

### Advantages

1. **No Chainlink Dependency**: Works on any EVM-compatible chain
2. **Flexible Price Sources**: Can query any LLM for price data
3. **Customizable Queries**: Can ask LLM for specific price information
4. **Decentralized AI**: Uses 0G Compute Network for decentralized AI queries

### Considerations

1. **Price Accuracy**: LLM responses may vary, ensure prompt engineering for consistent results
2. **Response Time**: LLM queries may take longer than Chainlink price feeds
3. **Cost**: Each LLM query has associated costs (0G tokens)
4. **Oracle Trust**: Requires trust in the oracle service operator

## Security Considerations

1. **Oracle Address**: Set the oracle address carefully, as it can resolve markets
2. **Price Validation**: Consider adding price validation in the contract (e.g., sanity checks)
3. **Multiple Oracles**: Consider implementing multi-oracle consensus for critical markets
4. **Timelock**: Consider adding a timelock for oracle resolution to prevent front-running

## Troubleshooting

### Market Not Resolving

1. Check market is in Bidding phase (`currentPhase == 1`)
2. Verify maturity time has passed
3. Ensure market is not already resolved
4. Check oracle address is authorized in contract

### LLM Query Fails

1. Verify provider is acknowledged
2. Check account has sufficient balance for LLM queries
3. Ensure provider address is correct
4. Check network connectivity

### Price Parsing Errors

1. LLM response may not be in expected format
2. Consider improving the prompt for better results
3. Add additional parsing logic if needed

## Example Workflow

1. **Deploy Contract**: Create a new BinaryOptionMarketLLM contract
2. **Set Oracle**: Configure oracle address in contract (if not set in constructor)
3. **Market Goes Live**: Market starts in Trading phase
4. **Start Bidding**: Owner calls `startBidding()` to begin Bidding phase
5. **Users Bid**: Users place bids during Bidding phase
6. **Maturity Reached**: Market maturity time arrives
7. **Oracle Resolves**: Oracle service queries LLM and calls `resolveWithPrice()`
8. **Users Claim**: Users call `claimReward()` after market expires

## Next Steps

- Add price validation and bounds checking
- Implement multi-oracle consensus mechanism
- Add event monitoring for automatic resolution
- Create market monitoring dashboard
- Implement price history tracking

