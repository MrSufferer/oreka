import { Actor } from "@dfinity/agent";
import { binaryOptionMarketActor } from "./actor-locator";
import { Principal } from "@dfinity/principal";

// Interface defining the service contract
export interface IBinaryOptionMarketService {
    bid(side: { Long: null } | { Short: null }, amount: number | bigint | null): Promise<{ ok: string } | { err: string }>;
    claimReward(): Promise<void>;
    getCurrentPhase(): Promise<{ Bidding: null } | { Trading: null } | { Maturity: null } | { Expiry: null }>;
    getMarketDetails(marketId?: string): Promise<{
        resolved: boolean;
        oracleDetails: { finalPrice: number; strikePrice: number };
        positions: { long: bigint; short: bigint };
        tradingPair?: string;
        owner?: Principal;
        currentPhase?: { Bidding: null } | { Trading: null } | { Maturity: null } | { Expiry: null };
        createTimestamp?: bigint;
        endTimestamp?: bigint;
    }>;
    getUserPosition(principal: Principal | null): Promise<{ long: bigint; short: bigint } | null>;
    hasUserClaimed(principal: Principal | null): Promise<boolean | null>;
    getContractBalance(): Promise<bigint>;
    getTotalDeposit(): Promise<bigint>;
    getBidders(): Promise<{
        long: Array<[Principal, bigint]>;
        short: Array<[Principal, bigint]>;
    }>;
    getIcpUsdExchange(): Promise<string>;
    startTrading(): Promise<void>;
    resolveMarket(): Promise<void>;
    expireMarket(): Promise<void>;
    getAllMarkets(): Promise<string[]>;
    getPrice(tradingPair: string): Promise<number>;
}

// Base abstract class for market services
abstract class BaseMarketService {
    protected actor: any = null;

    abstract initialize(canisterId?: string): Promise<void>;
    protected assertInitialized(): void {
        if (!this.actor) {
            throw new Error("Service not initialized");
        }
    }
}
// Concrete implementation
export class BinaryOptionMarketService extends BaseMarketService implements IBinaryOptionMarketService {
    private static instance: BinaryOptionMarketService;
    private prices: { [pair: string]: number } = {};
    private priceUpdateIntervals: { [pair: string]: NodeJS.Timeout } = {};

    private constructor() {
        super();
    }


    // Singleton pattern
    public static getInstance(): BinaryOptionMarketService {
        if (!BinaryOptionMarketService.instance) {
            BinaryOptionMarketService.instance = new BinaryOptionMarketService();
        }
        return BinaryOptionMarketService.instance;
    }

    public async initialize(canisterId?: string): Promise<void> {
        // Reset actor if a different canister ID is provided
        if (canisterId && this.actor) {
            console.log("Reinitializing with new canister ID:", canisterId);
            this.actor = null;
        }

        if (!this.actor) {
            if (canisterId) {
                // Import dynamically to avoid circular dependencies
                const { Actor, HttpAgent } = await import("@dfinity/agent");
                const { idlFactory } = await import("../declarations/binary_option_market/binary_option_market.did.js");

                // Get the properly authenticated actor
                try {
                    // Import the getActor function to get an authenticated actor
                    const { getActor } = await import("./actor-locator");
                    this.actor = await getActor(idlFactory, canisterId);
                    console.log(`Initialized binary option market actor with custom canister ID: ${canisterId} and authenticated identity`);
                } catch (error) {
                    console.error("Failed to get authenticated actor, falling back to default agent:", error);

                    // Fallback to creating a new agent if getting the authenticated actor fails
                    const agent = new HttpAgent({
                        host: process.env.NEXT_PUBLIC_IC_HOST || "http://localhost:4943",
                    });

                    // Only fetch the root key in development
                    if (process.env.NODE_ENV !== 'production') {
                        await agent.fetchRootKey().catch(err => {
                            console.warn('Unable to fetch root key. Check to ensure local replica is running');
                            console.error(err);
                        });
                    }

                    this.actor = Actor.createActor(idlFactory, {
                        agent,
                        canisterId,
                    });
                    console.log(`Initialized binary option market actor with custom canister ID: ${canisterId} (unauthenticated)`);
                }
            } else {
                // Use the default actor
                this.actor = binaryOptionMarketActor;
                console.log("Initialized binary option market actor with default canister ID");
            }
        }

        // Initialize price fetching for common trading pairs
        this.startPriceFetching('BTC/USD');
        this.startPriceFetching('ETH/USD');
        this.startPriceFetching('ICP/USD');
    }

    public async bid(side: { Long: null } | { Short: null }, amount: number | bigint | null): Promise<{ ok: string } | { err: string }> {
        this.assertInitialized();
        const bidAmount = amount !== null ? (typeof amount === 'number' ? BigInt(amount) : amount) : null;

        return await this.actor?.bid(side, bidAmount);
    }

    public async claimReward(): Promise<void> {
        this.assertInitialized();
        return await this.actor.claimReward();
    }

    public async getCurrentPhase() {
        this.assertInitialized();
        return await this.actor.getCurrentPhase();
    }

