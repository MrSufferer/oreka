// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

interface IOrallyExecutorsRegistry {
    function isPythiaExecutor(address _addr) external view returns (bool);

    function isApolloExecutor(address _addr) external view returns (bool);

    function isExecutor(bytes32 _service, address _addr) external view returns (bool);

    event ExecutorAdded(bytes32 indexed service, address indexed executor);

    event ExecutorRemoved(bytes32 indexed service, address indexed executor);
}
