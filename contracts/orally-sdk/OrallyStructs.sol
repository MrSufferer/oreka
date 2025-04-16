// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.20;

library OrallyStructs {
    // Data request type
    enum RequestType {
        DATA_FEED,
        RANDOM_FEED,
        CUSTOM_FEED
    }

    // Request base structure
    struct Request {
        address requester;
        uint64 callbackGasLimit;
        bytes returnData;
        RequestType requestType;
    }

    // DataFeed request structure
    struct DataFeedRequest {
        Request base;
        string dataFeedId;
    }

    // RandomFeed request structure
    struct RandomFeedRequest {
        Request base;
        uint64 numWords;
    }

    // CustomFeed request structure
    struct CustomFeedRequest {
        Request base;
        string customFeedId;
        bytes data;
    }

    // Data feed response structure
    struct DataFeedResponse {
        uint requestId;
        string dataFeedId;
        uint rate;
        uint decimals;
        uint timestamp;
    }

    // Random feed response structure
    struct RandomFeedResponse {
        uint requestId;
        uint[] randomWords;
    }

    // Custom feed response structure
    struct CustomFeedResponse {
        uint requestId;
        bytes data;
    }
} 