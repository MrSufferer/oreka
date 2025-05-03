// This script deploys the BinaryOptionMarketFlareFactory and FlarePriceFeedHelper contracts to Flare's Coston2 testnet
const hre = require("hardhat");

async function main() {
    console.log("Deploying contracts to Coston2 testnet...");

    // Get the signers
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deploying contracts with the account: ${deployer.address}`);

    // Deploy FlarePriceFeedHelper
    console.log("Deploying FlarePriceFeedHelper...");
    const FlarePriceFeedHelper = await hre.ethers.getContractFactory("FlarePriceFeedHelper");
    const priceFeedHelper = await FlarePriceFeedHelper.deploy();
    await priceFeedHelper.waitForDeployment();
    const priceFeedHelperAddress = await priceFeedHelper.getAddress();
    console.log(`FlarePriceFeedHelper deployed to: ${priceFeedHelperAddress}`);

    // Deploy BinaryOptionMarketFlareFactory
    console.log("Deploying BinaryOptionMarketFlareFactory...");
    const BinaryOptionMarketFlareFactory = await hre.ethers.getContractFactory("BinaryOptionMarketFlareFactory");
    const factory = await BinaryOptionMarketFlareFactory.deploy();
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log(`BinaryOptionMarketFlareFactory deployed to: ${factoryAddress}`);

    // Verify contracts if an API key is available
    if (process.env.COSTON2_EXPLORER_API_KEY) {
        try {
            console.log("Verifying FlarePriceFeedHelper...");
            await hre.run("verify:verify", {
                address: priceFeedHelperAddress,
                constructorArguments: [],
                contract: "contracts/FlarePriceFeedHelper.sol:FlarePriceFeedHelper"
            });

            console.log("Verifying BinaryOptionMarketFlareFactory...");
            await hre.run("verify:verify", {
                address: factoryAddress,
                constructorArguments: [],
                contract: "contracts/BinaryOptionMarketFlareFactory.sol:BinaryOptionMarketFlareFactory"
            });

            console.log("Contracts verified successfully!");
        } catch (error) {
            console.error("Contract verification failed:", error);
        }
    } else {
        console.log("Skipping contract verification - no API key provided");
    }

    // Create an example market (optional)
    try {
        console.log("Creating an example BTC/USD market...");

        // Get BTC/USD feed ID from helper
        const BTC_USD_FEED_ID = await priceFeedHelper.BTC_USD_FEED_ID();

        // Set maturity time to 24 hours from now
        const maturityTime = Math.floor(Date.now() / 1000) + 86400;

        // Strike price at current BTC price + 5%
        const [btcPrice, decimals] = await priceFeedHelper.getPriceForFeed(BTC_USD_FEED_ID);
        const strikePrice = btcPrice.mul(105).div(100); // 5% above current price

        // Create the market
        const tx = await factory.createMarket(
            "BTC/USD",
            BTC_USD_FEED_ID,
            strikePrice,
            maturityTime,
            10, // 1% fee
            1 // Background index
        );

        await tx.wait();
        const marketCount = await factory.getDeployedMarketsCount();
        const marketAddress = await factory.deployedMarkets(marketCount - 1);

        console.log(`Example BTC/USD market created at: ${marketAddress}`);
        console.log(`Strike price: ${strikePrice}`);
        console.log(`Maturity time: ${new Date(maturityTime * 1000).toLocaleString()}`);
    } catch (error) {
        console.error("Failed to create example market:", error);
    }

    console.log("Deployment completed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 