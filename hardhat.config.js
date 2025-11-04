require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        compilers: [
            {
                version: "0.8.20",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200
                    }
                }
            },
            {
                version: "0.8.26",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200
                    }
                }
            }
        ]
    },
    networks: {
        // Flare Mainnet
        flare: {
            url: process.env.FLARE_RPC_URL || "https://flare-api.flare.network/ext/C/rpc",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 14,
            gasPrice: 225000000000, // 225 Gwei
        },
        // Flare Testnet (Coston2)
        coston2: {
            url: process.env.COSTON2_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 114,
            gasPrice: 225000000000, // 225 Gwei
        },
        // 0G Galileo Testnet
        galileo: {
            url: process.env.GALILEO_RPC_URL || "https://evmrpc-testnet.0g.ai",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 16602,
        },
        // Sepolia Testnet
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 11155111,
        }
    },
    etherscan: {
        apiKey: {
            flare: process.env.FLARE_EXPLORER_API_KEY || "",
            coston2: process.env.COSTON2_EXPLORER_API_KEY || ""
        },
        customChains: [
            {
                network: "flare",
                chainId: 14,
                urls: {
                    apiURL: "https://api.routescan.io/v2/network/mainnet/evm/14/etherscan",
                    browserURL: "https://explorer.flare.network"
                }
            },
            {
                network: "coston2",
                chainId: 114,
                urls: {
                    apiURL: "https://api.routescan.io/v2/network/testnet/evm/114/etherscan",
                    browserURL: "https://coston2-explorer.flare.network"
                }
            }
        ]
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts"
    }
}; 