pragma solidity ^0.8.20;

import {ApolloReceiver} from "../ApolloReceiver.sol";

contract ApolloConsumerExample is ApolloReceiver {
    uint256 public requestId;
    string public dataFeedId;
    uint256 public rate;
    uint256 public decimals;
    uint256 public timestamp;

    constructor(address _executorsRegistry, address _apolloCoordinator) ApolloReceiver(_executorsRegistry, _apolloCoordinator) {}

    function requestValue() public {
        apolloCoordinator.requestDataFeed("ICP/USD", 300000);
    }

    function fulfillData(bytes memory data) internal override {
        (
            uint256 _requestId,
            string memory _dataFeedId,
            uint256 _rate,
            uint256 _decimals,
            uint256 _timestamp
        ) = abi.decode(data, (
            uint256,
            string,
            uint256,
            uint256,
            uint256
        ));


        requestId = _requestId;
        dataFeedId = _dataFeedId;
        rate = _rate;
        decimals = _decimals;
        timestamp = _timestamp;
    }
}
