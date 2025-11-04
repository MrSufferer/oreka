import { ethers } from "ethers";
import { brokerService, OFFICIAL_PROVIDERS } from "./brokerService";

/**
 * Oracle Service for resolving Binary Option Markets using LLM
 * This service queries LLM for current price based on trading pair
 * and then calls the contract's resolveWithPrice function
 */

interface MarketInfo {
  tradingPair: string;
  maturityTime: bigint;
  currentPhase: number;
  resolved: boolean;
}

export class OracleService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private defaultProviderAddress: string;

  constructor(
    rpcUrl: string,
    privateKey: string,
    defaultProviderAddress: string = OFFICIAL_PROVIDERS["llama-3.3-70b-instruct"]
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.defaultProviderAddress = defaultProviderAddress;
  }

  /**
   * Query LLM for current price of a trading pair
   * @param tradingPair The trading pair (e.g., "BTC-USD", "ETH-USD")
   * @param providerAddress Optional LLM provider address
   * @returns The price value extracted from LLM response
   */
  async queryPriceFromLLM(
    tradingPair: string,
    providerAddress?: string
  ): Promise<number> {
    const provider = providerAddress || this.defaultProviderAddress;

    // Construct query for LLM
    const query = `What is the current price of ${tradingPair}? Please provide only the numerical price value in USD, without any currency symbols, commas, or additional text. For example, if the price is $50,000, respond with only: 50000`;

    console.log(`Querying LLM for ${tradingPair} price...`);
    console.log(`Query: ${query}`);

    try {
      // Ensure provider is acknowledged
      await brokerService.acknowledgeProvider(provider).catch((err) => {
        if (!err.message.includes("already acknowledged")) {
          console.warn(`Provider acknowledgment warning: ${err.message}`);
        }
      });

      // Query LLM
      const result = await brokerService.sendQuery(provider, query);

      if (!result.content) {
        throw new Error("LLM response has no content");
      }

      console.log(`LLM Response: ${result.content}`);

      // Parse price from response
      const price = this.parsePriceFromResponse(result.content);
      console.log(`Parsed Price: ${price}`);

      return price;
    } catch (error: any) {
      console.error(`Error querying LLM for price: ${error.message}`);
      throw new Error(`Failed to get price from LLM: ${error.message}`);
    }
  }

  /**
   * Parse price value from LLM response text
   * @param response The LLM response text
   * @returns The numerical price value
   */
  private parsePriceFromResponse(response: string): number {
    // Remove all non-numeric characters except decimal point
    const cleaned = response.replace(/[^\d.]/g, "");
    
    if (!cleaned) {
      throw new Error("No numeric value found in LLM response");
    }

    const price = parseFloat(cleaned);
    
    if (isNaN(price) || price <= 0) {
      throw new Error(`Invalid price value parsed: ${price}`);
    }

    return price;
  }

  /**
   * Resolve a market using LLM oracle
   * @param marketAddress The address of the BinaryOptionMarketLLM contract
   * @param contractABI The contract ABI
   * @param providerAddress Optional LLM provider address
   * @returns Transaction receipt
   */
  async resolveMarketWithLLM(
    marketAddress: string,
    contractABI: any[],
    providerAddress?: string
  ): Promise<ethers.ContractTransactionReceipt> {
    console.log(`Resolving market at ${marketAddress}...`);

    // Get market info
    const marketContract = new ethers.Contract(
      marketAddress,
      contractABI,
      this.provider
    );

    const marketInfo: MarketInfo = await marketContract.getMarketInfo();
    const { tradingPair, maturityTime, currentPhase, resolved } = marketInfo;

    console.log(`Market Info:`, {
      tradingPair,
      maturityTime: maturityTime.toString(),
      currentPhase,
      resolved,
    });

    // Check if market is ready to resolve
    if (resolved) {
      throw new Error("Market is already resolved");
    }

    if (currentPhase !== 1) {
      // Phase 1 = Bidding
      throw new Error(`Market not in bidding phase. Current phase: ${currentPhase}`);
    }

    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    if (currentTime < maturityTime) {
      throw new Error(`Market not yet mature. Maturity time: ${maturityTime.toString()}`);
    }

    // Query LLM for price
    const price = await this.queryPriceFromLLM(tradingPair, providerAddress);

    // Convert price to 8 decimals format (assuming LLM returns price in standard format)
    // For example, if BTC price is $50,000, we need 5000000000000 (50,000 * 10^8)
    const priceIn8Decimals = BigInt(Math.floor(price * 1e8));
    const timestamp = BigInt(Math.floor(Date.now() / 1000));

    console.log(`Resolving with price: ${priceIn8Decimals.toString()} (${price} USD)`);

    // Connect wallet and call resolveWithPrice
    const marketContractWithSigner = marketContract.connect(this.wallet);
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

  /**
   * Monitor markets and resolve them when ready
   * @param marketAddresses Array of market addresses to monitor
   * @param contractABI The contract ABI
   * @param checkInterval Interval in milliseconds to check markets
   */
  async monitorAndResolveMarkets(
    marketAddresses: string[],
    contractABI: any[],
    checkInterval: number = 60000 // 1 minute default
  ) {
    console.log(`Starting market monitor for ${marketAddresses.length} markets...`);
    console.log(`Check interval: ${checkInterval}ms`);

    const checkMarkets = async () => {
      for (const marketAddress of marketAddresses) {
        try {
          const marketContract = new ethers.Contract(
            marketAddress,
            contractABI,
            this.provider
          );

          const marketInfo: MarketInfo = await marketContract.getMarketInfo();
          const { maturityTime, currentPhase, resolved } = marketInfo;

          // Check if market needs resolution
          if (!resolved && currentPhase === 1) {
            // Phase 1 = Bidding
            const currentTime = BigInt(Math.floor(Date.now() / 1000));
            if (currentTime >= maturityTime) {
              console.log(`Market ${marketAddress} is ready to resolve`);
              await this.resolveMarketWithLLM(marketAddress, contractABI);
            }
          }
        } catch (error: any) {
          console.error(
            `Error checking market ${marketAddress}: ${error.message}`
          );
        }
      }
    };

    // Check immediately
    await checkMarkets();

    // Set up interval
    setInterval(checkMarkets, checkInterval);
  }
}

