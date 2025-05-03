// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Mock implementation of the FtsoV2Interface for testing
contract MockFtsoV2 {
    struct PriceData {
        uint256 price;
        int8 decimals;
        uint64 timestamp;
    }
    
    mapping(bytes21 => PriceData) private prices;
    
    // Set the price for a specific feed ID
    function setPrice(bytes21 feedId, uint256 price, int8 decimals) external {
        prices[feedId] = PriceData(price, decimals, uint64(block.timestamp));
    }
    
    // Implement the FtsoV2Interface.getFeedById function
    function getFeedById(bytes21 feedId) external view returns (uint256, int8, uint64) {
        PriceData memory data = prices[feedId];
        return (data.price, data.decimals, data.timestamp);
    }
    
    // Implement the FtsoV2Interface.getFeedByIdInWei function
    function getFeedByIdInWei(bytes21 feedId) external view returns (uint256, uint64) {
        PriceData memory data = prices[feedId];
        return (data.price, data.timestamp);
    }
    
    // Implement the FtsoV2Interface.getFeedsById function
    function getFeedsById(bytes21[] calldata feedIds) external view returns (uint256[] memory, int8[] memory, uint64) {
        uint256[] memory feedValues = new uint256[](feedIds.length);
        int8[] memory decimals = new int8[](feedIds.length);
        
        for(uint i = 0; i < feedIds.length; i++) {
            feedValues[i] = prices[feedIds[i]].price;
            decimals[i] = prices[feedIds[i]].decimals;
        }
        
        return (feedValues, decimals, uint64(block.timestamp));
    }
} 