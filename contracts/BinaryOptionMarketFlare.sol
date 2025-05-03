// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "./OracleConsumer.sol";

import "@flarenetwork/flare-periphery-contracts/flare/ContractRegistry.sol";
import "@flarenetwork/flare-periphery-contracts/flare/FtsoV2Interface.sol";

/**
 * THIS IS AN EXAMPLE CONTRACT THAT USES HARDCODED
 * VALUES FOR CLARITY.
 * THIS IS AN EXAMPLE CONTRACT THAT USES UN-AUDITED CODE.
 * DO NOT USE THIS CODE IN PRODUCTION.
 */

contract BinaryOptionMarketFlare is Ownable {
    enum Side {
        Long,
        Short
    }
    enum Phase {
        Trading,
        Bidding,
        Maturity,
        Expiry
    }

    struct OracleDetails {
        uint256 strikePrice;
        uint256 finalPrice;
    }

    struct Position {
        uint long;
        uint short;
    }

    struct MarketFees {
        uint poolFee;
        uint creatorFee;
        uint refundFee;
    }

    OracleDetails public oracleDetails;
    OracleConsumer internal priceFeed;
    FtsoV2Interface internal ftsoV2;

    // Price feed details
    bytes21 private priceFeedId;
    string public tradingPair;

    Position public positions;
    MarketFees public fees;
    uint public totalDeposited;
    bool public resolved;
    Phase public currentPhase;
    uint public feePercentage = 10; // 10% fee on rewards
    mapping(address => uint) public longBids;
    mapping(address => uint) public shortBids;
    mapping(address => bool) public hasClaimed;
    
    uint256 public deployTime;
    uint public maturityTime; // Time when market resolves
    uint public resolveTime;
    uint public biddingStartTime;
    uint8 public indexBg; // Background index (1-10)

    event Bid(Side side, address indexed account, uint value);
    event MarketResolved(uint256 finalPrice, uint timeStamp);
    event RewardClaimed(address indexed account, uint value);
    event Withdrawal(address indexed user, uint amount);
    event PositionUpdated(
        uint timestamp,
        uint longAmount,
        uint shortAmount,
        uint totalDeposited
    );
    event MarketOutcome(Side winningSide, address indexed user, bool isWinner);

    constructor(
        address _owner,
        string memory _tradingPair,
        bytes21 _priceFeedId,
        uint256 _strikePrice,
        uint _maturityTime,
        uint _feePercentage,
        uint8 _indexBg
    ) Ownable(_owner) {
        require(_maturityTime > block.timestamp, "Maturity time must be in the future");
        require(_feePercentage >= 1 && _feePercentage <= 200, "Fee must be between 0.1% and 20%");
        require(_indexBg >= 1 && _indexBg <= 10, "Index background must be between 1 and 10");
        
        // Access the FTSO through the Contract Registry
        ftsoV2 = ContractRegistry.getFtsoV2();
        
        tradingPair = _tradingPair;
        priceFeedId = _priceFeedId;
        oracleDetails = OracleDetails(_strikePrice, 0);
        maturityTime = _maturityTime;
        deployTime = block.timestamp;
        feePercentage = _feePercentage;
        indexBg = _indexBg;
        currentPhase = Phase.Trading;
        transferOwnership(_owner);
    }

    function bid(Side side) public payable {
        require(currentPhase == Phase.Bidding, "Not in bidding phase");
        require(msg.value > 0, "Value must be greater than zero");

        if (side == Side.Long) {
            positions.long += msg.value;
            longBids[msg.sender] += msg.value;
        } else {
            positions.short += msg.value;
            shortBids[msg.sender] += msg.value;
        }

        totalDeposited += msg.value;
        
        emit PositionUpdated(
            block.timestamp,
            positions.long,
            positions.short,
            totalDeposited
        );
        
        emit Bid(side, msg.sender, msg.value);
    }

    function resolveMarket() external onlyOwner {
        require(currentPhase == Phase.Trading, "Market not in trading phase");
        require(block.timestamp >= maturityTime, "Too early to resolve");

        // Get the price from the FTSO
        (uint256 price, int8 decimals, uint64 timestamp) = ftsoV2.getFeedById(priceFeedId);
        
        // Normalize the price based on decimals
        uint256 finalPrice = price;
        if (decimals < 0) {
            finalPrice = price * (10 ** uint8(-decimals));
        } else if (decimals > 0) {
            finalPrice = price / (10 ** uint8(decimals));
        }

        resolveWithFulfilledData(finalPrice, timestamp);
    }

    function resolveWithFulfilledData(uint256 _price, uint256 _timestamp) internal {
        resolved = true;
        currentPhase = Phase.Maturity;
        oracleDetails.finalPrice = _price;
        resolveTime = block.timestamp;
        
        emit MarketResolved(_price, _timestamp);

        Side winningSide;
        if (_price >= oracleDetails.strikePrice) {
            winningSide = Side.Long;
        } else {
            winningSide = Side.Short;
        }

        emit MarketOutcome(winningSide, address(0), true);
    }

    function claimReward() external {
        require(currentPhase == Phase.Expiry, "Market not in expiry phase");
        require(resolved, "Market is not resolved yet");
        require(!hasClaimed[msg.sender], "Reward already claimed");

        uint256 finalPrice = oracleDetails.finalPrice;

        Side winningSide;
        if (finalPrice >= oracleDetails.strikePrice) {
            winningSide = Side.Long;
        } else {
            winningSide = Side.Short;
        }

        uint userDeposit;
        uint totalWinningDeposits;
        bool isWinner = false;

        if (winningSide == Side.Long) {
            userDeposit = longBids[msg.sender];
            totalWinningDeposits = positions.long;
            if (userDeposit > 0) {
                isWinner = true;
            }
        } else {
            userDeposit = shortBids[msg.sender];
            totalWinningDeposits = positions.short;
            if (userDeposit > 0) {
                isWinner = true;
            }
        }

        // Send outcome event
        emit MarketOutcome(winningSide, msg.sender, isWinner);

        require(userDeposit > 0, "No deposits on winning side");

        uint reward = (userDeposit * totalDeposited) / totalWinningDeposits;
        uint fee = (reward * feePercentage) / 100;
        uint finalReward = reward - fee;

        hasClaimed[msg.sender] = true;

        payable(msg.sender).transfer(finalReward);
        emit RewardClaimed(msg.sender, finalReward);
    }

    function withdraw() public onlyOwner {
        uint amount = address(this).balance;
        require(amount > 0, "No balance to withdraw.");

        payable(msg.sender).transfer(amount);
        emit Withdrawal(msg.sender, amount);
    }

    function startBidding() external onlyOwner {
        require(currentPhase == Phase.Trading, "Market not in trading phase");
        currentPhase = Phase.Bidding;
        biddingStartTime = block.timestamp;
    }

    function expireMarket() external onlyOwner {
        require(currentPhase == Phase.Maturity, "Market not in maturity phase");
        require(resolved == true, "Market is not resolved yet");
        currentPhase = Phase.Expiry;
    }

    function getFinalPrice() public view returns (uint256) {
        return oracleDetails.finalPrice;
    }

    function getCurrentPrice() public view returns (uint256, int8, uint64) {
        return ftsoV2.getFeedById(priceFeedId);
    }
    
    function getCurrentPriceInWei() public view returns (uint256, uint64) {
        return ftsoV2.getFeedByIdInWei(priceFeedId);
    }
} 