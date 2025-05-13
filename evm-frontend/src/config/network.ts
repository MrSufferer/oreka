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
  }
};

export const getProvider = () => {
  return new ethers.providers.Web3Provider(window.ethereum, {
    name: window.ethereum.chainId === '0x72' ? networkConfig.coston2.name :
      window.ethereum.chainId === '0xaa36a7' ? networkConfig.sepolia.name :
        networkConfig.anvil.name,
    chainId: window.ethereum.chainId === '0x72' ? networkConfig.coston2.chainId :
      window.ethereum.chainId === '0xaa36a7' ? networkConfig.sepolia.chainId :
        networkConfig.anvil.chainId,
    ensAddress: null
  });
}; 