// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.20;

import {OrallyStructs} from "./OrallyStructs.sol";

interface IOrallyVerifierOracle {
    // Pythia Request related functions
    function requestDataFeed(
        string memory _dataFeedId,
        uint64 _callbackGasLimit
    ) external returns (uint);

    function requestRandomFeed(
        uint64 _callbackGasLimit,
        uint64 _numWords
    ) external returns (uint);

    function requestCustomFeed(
        string memory _customFeedId,
        uint64 _callbackGasLimit,
        bytes memory _data
    ) external returns (uint);

    function requestsOfRequester(
        address _requester
    ) external view returns (uint[] memory);

    function getRequest(
        uint _requestId
    ) external view returns (OrallyStructs.Request memory);

    function getDataFeedRequest(
        uint _requestId
    ) external view returns (OrallyStructs.DataFeedRequest memory);

    function getRandomFeedRequest(
        uint _requestId
    ) external view returns (OrallyStructs.RandomFeedRequest memory);

    function getCustomFeedRequest(
        uint _requestId
    ) external view returns (OrallyStructs.CustomFeedRequest memory);

    // Pythia Response related functions
    function fulfillDataFeedRequest(
        uint _requestId,
        string memory _dataFeedId,
        uint _rate,
        uint _decimals,
        uint _timestamp
    ) external returns (bool);

    function fulfillRandomFeedRequest(
        uint _requestId,
        uint[] memory _randomWords
    ) external returns (bool);

    function fulfillCustomFeedRequest(
        uint _requestId,
        bytes memory _data
    ) external returns (bool);

    // Events
    event DataFeedRequested(
        address indexed requester,
        uint requestId,
        string dataFeedId
    );

    event RandomFeedRequested(
        address indexed requester,
        uint requestId,
        uint64 numWords
    );

    event CustomFeedRequested(
        address indexed requester,
        uint requestId,
        string customFeedId
    );

    event DataFeedRequestFulfilled(
        uint requestId,
        string dataFeedId,
        uint rate,
        uint decimals,
        uint timestamp
    );

    event RandomFeedRequestFulfilled(uint requestId, uint[] randomWords);

    event CustomFeedRequestFulfilled(uint requestId, bytes data);

    // Errors
    error NotExecutor();
    error RequestDoesNotExist();
    error RequestNotFound();
    error InvalidRequestType();
} 