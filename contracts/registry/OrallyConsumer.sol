// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import {IOrallyExecutorsRegistry} from "./IOrallyExecutorsRegistry.sol";

contract OrallyConsumer {
    IOrallyExecutorsRegistry private registry;

    function __OrallyConsumer_init(address _registry) internal {
        registry = IOrallyExecutorsRegistry(_registry);
    }

    function isExecutor(address _addr) public view returns (bool) {
        return registry.isPythiaExecutor(_addr) || registry.isApolloExecutor(_addr);
    }

    modifier onlyExecutor() {
        if (!registry.isPythiaExecutor(msg.sender) && !registry.isApolloExecutor(msg.sender)) revert CallerUnauthorized(msg.sender);
        _;
    }

    error CallerUnauthorized(address caller);
}
