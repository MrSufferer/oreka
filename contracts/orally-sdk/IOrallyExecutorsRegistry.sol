// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.20;

interface IOrallyExecutorsRegistry {
    function isExecutor(address _executor) external view returns (bool);

    event ExecutorAdded(address executor);
    event ExecutorRemoved(address executor);

    error NotAuthorized();
    error InvalidAddress();
} 