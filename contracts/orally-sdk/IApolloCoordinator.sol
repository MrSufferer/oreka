// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.20;

interface IApolloCoordinator {
    function requestDataFeed(
        string memory _dataFeedId,
        uint64 _callbackGasLimit
    ) external returns (uint);

    function requestRandomFeed(
        uint64 _callbackGasLimit,
        uint64 _numWords
    ) external returns (uint);
} 