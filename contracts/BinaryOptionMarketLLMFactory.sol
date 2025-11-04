// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./BinaryOptionMarketLLM.sol";

/**
 * Factory contract for deploying BinaryOptionMarketLLM contracts
 */
contract BinaryOptionMarketLLMFactory {
    event MarketCreated(
        address indexed marketAddress,
        string tradingPair,
        int256 strikePrice,
        uint256 maturityTime,
        uint256 feePercentage,
        uint8 indexBg
    );

    address[] public deployedMarkets;

    /**
     * @notice Create a new BinaryOptionMarketLLM
     * @param _strikePrice The strike price
     * @param _owner The owner of the market
     * @param _tradingPair The trading pair (e.g., "BTC-USD")
     * @param _oracleAddress The oracle address that can resolve markets
     * @param _maturityTime The maturity timestamp
     * @param _feePercentage The fee percentage (1-200, representing 0.1% to 20%)
     * @param _indexBg The background index (1-10)
     * @return The address of the deployed market contract
     */
    function createMarket(
        int _strikePrice,
        address _owner,
        string memory _tradingPair,
        address _oracleAddress,
        uint _maturityTime,
        uint _feePercentage,
        uint _indexBg
    ) public returns (address) {
        BinaryOptionMarketLLM market = new BinaryOptionMarketLLM(
            _strikePrice,
            _owner,
            _tradingPair,
            _oracleAddress,
            _maturityTime,
            _feePercentage,
            _indexBg
        );

        address marketAddress = address(market);
        deployedMarkets.push(marketAddress);

        emit MarketCreated(
            marketAddress,
            _tradingPair,
            _strikePrice,
            _maturityTime,
            _feePercentage,
            uint8(_indexBg)
        );

        return marketAddress;
    }

    /**
     * @notice Get all deployed markets
     * @return Array of deployed market addresses
     */
    function getDeployedMarkets() public view returns (address[] memory) {
        return deployedMarkets;
    }

    /**
     * @notice Get the count of deployed markets
     * @return The number of deployed markets
     */
    function getDeployedMarketsCount() public view returns (uint256) {
        return deployedMarkets.length;
    }
}

