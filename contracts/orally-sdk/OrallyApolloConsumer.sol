// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import {IOrallyExecutorsRegistry} from "./IOrallyExecutorsRegistry.sol";

contract OrallyApolloConsumer {
    IOrallyExecutorsRegistry private registry;

    constructor(address _registry) {
        registry = IOrallyExecutorsRegistry(_registry);
    }

    modifier onlyOrally() {
        require(
            registry.isExecutor(msg.sender),
            "OrallyConsumer: caller is not the orally executor"
        );
        _;
    }

    function fulfillData(bytes memory /* data */) internal virtual {
        // Override this
    }
} 