// This script deploys the BinaryOptionMarketFlareFactory and FlarePriceFeedHelper contracts to Flare mainnet
const hre = require("hardhat");

async function main() {
    console.log("Deploying contracts to Flare mainnet...");
    console.log("CAUTION: This is deploying to MAINNET. Real funds at risk!");

    // Add a 5-second delay to give the deployer a chance to abort
    console.log("Deploying in 5 seconds... Press Ctrl+C to abort.");
    await new Promise(resolve => setTimeout(resolve, 5000));

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
    if (process.env.FLARE_EXPLORER_API_KEY) {
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

    console.log("Deployment completed successfully!");
    console.log("\nDeployment Summary:");
    console.log("====================");
    console.log(`FlarePriceFeedHelper: ${priceFeedHelperAddress}`);
    console.log(`BinaryOptionMarketFlareFactory: ${factoryAddress}`);

    // Save deployment addresses to a file for future reference
    const fs = require('fs');
    const deploymentData = {
        network: "flare-mainnet",
        chainId: 14,
        timestamp: new Date().toISOString(),
        contracts: {
            FlarePriceFeedHelper: priceFeedHelperAddress,
            BinaryOptionMarketFlareFactory: factoryAddress
        }
    };

    fs.writeFileSync(
        `deployment-mainnet-${Date.now()}.json`,
        JSON.stringify(deploymentData, null, 2)
    );
    console.log(`Deployment data saved to deployment-mainnet-${Date.now()}.json`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 