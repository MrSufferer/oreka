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
    rpcUrl: 'https://evmrpc-testnet.0g.ai',
    blockExplorerUrl: 'https://chainscan-galileo.0g.ai'
  }
};

export const getProvider = async () => {
  // Get chainId from MetaMask first
  let chainId: string;
  try {
    chainId = await window.ethereum.request({ method: 'eth_chainId' });
  } catch (error) {
    chainId = window.ethereum.chainId || '0x1';
  }
  
  // Parse chainId to number
  const chainIdNum = parseInt(chainId, 16);
  
  // For 0G Galileo (16602), explicitly configure the network
  // This ensures the provider knows the correct chainId for transactions
  if (chainIdNum === 16602 || chainId === '0x40da') {
    const provider = new ethers.providers.Web3Provider(window.ethereum, {
      name: networkConfig.galileo.name,
      chainId: networkConfig.galileo.chainId,
      ensAddress: null
    });
    
    const network = await provider.getNetwork();
    console.log("Detected network from MetaMask:", network.name, network.chainId);
    return provider;
  }
  
  // For other networks, let ethers auto-detect
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const network = await provider.getNetwork();
  console.log("Detected network from MetaMask:", network.name, network.chainId);
  
  return provider;
}; 