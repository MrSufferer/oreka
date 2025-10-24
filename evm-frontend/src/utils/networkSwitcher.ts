import { networkConfig } from '../config/network';

export interface NetworkInfo {
  chainId: number;
  chainIdHex: string;
  name: string;
  rpcUrl?: string;
  blockExplorerUrl?: string;
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const SUPPORTED_NETWORKS: NetworkInfo[] = [
  {
    chainId: networkConfig.sepolia.chainId,
    chainIdHex: '0xaa36a7',
    name: networkConfig.sepolia.name,
    rpcUrl: 'https://rpc.sepolia.org',
    blockExplorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia ETH',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  {
    chainId: networkConfig.coston2.chainId,
    chainIdHex: '0x72',
    name: networkConfig.coston2.name,
    rpcUrl: 'https://coston2-api.flare.network/ext/C/rpc',
    blockExplorerUrl: 'https://coston2-explorer.flare.network',
    nativeCurrency: {
      name: 'Coston2 Flare',
      symbol: 'C2FLR',
      decimals: 18,
    },
  },
  {
    chainId: networkConfig.galileo.chainId,
    chainIdHex: '0x40da',
    name: networkConfig.galileo.name,
    rpcUrl: networkConfig.galileo.rpcUrl,
    blockExplorerUrl: networkConfig.galileo.blockExplorerUrl,
    nativeCurrency: {
      name: '0G',
      symbol: '0G',
      decimals: 18,
    },
  },
];

/**
 * Switch to a different network in MetaMask
 * @param chainIdHex - The chain ID in hexadecimal format (e.g., '0x40da')
 */
export const switchNetwork = async (chainIdHex: string): Promise<boolean> => {
  if (!window.ethereum) {
    console.error('MetaMask is not installed');
    return false;
  }

  try {
    // Try to switch to the network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
    return true;
  } catch (switchError: any) {
    // This error code indicates that the chain has not been added to MetaMask
    if (switchError.code === 4902) {
      try {
        const network = SUPPORTED_NETWORKS.find(n => n.chainIdHex === chainIdHex);
        if (!network) {
          console.error('Network not found');
          return false;
        }

        // Add the network to MetaMask
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: chainIdHex,
              chainName: network.name,
              rpcUrls: network.rpcUrl ? [network.rpcUrl] : [],
              blockExplorerUrls: network.blockExplorerUrl ? [network.blockExplorerUrl] : [],
              nativeCurrency: network.nativeCurrency,
            },
          ],
        });
        return true;
      } catch (addError) {
        console.error('Failed to add network:', addError);
        return false;
      }
    }
    console.error('Failed to switch network:', switchError);
    return false;
  }
};

/**
 * Get current network info
 */
export const getCurrentNetwork = async (): Promise<NetworkInfo | null> => {
  if (!window.ethereum) {
    return null;
  }

  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    return SUPPORTED_NETWORKS.find(n => n.chainIdHex === chainId) || null;
  } catch (error) {
    console.error('Failed to get current network:', error);
    return null;
  }
};
