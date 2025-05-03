// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Mock implementation of the ContractRegistry for testing
contract MockContractRegistry {
    address private mockFtsoV2Address;
    
    constructor(address _mockFtsoV2Address) {
        mockFtsoV2Address = _mockFtsoV2Address;
    }
    
    // Mock the getFtsoV2 function
    function getFtsoV2() external view returns (address) {
        return mockFtsoV2Address;
    }
    
    // Mock the getContractAddressByName function
    function getContractAddressByName(string calldata _name) external view returns (address) {
        if (keccak256(abi.encodePacked(_name)) == keccak256(abi.encodePacked("FtsoRegistry"))) {
            return mockFtsoV2Address;
        }
        return address(0);
    }
} 