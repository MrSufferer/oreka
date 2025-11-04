#!/usr/bin/env ts-node

/**
 * Script to resolve Binary Option Market using LLM Oracle
 * 
 * Usage:
 *   ts-node src/scripts/resolve-market-oracle.ts <marketAddress> [tradingPair]
 * 
 * Example:
 *   ts-node src/scripts/resolve-market-oracle.ts 0x1234... BTC-USD
 */

import { OracleService } from "../services/oracleService";
import { OFFICIAL_PROVIDERS } from "../services/brokerService";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

// Contract ABI for BinaryOptionMarketLLM
const MARKET_ABI = [
  "function getMarketInfo() external view returns (string memory tradingPair_, uint256 maturityTime_, uint8 currentPhase_, bool resolved_)",
  "function resolveWithPrice(int256 _price, uint256 _timestamp) external",
  "function tradingPair() external view returns (string memory)",
  "function maturityTime() external view returns (uint256)",
  "function currentPhase() external view returns (uint8)",
  "function resolved() external view returns (bool)",
];

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error("Usage: ts-node resolve-market-oracle.ts <marketAddress> [tradingPair]");
    console.error("Example: ts-node resolve-market-oracle.ts 0x1234... BTC-USD");
    process.exit(1);
  }

  const marketAddress = args[0];
  const tradingPair = args[1]; // Optional, will be fetched from contract if not provided

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY is required in .env file");
  }

  const rpcUrl = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai";
  const providerAddress = process.env.LLM_PROVIDER || OFFICIAL_PROVIDERS["llama-3.3-70b-instruct"];

  console.log("🚀 Starting LLM Oracle Market Resolution");
  console.log("=" .repeat(50));
  console.log(`Market Address: ${marketAddress}`);
  console.log(`RPC URL: ${rpcUrl}`);
  console.log(`LLM Provider: ${providerAddress}`);
  console.log("");

  // Initialize oracle service
  const oracleService = new OracleService(rpcUrl, privateKey, providerAddress);

  try {
    // Get market info
    const { ethers } = await import("ethers");
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const marketContract = new ethers.Contract(marketAddress, MARKET_ABI, provider);

    let marketTradingPair = tradingPair;
    if (!marketTradingPair) {
      console.log("Fetching trading pair from contract...");
      marketTradingPair = await marketContract.tradingPair();
    }

    console.log(`Trading Pair: ${marketTradingPair}`);
    console.log("");

    // Resolve market
    const receipt = await oracleService.resolveMarketWithLLM(
      marketAddress,
      MARKET_ABI,
      providerAddress
    );

    console.log("");
    console.log("✅ Market resolved successfully!");
    console.log(`Transaction Hash: ${receipt.hash}`);
    console.log(`Block Number: ${receipt.blockNumber}`);
    console.log(`Gas Used: ${receipt.gasUsed.toString()}`);

  } catch (error: any) {
    console.error("\n❌ Error resolving market:");
    console.error(`Error: ${error.message}`);
    console.error("");
    console.error("Troubleshooting:");
    console.error("1. Ensure market is in Bidding phase");
    console.error("2. Ensure market maturity time has passed");
    console.error("3. Ensure market is not already resolved");
    console.error("4. Check that wallet has sufficient balance for gas");
    console.error("5. Verify oracle address is authorized in contract");
    process.exit(1);
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log("\n✨ Script execution completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script execution failed:", error);
      process.exit(1);
    });
}

export { main };

