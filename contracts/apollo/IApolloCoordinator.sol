// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.20;

interface IApolloCoordinator {
    function requestDataFeed(string memory dataFeedId, uint256 callbackGasLimit) external returns (uint256);
    function requestRandomFeed(uint256 callbackGasLimit, uint256 numWords) external returns (uint256);

    event DataFeedRequested(
        uint256 indexed requestId, string dataFeedId, uint256 callbackGasLimit, address indexed requester
    );

    event RandomFeedRequested(
        uint256 indexed requestId, uint256 callbackGasLimit, uint256 numWords, address indexed requester
    );
}
