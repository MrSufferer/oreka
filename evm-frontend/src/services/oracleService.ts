import { ethers } from "ethers";

/**
 * Oracle Service for resolving Binary Option Markets using LLM
 * This service queries LLM for current price based on trading pair
 * and then calls the contract's resolveWithPrice function
 * 
 * Note: This is a client-side service that will call an API endpoint
 * to query the LLM, as LLM queries require server-side access to 0G network
 */

interface MarketInfo {
  tradingPair: string;
  maturityTime: bigint;
  currentPhase: number;
  resolved: boolean;
}

export class OracleService {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string = "http://localhost:4000/api") {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Query LLM for current price of a trading pair via API
   * @param tradingPair The trading pair (e.g., "BTC-USD", "ETH-USD")
   * @param providerAddress Optional LLM provider address
   * @returns The price value extracted from LLM response
   */
  async queryPriceFromLLM(
    tradingPair: string,
    providerAddress?: string
  ): Promise<number> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/oracle/query-price`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tradingPair,
          providerAddress,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to query price from LLM");
      }

      const data = await response.json();
      return data.price;
    } catch (error: any) {
      console.error(`Error querying LLM for price: ${error.message}`);
      throw new Error(`Failed to get price from LLM: ${error.message}`);
    }
  }

  /**
   * Resolve a market using LLM oracle via API
   * @param marketAddress The address of the BinaryOptionMarketLLM contract
   * @param contractABI The contract ABI
   * @param providerAddress Optional LLM provider address
   * @returns Transaction receipt
   */
  async resolveMarketWithLLM(
    marketAddress: string,
    tradingPair: string,
    providerAddress?: string
  ): Promise<any> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/oracle/resolve-market`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          marketAddress,
          tradingPair,
          providerAddress,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to resolve market with LLM");
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error(`Error resolving market with LLM: ${error.message}`);
      throw new Error(`Failed to resolve market: ${error.message}`);
    }
  }

  /**
   * Resolve market directly using contract interaction (requires wallet)
   * @param marketAddress The address of the BinaryOptionMarketLLM contract
   * @param contractABI The contract ABI
   * @param signer The ethers signer
   * @param tradingPair The trading pair
   * @param providerAddress Optional LLM provider address
   * @returns Transaction receipt
   */
  async resolveMarketDirect(
    marketAddress: string,
    contractABI: any[],
    signer: ethers.Signer,
    tradingPair: string,
    providerAddress?: string
  ): Promise<ethers.ContractTransactionReceipt> {
    // Get market info
    const marketContract = new ethers.Contract(
      marketAddress,
      contractABI,
      signer
    );

    // Query LLM for price
    const price = await this.queryPriceFromLLM(tradingPair, providerAddress);

    // Convert price to 8 decimals format
    const priceIn8Decimals = ethers.BigNumber.from(Math.floor(price * 1e8).toString());
    const timestamp = Math.floor(Date.now() / 1000);

    console.log(`Resolving with price: ${priceIn8Decimals.toString()} (${price} USD)`);

    // Connect signer and call resolveWithPrice
    const marketContractWithSigner = marketContract.connect(signer);
    const tx = await marketContractWithSigner.resolveWithPrice(
      priceIn8Decimals,
      timestamp
    );

    console.log(`Transaction sent: ${tx.hash}`);
    console.log(`Waiting for confirmation...`);

    const receipt = await tx.wait();
    console.log(`Market resolved! Transaction confirmed in block ${receipt?.blockNumber}`);

    return receipt!;
  }
}

