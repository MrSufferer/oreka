import { ethers } from 'ethers';
import { FACTORY_ADDRESS, PRICE_FEED_HELPER_ADDRESS, getFactoryABI, PRICE_FEED_HELPER_ABI } from '../config/contracts';

/**
 * Create a market on Flare using the appropriate contract based on network
 */
export const createFlareMarket = async (
    signer: ethers.providers.JsonRpcSigner,
    tradingPair: string,
    priceFeedId: string,
    strikePrice: string | ethers.BigNumber,
    maturityTime: number,
    feePercentage: number,
    indexBg: number
) => {
    // Get the chainId to determine which ABI to use
    const chainId = await signer.getChainId();
    const chainIdHex = '0x' + chainId.toString(16);

    // Create the contract with the appropriate ABI
    const factoryContract = new ethers.Contract(
        FACTORY_ADDRESS,
        getFactoryABI(chainIdHex),
        signer
    );

    // Call the createMarket function on Flare
    const tx = await factoryContract.createMarket(
        tradingPair,
        priceFeedId,
        strikePrice,
        maturityTime,
        feePercentage,
        indexBg
    );

    // Wait for transaction to be mined
    const receipt = await tx.wait();

    // Find the created market address from the event logs
    if (receipt.events && receipt.events.length > 0) {
        const event = receipt.events.find(e => e.event === 'MarketCreated');
        if (event && event.args) {
            return event.args.marketAddress;
        }
    }

    throw new Error('Market creation failed or event not found');
};

/**
 * Get price feed ID for a symbol from the helper contract
 */
export const getPriceFeedId = async (
    provider: ethers.providers.Provider,
    symbol: string
) => {
    // Get the chainId to determine which ABI to use
    const network = await provider.getNetwork();
    const chainIdHex = '0x' + network.chainId.toString(16);

    // If not on Flare, use the default price feed
    if (chainIdHex !== '0x72') {
        return null;
    }

    try {
        // Create the helper contract
        const helperContract = new ethers.Contract(
            PRICE_FEED_HELPER_ADDRESS,
            PRICE_FEED_HELPER_ABI,
            provider
        );

        // Get feed ID by symbol
        return await helperContract.getFeedIdForSymbol(symbol);
    } catch (error) {
        console.error('Error getting price feed ID:', error);
        return null;
    }
}; 