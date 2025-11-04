import { Request, Response } from 'express';
import { OracleService } from '../services/oracleService';
import { OFFICIAL_PROVIDERS } from '../services/brokerService';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

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

/**
 * @swagger
 * /oracle/resolve-market:
 *   post:
 *     summary: Resolve a Binary Option Market using LLM Oracle
 *     tags: [Oracle]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - marketAddress
 *             properties:
 *               marketAddress:
 *                 type: string
 *                 description: Address of the BinaryOptionMarketLLM contract
 *               tradingPair:
 *                 type: string
 *                 description: Optional trading pair (will be fetched from contract if not provided)
 *               providerAddress:
 *                 type: string
 *                 description: Optional LLM provider address
 *     responses:
 *       200:
 *         description: Market resolved successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const resolveMarket = async (req: Request, res: Response) => {
  try {
    const { marketAddress, tradingPair, providerAddress } = req.body;

    if (!marketAddress) {
      return res.status(400).json({
        success: false,
        error: 'Market address is required'
      });
    }

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return res.status(500).json({
        success: false,
        error: 'PRIVATE_KEY is not configured'
      });
    }

    const rpcUrl = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai";
    const defaultProvider = providerAddress || OFFICIAL_PROVIDERS["llama-3.3-70b-instruct"];

    // Initialize oracle service
    const oracleService = new OracleService(rpcUrl, privateKey, defaultProvider);

    // Get market info first
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const marketContract = new ethers.Contract(marketAddress, MARKET_ABI, provider);

    let marketTradingPair = tradingPair;
    if (!marketTradingPair) {
      marketTradingPair = await marketContract.tradingPair();
    }

    // Resolve market
    const receipt = await oracleService.resolveMarketWithLLM(
      marketAddress,
      MARKET_ABI,
      defaultProvider
    );

    return res.status(200).json({
      success: true,
      message: 'Market resolved successfully',
      transaction: {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
      },
      marketInfo: {
        tradingPair: marketTradingPair || tradingPair,
        address: marketAddress,
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @swagger
 * /oracle/query-price:
 *   post:
 *     summary: Query LLM for current price of a trading pair
 *     tags: [Oracle]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tradingPair
 *             properties:
 *               tradingPair:
 *                 type: string
 *                 description: Trading pair (e.g., BTC-USD, ETH-USD)
 *               providerAddress:
 *                 type: string
 *                 description: Optional LLM provider address
 *     responses:
 *       200:
 *         description: Price retrieved successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const queryPrice = async (req: Request, res: Response) => {
  try {
    const { tradingPair, providerAddress } = req.body;

    if (!tradingPair) {
      return res.status(400).json({
        success: false,
        error: 'Trading pair is required'
      });
    }

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return res.status(500).json({
        success: false,
        error: 'PRIVATE_KEY is not configured'
      });
    }

    const rpcUrl = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai";
    const defaultProvider = providerAddress || OFFICIAL_PROVIDERS["llama-3.3-70b-instruct"];

    // Initialize oracle service
    const oracleService = new OracleService(rpcUrl, privateKey, defaultProvider);

    // Query price
    const price = await oracleService.queryPriceFromLLM(tradingPair, defaultProvider);

    return res.status(200).json({
      success: true,
      tradingPair,
      price,
      priceIn8Decimals: Math.floor(price * 1e8).toString(),
      provider: defaultProvider,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

