// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "node_modules/@openzeppelin/contracts/access/Ownable.sol";

/**
 * Binary Option Market Contract using LLM Oracle
 * This contract replaces Chainlink price feed with LLM-based oracle resolution.
 * The oracle service (off-chain) queries LLM for price data and calls resolveWithPrice()
 * 
 * THIS IS AN EXAMPLE CONTRACT THAT USES UN-AUDITED CODE.
 * DO NOT USE THIS CODE IN PRODUCTION.
 */

contract BinaryOptionMarketLLM is Ownable {
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
        int strikePrice;
        int finalPrice;
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

    uint256 public strikePrice;
    uint256 public deployTime;
    uint public biddingStartTime;
    uint256 public maturityTime;
    uint256 public resolveTime;

    Position public positions;
    MarketFees public fees;
    uint public totalDeposited;
    bool public resolved;
    Phase public currentPhase;
    uint public feePercentage;
    string public tradingPair;
    uint public indexBg;
    
    // Oracle address that can resolve markets (in addition to owner)
    address public oracleAddress;

    mapping(address => uint) public longBids;
    mapping(address => uint) public shortBids;
    mapping(address => bool) public hasClaimed;

    event Bid(Side side, address indexed account, uint value);
    event MarketResolved(int finalPrice, uint timeStamp);
    event RewardClaimed(address indexed account, uint value);
    event Withdrawal(address indexed user, uint amount);
    event PositionUpdated(
        uint timestamp,
        uint longAmount,
        uint shortAmount,
        uint totalDeposited
    );
    event MarketOutcome(Side winningSide, address indexed user, bool isWinner);
    event OracleAddressUpdated(address indexed oldOracle, address indexed newOracle);

    constructor(
        int _strikePrice,
        address _owner,
        string memory _tradingPair,
        address _oracleAddress,
        uint _maturityTime,
        uint _feePercentage,
        uint _indexBg
    ) Ownable(_owner) {

        require(_maturityTime > block.timestamp, "Maturity time must be in the future");
        require(_feePercentage >= 1 && _feePercentage <= 200, "Fee must be between 0.1% and 20%");
        require(_indexBg >= 1 && _indexBg <= 10, "Index background must be between 1 and 10");
        require(_oracleAddress != address(0), "Oracle address cannot be zero");

        oracleDetails = OracleDetails(_strikePrice, _strikePrice);
        tradingPair = _tradingPair;
        maturityTime = _maturityTime;
        deployTime = block.timestamp;
        feePercentage = _feePercentage;
        indexBg = _indexBg;
        oracleAddress = _oracleAddress;

        currentPhase = Phase.Trading;
        // Owner is already set to _owner via Ownable(_owner) constructor
        // No need to transfer ownership - the user (_owner) should remain the owner
    }

    /**
     * @notice Set the oracle address that can resolve markets
     * @param _oracleAddress The address of the oracle service
     */
    function setOracleAddress(address _oracleAddress) external onlyOwner {
        require(_oracleAddress != address(0), "Oracle address cannot be zero");
        address oldOracle = oracleAddress;
        oracleAddress = _oracleAddress;
        emit OracleAddressUpdated(oldOracle, _oracleAddress);
    }

    /**
     * @notice Check if caller is authorized to resolve market (owner or oracle)
     */
    modifier onlyOracleOrOwner() {
        require(
            msg.sender == owner() || msg.sender == oracleAddress,
            "Not authorized to resolve market"
        );
        _;
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

    /**
     * @notice Resolve market with price from LLM oracle
     * @param _price The price value from LLM oracle (in 8 decimals format)
     * @param _timestamp The timestamp when price was retrieved
     */
    function resolveWithPrice(int _price, uint256 _timestamp) external onlyOracleOrOwner {
        require(currentPhase == Phase.Bidding, "Market not in bidding phase");
        require(block.timestamp >= maturityTime, "Too early to resolve");
        require(!resolved, "Market already resolved");

        resolveWithFulfilledData(_price, _timestamp);
    }

    /**
     * @notice Legacy resolveMarket function - kept for compatibility but now requires price parameter
     * @dev This function now requires price to be provided externally via resolveWithPrice
     */
    function resolveMarket() external view {
        require(currentPhase == Phase.Bidding, "Market not in bidding phase");
        require(block.timestamp >= maturityTime, "Too early to resolve");
        revert("Use resolveWithPrice(int price, uint256 timestamp) instead. Price must be provided by oracle service.");
    }

    function resolveWithFulfilledData(int _rate, uint256 _timestamp) internal {
        int finalPrice = _rate;
        uint updatedAt = _timestamp;

        // Normalize price to 8 decimals (assuming LLM returns price in standard format)
        uint normalizedPrice = normalizePrice(finalPrice);

        resolved = true;
        currentPhase = Phase.Maturity;
        resolveTime = block.timestamp;
        oracleDetails.finalPrice = int256(normalizedPrice);
        emit MarketResolved(finalPrice, updatedAt);

        Side winningSide;
        if (finalPrice >= oracleDetails.strikePrice) {
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

        int finalPrice = oracleDetails.finalPrice;

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

        emit MarketOutcome(winningSide, msg.sender, isWinner);

        require(userDeposit > 0, "No deposits on winning side");

        uint reward = (userDeposit * totalDeposited) / totalWinningDeposits;
        uint fee = (reward * feePercentage) / 1000;
        uint finalReward = reward - fee;

        hasClaimed[msg.sender] = true;

        payable(msg.sender).transfer(finalReward);
        emit RewardClaimed(msg.sender, finalReward);
    }

    function withdraw() external onlyOwner {
        uint feeAmount = (totalDeposited * feePercentage) / 1000; 

        require(feeAmount > 0, "No fee to withdraw.");
        require(address(this).balance >= feeAmount, "Insufficient contract balance.");

        payable(msg.sender).transfer(feeAmount);

        emit Withdrawal(msg.sender, feeAmount);
    }

    function startBidding() external onlyOwner {
        require(currentPhase == Phase.Trading, "Market not in trading phase");
        biddingStartTime = block.timestamp;
        currentPhase = Phase.Bidding;
    }

    function expireMarket() external onlyOwner {
        require(currentPhase == Phase.Maturity, "Market not in maturity phase");
        require(resolved == true, "Market is not resolved yet");
        currentPhase = Phase.Expiry;
    }

    function getFinalPrice() public view returns (int) {
        return oracleDetails.finalPrice;
    }

    /**
     * @notice Normalize price to 8 decimals format
     * @param rawPrice The raw price from LLM oracle
     * @return Normalized price in 8 decimals
     */
    function normalizePrice(int rawPrice) internal pure returns (uint256) {
        require(rawPrice >= 0, "Invalid negative price");
        // LLM oracle is expected to return price in 8 decimals format
        // If price is already in correct format, return as is
        // Otherwise, adjust accordingly
        return uint256(rawPrice);
    }

    /**
     * @notice Get market information for oracle service
     * @return tradingPair_ The trading pair string
     * @return maturityTime_ The maturity timestamp
     * @return currentPhase_ The current phase
     * @return resolved_ Whether market is resolved
     */
    function getMarketInfo() external view returns (
        string memory tradingPair_,
        uint256 maturityTime_,
        Phase currentPhase_,
        bool resolved_
    ) {
        return (tradingPair, maturityTime, currentPhase, resolved);
    }
}
