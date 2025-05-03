const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// This is a mock implementation for the FtsoV2Interface since we'll need to
// simulate the Flare FTSO behavior in tests
const mockFtsoV2Interface = async () => {
    const MockFtsoV2 = await ethers.getContractFactory("MockFtsoV2");
    return await MockFtsoV2.deploy();
};

// Create a mock contract for ContractRegistry to return our mock FTSO
const deployMockContractRegistry = async (mockFtsoAddress) => {
    const MockContractRegistry = await ethers.getContractFactory("MockContractRegistry");
    return await MockContractRegistry.deploy(mockFtsoAddress);
};

describe("BinaryOptionMarketFlare", function () {
    let owner;
    let user1;
    let user2;
    let mockFtso;
    let mockRegistry;
    let factory;
    let testFeedId;
    let testStrikePrice;
    let testMaturityTime;
    let market;

    beforeEach(async function () {
        // Create test accounts
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy mock FTSO
        mockFtso = await mockFtsoV2Interface();

        // Set up test feed ID and default price
        testFeedId = ethers.encodeBytes32String("BTC/USD");
        const currentPrice = ethers.parseUnits("50000", 18);
        const decimals = 8;
        await mockFtso.setPrice(testFeedId, currentPrice, decimals);

        // Deploy mock registry that will return our mock FTSO
        mockRegistry = await deployMockContractRegistry(await mockFtso.getAddress());

        // Deploy factory with mock registry
        const BinaryOptionMarketFlareFactory = await ethers.getContractFactory("BinaryOptionMarketFlareFactory", {
            libraries: {
                // Map the ContractRegistry to our mock implementation
                "@flarenetwork/flare-periphery-contracts/flare/ContractRegistry.sol": await mockRegistry.getAddress()
            }
        });
        factory = await BinaryOptionMarketFlareFactory.deploy();

        // Set test parameters for market creation
        testStrikePrice = ethers.parseUnits("55000", 18); // Strike price above current
        testMaturityTime = (await time.latest()) + 86400; // 1 day from now

        // Create a test market
        const tx = await factory.connect(owner).createMarket(
            "BTC/USD",
            testFeedId,
            testStrikePrice,
            testMaturityTime,
            10, // 1% fee
            1 // Background index
        );

        const receipt = await tx.wait();
        const marketAddress = receipt.events.find(e => e.event === "MarketCreated").args.marketAddress;
        market = await ethers.getContractAt("BinaryOptionMarketFlare", marketAddress);
    });

    describe("Market Creation", function () {
        it("Should set the correct owner", async function () {
            expect(await market.owner()).to.equal(owner.address);
        });

        it("Should set the correct strike price", async function () {
            const oracleDetails = await market.oracleDetails();
            expect(oracleDetails.strikePrice).to.equal(testStrikePrice);
        });

        it("Should set the correct maturity time", async function () {
            expect(await market.maturityTime()).to.equal(testMaturityTime);
        });

        it("Should start in Trading phase", async function () {
            expect(await market.currentPhase()).to.equal(0); // Trading phase
        });
    });

    describe("Bidding", function () {
        beforeEach(async function () {
            // Start bidding phase
            await market.connect(owner).startBidding();
        });

        it("Should allow bidding on Long position", async function () {
            const bidAmount = ethers.parseEther("1.0");
            await market.connect(user1).bid(0, { value: bidAmount }); // 0 for Long

            const positions = await market.positions();
            expect(positions.long).to.equal(bidAmount);
            expect(positions.short).to.equal(0);
            expect(await market.longBids(user1)).to.equal(bidAmount);
        });

        it("Should allow bidding on Short position", async function () {
            const bidAmount = ethers.parseEther("1.0");
            await market.connect(user1).bid(1, { value: bidAmount }); // 1 for Short

            const positions = await market.positions();
            expect(positions.long).to.equal(0);
            expect(positions.short).to.equal(bidAmount);
            expect(await market.shortBids(user1)).to.equal(bidAmount);
        });

        it("Should track total deposits correctly", async function () {
            const longBid = ethers.parseEther("1.0");
            const shortBid = ethers.parseEther("2.0");

            await market.connect(user1).bid(0, { value: longBid }); // Long
            await market.connect(user2).bid(1, { value: shortBid }); // Short

            expect(await market.totalDeposited()).to.equal(longBid + shortBid);
        });

        it("Should fail when not in bidding phase", async function () {
            // Move to maturity phase
            await market.connect(owner).startTrading();

            await expect(
                market.connect(user1).bid(0, { value: ethers.parseEther("1.0") })
            ).to.be.revertedWith("Not in bidding phase");
        });
    });

    describe("Market Resolution", function () {
        beforeEach(async function () {
            // Start bidding phase
            await market.connect(owner).startBidding();

            // Place bids
            await market.connect(user1).bid(0, { value: ethers.parseEther("1.0") }); // Long
            await market.connect(user2).bid(1, { value: ethers.parseEther("1.0") }); // Short

            // Start trading phase
            await market.connect(owner).startTrading();

            // Move time to maturity
            await time.increaseTo(testMaturityTime);
        });

        it("Should resolve with Long win when price is above strike", async function () {
            // Set final price above strike
            const finalPrice = ethers.parseUnits("60000", 18); // Above strike price
            await mockFtso.setPrice(testFeedId, finalPrice, 8);

            // Resolve market
            await market.connect(owner).resolveMarket();

            expect(await market.resolved()).to.equal(true);
            expect(await market.currentPhase()).to.equal(2); // Maturity phase

            const oracleDetails = await market.oracleDetails();
            expect(oracleDetails.finalPrice).to.be.gt(oracleDetails.strikePrice);
        });

        it("Should resolve with Short win when price is below strike", async function () {
            // Set final price below strike
            const finalPrice = ethers.parseUnits("45000", 18); // Below strike price
            await mockFtso.setPrice(testFeedId, finalPrice, 8);

            // Resolve market
            await market.connect(owner).resolveMarket();

            expect(await market.resolved()).to.equal(true);
            expect(await market.currentPhase()).to.equal(2); // Maturity phase

            const oracleDetails = await market.oracleDetails();
            expect(oracleDetails.finalPrice).to.be.lt(oracleDetails.strikePrice);
        });

        it("Should fail to resolve if not owner", async function () {
            await expect(
                market.connect(user1).resolveMarket()
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should fail to resolve before maturity time", async function () {
            // Move back in time before maturity
            await time.increaseTo(testMaturityTime - 1000);

            await expect(
                market.connect(owner).resolveMarket()
            ).to.be.revertedWith("Too early to resolve");
        });
    });

    describe("Reward Claiming", function () {
        beforeEach(async function () {
            // Start bidding phase
            await market.connect(owner).startBidding();

            // Place bids
            await market.connect(user1).bid(0, { value: ethers.parseEther("1.0") }); // Long
            await market.connect(user2).bid(1, { value: ethers.parseEther("1.0") }); // Short

            // Start trading phase
            await market.connect(owner).startTrading();

            // Move time to maturity
            await time.increaseTo(testMaturityTime);
        });

        it("Should allow winner to claim rewards", async function () {
            // Set final price above strike - Long wins
            const finalPrice = ethers.parseUnits("60000", 18);
            await mockFtso.setPrice(testFeedId, finalPrice, 8);

            // Resolve market
            await market.connect(owner).resolveMarket();

            // Move to expiry phase
            await market.connect(owner).expireMarket();

            // Check user1 balance before claim
            const balanceBefore = await ethers.provider.getBalance(user1.address);

            // User1 (Long position) claims reward
            await market.connect(user1).claimReward();

            // Check user1 balance after claim
            const balanceAfter = await ethers.provider.getBalance(user1.address);

            // Should have received reward
            expect(balanceAfter).to.be.gt(balanceBefore);

            // Should be marked as claimed
            expect(await market.hasClaimed(user1.address)).to.equal(true);
        });

        it("Should fail if trying to claim twice", async function () {
            // Set final price above strike - Long wins
            const finalPrice = ethers.parseUnits("60000", 18);
            await mockFtso.setPrice(testFeedId, finalPrice, 8);

            // Resolve market
            await market.connect(owner).resolveMarket();

            // Move to expiry phase
            await market.connect(owner).expireMarket();

            // User1 (Long position) claims reward
            await market.connect(user1).claimReward();

            // Try to claim again
            await expect(
                market.connect(user1).claimReward()
            ).to.be.revertedWith("Reward already claimed");
        });

        it("Should fail if loser tries to claim", async function () {
            // Set final price above strike - Long wins, Short loses
            const finalPrice = ethers.parseUnits("60000", 18);
            await mockFtso.setPrice(testFeedId, finalPrice, 8);

            // Resolve market
            await market.connect(owner).resolveMarket();

            // Move to expiry phase
            await market.connect(owner).expireMarket();

            // User2 (Short position) tries to claim reward
            await expect(
                market.connect(user2).claimReward()
            ).to.be.revertedWith("No deposits on winning side");
        });
    });
}); 