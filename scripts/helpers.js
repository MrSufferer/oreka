// Helper script with utility functions for interacting with BinaryOptionMarketFlare contracts
const { ethers } = require("ethers");

// Common Flare price feed IDs
const PRICE_FEED_IDS = {
    FLR_USD: "0x01464c522f55534400000000000000000000000000", // "FLR/USD"
    BTC_USD: "0x014254432f55534400000000000000000000000000", // "BTC/USD"
    ETH_USD: "0x014554482f55534400000000000000000000000000", // "ETH/USD"
    XRP_USD: "0x015852502f55534400000000000000000000000000", // "XRP/USD"
    DOGE_USD: "0x01444f47452f555344000000000000000000000000", // "DOGE/USD"
    ADA_USD: "0x014144412f55534400000000000000000000000000", // "ADA/USD"
    ALGO_USD: "0x01414c474f2f555344000000000000000000000000", // "ALGO/USD"
    BCH_USD: "0x014243482f55534400000000000000000000000000", // "BCH/USD"
    LTC_USD: "0x014c54432f55534400000000000000000000000000", // "LTC/USD"
    MATIC_USD: "0x014d415449432f555344000000000000000000000000", // "MATIC/USD"
};

// Network configurations
const NETWORKS = {
    flare: {
        chainId: 14,
        name: "Flare Mainnet",
        rpcUrl: "https://flare-api.flare.network/ext/C/rpc",
        blockExplorer: "https://explorer.flare.network",
        contracts: {
            // Update these with deployed contract addresses
            factory: "",
            priceFeedHelper: ""
        }
    },
    coston2: {
        chainId: 114,
        name: "Coston2 Testnet",
        rpcUrl: "https://coston2-api.flare.network/ext/C/rpc",
        blockExplorer: "https://coston2-explorer.flare.network",
        contracts: {
            // Update these with deployed contract addresses
            factory: "",
            priceFeedHelper: ""
        }
    }
};

// Get ABI for contracts
const getAbi = (contractName) => {
    try {
        return require(`../artifacts/contracts/${contractName}.sol/${contractName}.json`).abi;
    } catch (error) {
        console.error(`Failed to load ABI for ${contractName}:`, error);
        return [];
    }
};

/**
 * Connect to a provider based on the network name
 * @param {string} networkName 'flare' or 'coston2'
 * @returns {ethers.providers.JsonRpcProvider} Provider instance
 */
const getProvider = (networkName) => {
    const network = NETWORKS[networkName];
    if (!network) {
        throw new Error(`Unknown network: ${networkName}`);
    }
    return new ethers.providers.JsonRpcProvider(network.rpcUrl);
};

/**
 * Get a contract instance 
 * @param {string} contractName The contract name (e.g. 'BinaryOptionMarketFlareFactory')
 * @param {string} contractAddress The contract address
 * @param {string} networkName 'flare' or 'coston2'
 * @param {ethers.Signer} [signer] Optional signer for transactions
 * @returns {ethers.Contract} Contract instance
 */
const getContract = (contractName, contractAddress, networkName, signer) => {
    const provider = getProvider(networkName);
    const abi = getAbi(contractName);
    return new ethers.Contract(
        contractAddress,
        abi,
        signer || provider
    );
};

/**
 * Get the factory contract
 * @param {string} networkName 'flare' or 'coston2'
 * @param {ethers.Signer} [signer] Optional signer for transactions
 * @returns {ethers.Contract} Factory contract instance
 */
const getFactoryContract = (networkName, signer) => {
    const network = NETWORKS[networkName];
    if (!network || !network.contracts.factory) {
        throw new Error(`Factory contract not configured for network: ${networkName}`);
    }
    return getContract(
        "BinaryOptionMarketFlareFactory",
        network.contracts.factory,
        networkName,
        signer
    );
};

/**
 * Get the price feed helper contract
 * @param {string} networkName 'flare' or 'coston2'
 * @param {ethers.Signer} [signer] Optional signer for transactions
 * @returns {ethers.Contract} Price feed helper contract instance
 */
const getPriceFeedHelperContract = (networkName, signer) => {
    const network = NETWORKS[networkName];
    if (!network || !network.contracts.priceFeedHelper) {
        throw new Error(`PriceFeedHelper contract not configured for network: ${networkName}`);
    }
    return getContract(
        "FlarePriceFeedHelper",
        network.contracts.priceFeedHelper,
        networkName,
        signer
    );
};

