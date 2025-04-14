// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import {ApolloReceiver} from "../ApolloReceiver.sol";

contract RaffleExample is ApolloReceiver {
    uint256 maxNumberOfTickets;
    uint256 ticketPrice;
    address[] entries;
    address owner;

    constructor(address _executorsRegistry, address _apolloCoordinator, uint16 _maxNumberOfTickets, uint256 _ticketPrice)
    ApolloReceiver(_executorsRegistry, _apolloCoordinator)
    {
        maxNumberOfTickets = _maxNumberOfTickets;
        ticketPrice = _ticketPrice;
        owner = msg.sender;
    }

    function enterRaffle() external payable {
        require(entries.length < maxNumberOfTickets, "RaffleExample: Raffle is full");
        require(msg.value == ticketPrice, "RaffleExample: Ticket price is not correct");
        entries.push(msg.sender);
    }

    function pickWinner(uint256 _randomNumber) internal {
        uint256 winnerIndex = _randomNumber % entries.length;
        (bool success,) = payable(entries[winnerIndex]).call{value: address(this).balance}("");

        require(success, "RaffleExample: Failed to send Ether to winner");

        entries = new address[](0);
    }

    function fulfillData(bytes memory data) internal override {
        (, uint256[] memory randomWords) = abi.decode(data, (uint256, uint256[]));

        // transform the result to a number between 1 and 20 inclusively
        uint256 randomNumber = (randomWords[0] % entries.length) + 1;

        pickWinner(randomNumber);
    }

    function end_raffle() external {
        require(msg.sender == owner, "RaffleExample: Only owner can end the raffle");

        apolloCoordinator.requestRandomFeed(300000, 1);
    }
}
