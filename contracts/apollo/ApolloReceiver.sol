// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.20;

import {OrallyApolloConsumer} from "./OrallyApolloConsumer.sol";
import {IApolloCoordinator} from "./IApolloCoordinator.sol";

/**
 * @title ApolloReceiver
 * @dev Inherits from OrallyApolloConsumer to create a contract capable of receiving data from the Orally oracle network.
 * This contract acts as a template for contracts that want to receive data from the Orally oracle,
 * with customizable handling of different data types and structures.
 */
abstract contract ApolloReceiver is OrallyApolloConsumer {
    IApolloCoordinator public apolloCoordinator;

    /**
     * @dev Constructor that initializes the ApolloReceiver contract with a specific registry address.
     * @param _registry Address of the registry contract in the Orally network.
     */
    constructor(address _registry, address _apolloCoordinator) OrallyApolloConsumer(_registry) {
        apolloCoordinator = IApolloCoordinator(_apolloCoordinator);
    }

    /**
     * @notice Abstract function to be implemented by inheriting contracts for processing received oracle data.
     * @dev This function needs to be overridden in child contracts to specify how the received data should be processed.
     * @param data The data sent from the oracle, expected to be encoded in a predefined format.
     */
    function fulfillData(bytes memory data) internal virtual;

    /**
     * @notice Receives data from the Orally oracle and forwards it to the internal 'fulfillData' function.
     * @dev Ensures that only an authorized executor (likely the Orally oracle) can call this function.
     * This function acts as a secure entry point for data delivered by the oracle.
     * @param data The data being passed from the oracle, which can be encoded in various formats depending on the use case.
     */
    function rawFulfillData(bytes memory data) external onlyExecutor {
        fulfillData(data);
    }
}