/**
 * Get market contract instance
 * @param {string} marketAddress The market contract address
 * @param {string} networkName 'flare' or 'coston2'
 * @param {ethers.Signer} [signer] Optional signer for transactions
 * @returns {ethers.Contract} Market contract instance
 */
const getMarketContract = (marketAddress, networkName, signer) => {
    return getContract(
        "BinaryOptionMarketFlare",
        marketAddress,
        networkName,
        signer
    );
};

/**
 * Create a new market
 * @param {string} networkName 'flare' or 'coston2'
 * @param {ethers.Signer} signer Signer for transaction
 * @param {Object} marketParams Market parameters
 * @param {string} marketParams.tradingPair Trading pair name (e.g. "BTC/USD")
 * @param {string} marketParams.priceFeedId Flare FTSO price feed ID
 * @param {string|number} marketParams.strikePrice Strike price (will be converted to wei)
 * @param {number} marketParams.maturityTime Maturity timestamp (seconds)
 * @param {number} marketParams.feePercentage Fee percentage (between 1-200)
 * @param {number} marketParams.indexBg Background index (1-10)
 * @returns {Promise<{tx: ethers.ContractTransaction, marketAddress: string}>} Transaction and new market address
 */
const createMarket = async (networkName, signer, marketParams) => {
    const factory = getFactoryContract(networkName, signer);

    // Convert strike price to wei if it's not already
    const strikePrice = typeof marketParams.strikePrice === 'string' && marketParams.strikePrice.startsWith('0x')
        ? marketParams.strikePrice
        : ethers.utils.parseUnits(marketParams.strikePrice.toString(), 18);

    // Create market
    const tx = await factory.createMarket(
        marketParams.tradingPair,
        marketParams.priceFeedId,
        strikePrice,
        marketParams.maturityTime,
        marketParams.feePercentage,
        marketParams.indexBg
    );

    // Wait for tx to be mined
    const receipt = await tx.wait();

    // Extract market address from events
    const event = receipt.events.find(e => e.event === 'MarketCreated');
    const marketAddress = event.args.marketAddress;

    return { tx, marketAddress };
};

/**
 * Get market details
 * @param {string} marketAddress Market contract address
 * @param {string} networkName 'flare' or 'coston2'
 * @returns {Promise<Object>} Market details
 */
const getMarketDetails = async (marketAddress, networkName) => {
    const market = getMarketContract(marketAddress, networkName);
    const priceFeedHelper = getPriceFeedHelperContract(networkName);

    // Call multiple contract methods in parallel
    const [
        oracleDetails,
        positions,
        totalDeposited,
        resolved,
        currentPhase,
        feePercentage,
        maturityTime,
        indexBg,
        tradingPair,
        deployTime,
        biddingStartTime,
        resolveTime,
    ] = await Promise.all([
        market.oracleDetails(),
        market.positions(),
        market.totalDeposited(),
        market.resolved(),
        market.currentPhase(),
        market.feePercentage(),
        market.maturityTime(),
        market.indexBg(),
        market.tradingPair(),
        market.deployTime(),
        market.biddingStartTime(),
        market.resolveTime(),
    ]);

    // Format phases as strings for readability
    const phases = ['Trading', 'Bidding', 'Maturity', 'Expiry'];

    return {
        address: marketAddress,
        tradingPair,
        strikePrice: ethers.utils.formatUnits(oracleDetails.strikePrice, 18),
        finalPrice: oracleDetails.finalPrice.gt(0) ? ethers.utils.formatUnits(oracleDetails.finalPrice, 18) : null,
        longPositions: ethers.utils.formatEther(positions.long),
        shortPositions: ethers.utils.formatEther(positions.short),
        totalDeposited: ethers.utils.formatEther(totalDeposited),
        resolved,
        phase: phases[currentPhase] || 'Unknown',
        feePercentage: feePercentage.toNumber() / 10, // Convert from basis points to percentage
        maturityTime: new Date(maturityTime.toNumber() * 1000).toISOString(),
        maturityTimeUnix: maturityTime.toNumber(),
        indexBg: indexBg,
        deployTime: new Date(deployTime.toNumber() * 1000).toISOString(),
        deployTimeUnix: deployTime.toNumber(),
        biddingStartTime: biddingStartTime.gt(0) ? new Date(biddingStartTime.toNumber() * 1000).toISOString() : null,
        biddingStartTimeUnix: biddingStartTime.gt(0) ? biddingStartTime.toNumber() : null,
        resolveTime: resolveTime.gt(0) ? new Date(resolveTime.toNumber() * 1000).toISOString() : null,
        resolveTimeUnix: resolveTime.gt(0) ? resolveTime.toNumber() : null,
    };
};

