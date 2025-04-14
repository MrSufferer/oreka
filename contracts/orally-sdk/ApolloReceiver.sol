// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.20;

import {OrallyApolloConsumer} from "./OrallyApolloConsumer.sol";
import {IApolloCoordinator} from "./IApolloCoordinator.sol";

/**
 * @title ApolloReceiver
 * @dev Inherits from OrallyApolloConsumer to create a contract capable of receiving data from the Orally oracle network.
 * This contract acts as a template for contracts that want to receive data from the Orally oracle,
 * especially data from price feeds and random number generation.
 */
abstract contract ApolloReceiver is OrallyApolloConsumer {
    IApolloCoordinator public apolloCoordinator;

    /**
     * @dev Initializes the contract with the address of the Executors Registry and the Apollo Coordinator.
     * @param _executorsRegistry The address of the Orally Executors Registry.
     * @param _apolloCoordinator The address of the Apollo Coordinator.
     */
    constructor(
        address _executorsRegistry,
        address _apolloCoordinator
    ) OrallyApolloConsumer(_executorsRegistry) {
        apolloCoordinator = IApolloCoordinator(_apolloCoordinator);
    }

    /**
     * @dev Callback function for receiving data from the Orally Oracle.
     * This function can only be called by the Orally Oracle.
     * @param data The data sent by the Orally Oracle.
     */
    function receiveData(bytes memory data) external onlyOrally {
        fulfillData(data);
    }
} 