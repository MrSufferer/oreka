import { ethers } from 'ethers';

// Define the extended window ethereum interface
declare global {
  interface Window {
    ethereum: any;
  }
}

export const networkConfig = {
  anvil: {
    chainId: 31337,
    name: 'anvil',
    ensAddress: null
  },
  sepolia: {
    chainId: 11155111,
    name: 'sepolia',
    ensAddress: null
  },
  coston2: {
    chainId: 114,
    name: 'coston2',
    ensAddress: null
  },
  galileo: {
    chainId: 16602,
    name: '0G Galileo Testnet',
    ensAddress: null,
    rpcUrl: 'https://rpc-testnet.0g.ai',
    blockExplorerUrl: 'https://chainscan-galileo.0g.ai'
  }
};

export const getProvider = () => {
  const chainId = window.ethereum.chainId;
  let networkName, networkChainId;
  
  switch (chainId) {
    case '0x72': // 114 in decimal (Coston2)
      networkName = networkConfig.coston2.name;
      networkChainId = networkConfig.coston2.chainId;
      break;
    case '0xaa36a7': // 11155111 in decimal (Sepolia)
      networkName = networkConfig.sepolia.name;
      networkChainId = networkConfig.sepolia.chainId;
      break;
    case '0x40da': // 16602 in decimal (0G Galileo)
      networkName = networkConfig.galileo.name;
      networkChainId = networkConfig.galileo.chainId;
      break;
    default: // Anvil
      networkName = networkConfig.anvil.name;
      networkChainId = networkConfig.anvil.chainId;
  }
  
  return new ethers.providers.Web3Provider(window.ethereum, {
    name: networkName,
    chainId: networkChainId,
    ensAddress: null
  });
}; 