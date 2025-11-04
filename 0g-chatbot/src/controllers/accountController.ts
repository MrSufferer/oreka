import { Request, Response } from 'express';
import { brokerService } from '../services/brokerService';

/**
 * @swagger
 * /account/deposit:
 *   post:
 *     summary: Deposit funds to account
 *     tags: [Account]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Amount to deposit in ETH
 *     responses:
 *       200:
 *         description: Deposit successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const deposit = async (req: Request, res: Response) => {
  try {
    
    const { amount } = req.body;
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount required'
      });
    }
    
    const result = await brokerService.depositFunds(Number(amount));
    
    return res.status(200).json({
      success: true,
      message: result
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Helper function to convert BigInt values to strings in an object
 */
const convertBigIntToString = (data: any): any => {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (typeof data === 'bigint') {
    return data.toString();
  }
  
  if (Array.isArray(data)) {
    return data.map(item => convertBigIntToString(item));
  }
  
  if (typeof data === 'object') {
    const result: any = {};
    for (const key in data) {
      result[key] = convertBigIntToString(data[key]);
    }
    return result;
  }
  
  return data;
};

/**
 * @swagger
 * /account/info:
 *   get:
 *     summary: Get account information
 *     tags: [Account]
 *     description: Retrieve account information including ledger, infers, and fines
 *     responses:
 *       200:
 *         description: Account information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 accountInfo:
 *                   type: object
 *                   description: Account information details
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const getAccountInfo = async (req: Request, res: Response) => {
  try {
    
    const balanceInfo = await brokerService.getBalance();
    console.log(balanceInfo);
    
    // Convert BigInt values to strings
    const serializedBalanceInfo = convertBigIntToString(balanceInfo);
    
    return res.status(200).json({
      success: true,
      accountInfo: serializedBalanceInfo
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
 * /account/refund:
 *   post:
 *     summary: Request refund for unused funds
 *     tags: [Account]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Amount to refund in ETH
 *     responses:
 *       200:
 *         description: Refund requested successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const requestRefund = async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount required'
      });
    }
    
    const result = await brokerService.requestRefund(Number(amount));
    
    return res.status(200).json({
      success: true,
      message: result
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}; 