    public async getEndTimestamp() {
        this.assertInitialized();
        return await this.actor.getEndTimestamp();
    }

    public async getMarketDetails(marketId?: string) {
        this.assertInitialized();

        // If marketId is provided, get details for specific market
        if (marketId) {
            // This is a mock implementation until backend support is added
            // In a real implementation, you would call a canister method with the marketId
            // Return mock data for now that matches the structure needed by ListAddressOwner
            return {
                resolved: false,
                oracleDetails: { finalPrice: 0, strikePrice: 100000000 }, // Example value (1 USD with 8 decimals)
                positions: { long: BigInt(0), short: BigInt(0) },
                tradingPair: "ICP/USD",
                owner: Principal.fromText("2vxsx-fae"),
                currentPhase: { Trading: null },
                createTimestamp: BigInt(Math.floor(Date.now() / 1000) - 86400), // 1 day ago
                endTimestamp: BigInt(Math.floor(Date.now() / 1000) + 86400) // 1 day from now
            };
        }

        // Otherwise get details for current market
        return await this.actor.getMarketDetails();
    }

    public async getUserPosition(principal: Principal | null): Promise<{ long: bigint; short: bigint } | null> {
        this.assertInitialized();
        if (this.actor) {
            return await this.actor.getUserPosition(principal);
        }
        throw new Error("Actor is not initialized");
    }

    public async hasUserClaimed(principal: Principal | null): Promise<boolean | null> {
        this.assertInitialized();
        if (this.actor) {
            return await this.actor.hasUserClaimed(principal);
        }
        throw new Error("Actor is not initialized");
    }

    public async getContractBalance() {
        this.assertInitialized();
        return await this.actor.getContractBalance();
    }

    public async getTotalDeposit() {
        this.assertInitialized();
        return await this.actor.getTotalDeposit();
    }

    public async getBidders() {
        this.assertInitialized();
        return await this.actor.getBidders();
    }

    public async getIcpUsdExchange() {
        this.assertInitialized();
        return await this.actor.get_icp_usd_exchange();
    }

    // Owner functions

    /**
     * Starts the trading phase (owner only)
     */
    public async startTrading(): Promise<void> {
        this.assertInitialized();
        return await this.actor.startTrading();
    }

    /**
     * Resolves the market using price feed data (anyone can call)
     */
    public async resolveMarket(): Promise<void> {
        this.assertInitialized();
        return await this.actor.resolveMarket();
    }

    /**
     * Expires the market (owner only)
     */
    public async expireMarket(): Promise<void> {
        this.assertInitialized();
        return await this.actor.expireMarket();
    }

    /**
     * Get all available markets
     * This is a mock implementation until backend support is added
     */
    public async getAllMarkets(): Promise<string[]> {
        this.assertInitialized();

        // Mock implementation - will need to be replaced with actual canister call
        // In a real implementation, you would call a canister method that returns all market IDs
        // Generate 10 mock market IDs with different timestamps
        const markets = [];
        const now = Math.floor(Date.now() / 1000);

        // Create some markets in different phases
        for (let i = 1; i <= 10; i++) {
            const marketId = `market${i}`;
            markets.push(marketId);
        }

        return markets;
    }

    // Price service methods

    // Method to start fetching prices for a specific trading pair
    private startPriceFetching(tradingPair: string): void {
        // Set initial prices
        this.fetchPrice(tradingPair).then(price => {
            this.prices[tradingPair] = price;
        });

        // Set up interval to update prices (every 15 seconds)
        this.priceUpdateIntervals[tradingPair] = setInterval(async () => {
            try {
                const price = await this.fetchPrice(tradingPair);
                this.prices[tradingPair] = price;
            } catch (error) {
                console.error(`Error updating price for ${tradingPair}:`, error);
            }
        }, 15000);
    }

    // Method to fetch price from an API
    private async fetchPrice(tradingPair: string): Promise<number> {
        try {
            // Convert trading pair format from BTC/USD to BTC-USD for API
            const formattedPair = tradingPair.replace('/', '-');

            // Fetch from Coinbase API
            const response = await fetch(`https://api.coinbase.com/v2/prices/${formattedPair}/spot`);
            const data = await response.json();

            if (data.data && data.data.amount) {
                return parseFloat(data.data.amount);
            }

            // Fallback to mock prices if API fails
            return this.getMockPrice(tradingPair);
        } catch (error) {
            console.error(`Error fetching price for ${tradingPair}:`, error);
            return this.getMockPrice(tradingPair);
        }
    }

    // Get cached price or return mock price
    async getPrice(tradingPair: string): Promise<number> {
        if (this.prices[tradingPair]) {
            return this.prices[tradingPair];
        }

        // If we don't have a cached price, fetch it now
        return await this.fetchPrice(tradingPair);
    }

    // Helper to generate mock prices
    private getMockPrice(tradingPair: string): number {
        if (tradingPair === 'BTC/USD') return 35000 + Math.random() * 2000;
        if (tradingPair === 'ETH/USD') return 1800 + Math.random() * 100;
        if (tradingPair === 'ICP/USD') return 5 + Math.random() * 1;
        return 100 + Math.random() * 10; // default for unknown pairs
    }
}
