// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import {IOrallyExecutorsRegistry} from "../registry/IOrallyExecutorsRegistry.sol";

contract OrallyApolloConsumer {
    IOrallyExecutorsRegistry private registry;

    constructor(address _registry) {
        registry = IOrallyExecutorsRegistry(_registry);
    }

    function isExecutor(address _addr) public view returns (bool) {
        return registry.isApolloExecutor(_addr);
    }

    modifier onlyExecutor() {
        if (!registry.isApolloExecutor(msg.sender)) revert ApolloCallerUnauthorized(msg.sender);
        _;
    }

    error ApolloCallerUnauthorized(address caller);
}
