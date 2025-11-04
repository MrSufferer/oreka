// This script deploys the BinaryOptionMarketLLMFactory contract
const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying BinaryOptionMarketLLMFactory...");

    // Get the signers
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deploying with the account: ${deployer.address}`);
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);

    // Deploy BinaryOptionMarketLLMFactory
    console.log("Deploying BinaryOptionMarketLLMFactory...");
    const BinaryOptionMarketLLMFactory = await hre.ethers.getContractFactory("BinaryOptionMarketLLMFactory");
    const factory = await BinaryOptionMarketLLMFactory.deploy();
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log(`BinaryOptionMarketLLMFactory deployed to: ${factoryAddress}`);

    // Get network info
    const network = await deployer.provider.getNetwork();
    console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);

    // Verify contracts if an API key is available and on supported network
    const networkName = network.name;
    if (networkName === "sepolia" || networkName === "mainnet") {
        const explorerApiKey = networkName === "sepolia" 
            ? process.env.ETHERSCAN_API_KEY 
            : process.env.ETHERSCAN_API_KEY;
        
        if (explorerApiKey) {
            try {
                console.log("Verifying BinaryOptionMarketLLMFactory...");
                await hre.run("verify:verify", {
                    address: factoryAddress,
                    constructorArguments: [],
                });
                console.log("Contract verified successfully!");
            } catch (error) {
                console.error("Contract verification failed:", error.message);
            }
        } else {
            console.log("Skipping contract verification - no API key provided");
        }
    } else {
        console.log("Skipping contract verification - network not supported for verification");
    }

    console.log("\n=== Deployment Summary ===");
    console.log(`Factory Address: ${factoryAddress}`);
    console.log(`Network: ${network.name} (${network.chainId})`);
    console.log("\nUpdate evm-frontend/src/config/contracts.ts with the factory address");
    console.log("Deployment completed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

