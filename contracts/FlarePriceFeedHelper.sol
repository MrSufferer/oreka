// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@flarenetwork/flare-periphery-contracts/flare/ContractRegistry.sol";
import "@flarenetwork/flare-periphery-contracts/flare/FtsoV2Interface.sol";

/**
 * @title FlarePriceFeedHelper
 * @notice Helper contract that provides common price feed IDs and utility functions for interacting with Flare's FTSO
 */
contract FlarePriceFeedHelper {
    // Common Price Feed IDs
    bytes21 public constant FLR_USD_FEED_ID = 0x01464c522f55534400000000000000000000000000; // "FLR/USD"
    bytes21 public constant BTC_USD_FEED_ID = 0x014254432f55534400000000000000000000000000; // "BTC/USD"
    bytes21 public constant ETH_USD_FEED_ID = 0x014554482f55534400000000000000000000000000; // "ETH/USD"
    bytes21 public constant XRP_USD_FEED_ID = 0x015852502f55534400000000000000000000000000; // "XRP/USD"
    bytes21 public constant DOGE_USD_FEED_ID = 0x01444f47452f555344000000000000000000000000; // "DOGE/USD"
    bytes21 public constant ADA_USD_FEED_ID = 0x014144412f55534400000000000000000000000000; // "ADA/USD"
    bytes21 public constant ALGO_USD_FEED_ID = 0x01414c474f2f555344000000000000000000000000; // "ALGO/USD"
    bytes21 public constant BCH_USD_FEED_ID = 0x014243482f55534400000000000000000000000000; // "BCH/USD"
    bytes21 public constant LTC_USD_FEED_ID = 0x014c54432f55534400000000000000000000000000; // "LTC/USD"
    bytes21 public constant MATIC_USD_FEED_ID = 0x014d415449432f555344000000000000000000000000; // "MATIC/USD"
    
    // Instance of FTSO interface
    FtsoV2Interface private ftsoV2;
    
    constructor() {
        ftsoV2 = ContractRegistry.getFtsoV2();
    }
    
    /**
     * @notice Get the price for a given feed ID
     * @param feedId The feed ID to fetch the price for
     * @return price The current price
     * @return decimals The decimals for the price
     * @return timestamp The timestamp when the price was last updated
     */
    function getPriceForFeed(bytes21 feedId) public view returns (uint256 price, int8 decimals, uint64 timestamp) {
        return ftsoV2.getFeedById(feedId);
    }
    
    /**
     * @notice Get the price in Wei for a given feed ID
     * @param feedId The feed ID to fetch the price for
     * @return price The current price in Wei
     * @return timestamp The timestamp when the price was last updated
     */
    function getPriceInWeiForFeed(bytes21 feedId) public view returns (uint256 price, uint64 timestamp) {
        return ftsoV2.getFeedByIdInWei(feedId);
    }
    
    /**
     * @notice Get all prices for a batch of feed IDs
     * @param feedIds Array of feed IDs to fetch prices for
     * @return prices Array of price values
     * @return decimals Array of decimals for each price
     * @return timestamp The timestamp when the prices were last updated
     */
    function getBatchPrices(bytes21[] memory feedIds) public view returns (uint256[] memory prices, int8[] memory decimals, uint64 timestamp) {
        return ftsoV2.getFeedsById(feedIds);
    }
    
    /**
     * @notice Convert a string symbol to its corresponding bytes21 feed ID
     * @param symbol The symbol string (e.g., "BTC/USD")
     * @return The feed ID for the symbol
     */
    function getFeedIdForSymbol(string memory symbol) public pure returns (bytes21) {
        // Convert symbol to its ID representation
        // Format: 0x01 + (symbol in uppercase, right-padded with zeros)
        
        bytes memory symbolBytes = bytes(symbol);
        bytes21 result = 0x01;
        
        for (uint i = 0; i < symbolBytes.length && i < 19; i++) {
            result |= bytes21(bytes1(symbolBytes[i])) >> (i * 8);
        }
        
        return result;
    }
    
    /**
     * @notice Get a readable name for a common feed ID
     * @param feedId The feed ID to get the name for
     * @return The name of the feed
     */
    function getFeedName(bytes21 feedId) public pure returns (string memory) {
        if (feedId == FLR_USD_FEED_ID) return "FLR/USD";
        if (feedId == BTC_USD_FEED_ID) return "BTC/USD";
        if (feedId == ETH_USD_FEED_ID) return "ETH/USD";
        if (feedId == XRP_USD_FEED_ID) return "XRP/USD";
        if (feedId == DOGE_USD_FEED_ID) return "DOGE/USD";
        if (feedId == ADA_USD_FEED_ID) return "ADA/USD";
        if (feedId == ALGO_USD_FEED_ID) return "ALGO/USD";
        if (feedId == BCH_USD_FEED_ID) return "BCH/USD";
        if (feedId == LTC_USD_FEED_ID) return "LTC/USD";
        if (feedId == MATIC_USD_FEED_ID) return "MATIC/USD";
        
        return "Unknown";
    }
} 