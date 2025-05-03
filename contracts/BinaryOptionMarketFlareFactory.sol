// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BinaryOptionMarketFlare.sol";

contract BinaryOptionMarketFlareFactory {
    address public owner;
    address[] public deployedMarkets;
    
    event MarketCreated(
        address marketAddress,
        string tradingPair,
        bytes21 priceFeedId,
        uint256 strikePrice,
        uint maturityTime,
        uint feePercentage,
        uint8 indexBg
    );
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @notice Creates a new binary option market using Flare's FTSO as oracle
     * @param tradingPair The trading pair name (e.g., "BTC/USD")
     * @param priceFeedId The Flare FTSO price feed ID
     * @param strikePrice The strike price for the binary option
     * @param maturityTime Timestamp when the market will resolve
     * @param feePercentage Fee percentage (between 1-200 for 0.1%-20%)
     * @param indexBg Background index (1-10)
     */
    function createMarket(
        string memory tradingPair,
        bytes21 priceFeedId,
        uint256 strikePrice,
        uint maturityTime,
        uint feePercentage,
        uint8 indexBg
    ) public returns (address) {
        BinaryOptionMarketFlare market = new BinaryOptionMarketFlare(
            msg.sender,
            tradingPair,
            priceFeedId,
            strikePrice,
            maturityTime,
            feePercentage,
            indexBg
        );
        
        address marketAddress = address(market);
        deployedMarkets.push(marketAddress);
        
        emit MarketCreated(
            marketAddress,
            tradingPair,
            priceFeedId,
            strikePrice,
            maturityTime,
            feePercentage,
            indexBg
        );
        
        return marketAddress;
    }
    
    /**
     * @notice Returns the number of deployed markets
     */
    function getDeployedMarketsCount() public view returns (uint) {
        return deployedMarkets.length;
    }
    
    /**
     * @notice Returns a list of all deployed markets
     */
    function getDeployedMarkets() public view returns (address[] memory) {
        return deployedMarkets;
    }
} 