/**
 * Place a bid on a market
 * @param {string} marketAddress Market contract address
 * @param {string} networkName 'flare' or 'coston2'
 * @param {ethers.Signer} signer Signer for transaction
 * @param {number} side 0 for Long, 1 for Short
 * @param {string} amount Amount to bid in ETH
 * @returns {Promise<ethers.ContractTransaction>} Transaction
 */
const placeBid = async (marketAddress, networkName, signer, side, amount) => {
    const market = getMarketContract(marketAddress, networkName, signer);
    const tx = await market.bid(side, {
        value: ethers.utils.parseEther(amount)
    });
    return tx;
};

/**
 * Start the bidding phase for a market (owner only)
 * @param {string} marketAddress Market contract address
 * @param {string} networkName 'flare' or 'coston2'
 * @param {ethers.Signer} signer Signer for transaction
 * @returns {Promise<ethers.ContractTransaction>} Transaction
 */
const startBidding = async (marketAddress, networkName, signer) => {
    const market = getMarketContract(marketAddress, networkName, signer);
    return await market.startBidding();
};

/**
 * Start the trading phase for a market (owner only)
 * @param {string} marketAddress Market contract address
 * @param {string} networkName 'flare' or 'coston2'
 * @param {ethers.Signer} signer Signer for transaction
 * @returns {Promise<ethers.ContractTransaction>} Transaction
 */
const startTrading = async (marketAddress, networkName, signer) => {
    const market = getMarketContract(marketAddress, networkName, signer);
    return await market.startTrading();
};

/**
 * Resolve a market with the current price from FTSO (owner only)
 * @param {string} marketAddress Market contract address
 * @param {string} networkName 'flare' or 'coston2'
 * @param {ethers.Signer} signer Signer for transaction
 * @returns {Promise<ethers.ContractTransaction>} Transaction
 */
const resolveMarket = async (marketAddress, networkName, signer) => {
    const market = getMarketContract(marketAddress, networkName, signer);
    return await market.resolveMarket();
};

/**
 * Expire a market, allowing users to claim rewards (owner only)
 * @param {string} marketAddress Market contract address
 * @param {string} networkName 'flare' or 'coston2'
 * @param {ethers.Signer} signer Signer for transaction
 * @returns {Promise<ethers.ContractTransaction>} Transaction
 */
const expireMarket = async (marketAddress, networkName, signer) => {
    const market = getMarketContract(marketAddress, networkName, signer);
    return await market.expireMarket();
};

/**
 * Claim rewards from a market
 * @param {string} marketAddress Market contract address
 * @param {string} networkName 'flare' or 'coston2'
 * @param {ethers.Signer} signer Signer for transaction
 * @returns {Promise<ethers.ContractTransaction>} Transaction
 */
const claimReward = async (marketAddress, networkName, signer) => {
    const market = getMarketContract(marketAddress, networkName, signer);
    return await market.claimReward();
};

/**
 * Get current price from FTSO for a feed ID
 * @param {string} feedId FTSO price feed ID
 * @param {string} networkName 'flare' or 'coston2'
 * @returns {Promise<{price: string, decimals: number, timestamp: number}>} Current price info
 */
const getCurrentPrice = async (feedId, networkName) => {
    const helper = getPriceFeedHelperContract(networkName);
    const [price, decimals, timestamp] = await helper.getPriceForFeed(feedId);
    return {
        price: ethers.utils.formatUnits(price, Math.abs(decimals.toNumber())),
        decimals: decimals.toNumber(),
        timestamp: timestamp.toNumber(),
        timestampDate: new Date(timestamp.toNumber() * 1000).toISOString(),
    };
};

module.exports = {
    PRICE_FEED_IDS,
    NETWORKS,
    getProvider,
    getContract,
    getFactoryContract,
    getPriceFeedHelperContract,
    getMarketContract,
    createMarket,
    getMarketDetails,
    placeBid,
    startBidding,
    startTrading,
    resolveMarket,
    expireMarket,
    claimReward,
    getCurrentPrice
}; 