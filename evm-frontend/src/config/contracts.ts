import deployedAddress from '../../deployed_address.json';
import FlareFactoryABI from '../contracts/abis/FlareFactoryABI.json';
import FactoryABI from '../contracts/abis/FactoryABI.json';
import FlarePriceFeedHelperABI from '../contracts/abis/FlarePriceFeedHelperABI.json';

// Factory addresses per chain
export const FACTORY_ADDRESSES: { [chainId: string]: string } = {
  '0x72': deployedAddress.FactoryAddress, // Coston2
  '0xaa36a7': deployedAddress.FactoryAddress, // Sepolia
  '0x40da': '0xC8F1403cD1e77eFFF6864bF271a9ED980729524C', // 0G Galileo Testnet
  // Add other chains as needed
};

export const FACTORY_ADDRESS = deployedAddress.FactoryAddress; // Default factory address
export const PRICE_FEED_HELPER_ADDRESS = deployedAddress.PriceFeedHelperAddress;

// Function to get factory address for current chain
export const getFactoryAddress = (chainId: string): string => {
  return FACTORY_ADDRESSES[chainId] || FACTORY_ADDRESS;
};

// Sepolia Price Feed Addresses
export const SEPOLIA_PRICE_FEEDS = {
  "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43": "BTC/USD",
  "0x694AA1769357215DE4FAC081bf1f309aDC325306": "ETH/USD",
  "0xc59e3633baac79493d908e63626716e204a45edf": "LINK/USD",
  "0xc0F82A46033b8BdBA4Bb0B0e28Bc2006F64355bC": "SNX/USD",
  "0xaaabb530434B0EeAAc9A42E25dbC6A22D7bE218E": "WSTETH/USD",
};

// Use helper contract for Flare price feeds
export const isFlarePriceFeed = (chainId) => {
  return chainId === '0x72'; // Coston2 chainId in hex
};

export const getFactoryABI = (chainId) => {
  return isFlarePriceFeed(chainId) ? FlareFactoryABI.abi : FactoryABI.abi;
};

export const PRICE_FEED_MAPPING = SEPOLIA_PRICE_FEEDS;

// Flare feed IDs (these will be fetched from the helper contract)
export const FLARE_FEED_IDS = {
  "BTC/USD": "0x014254432f55534400000000000000000000000000",
  "ETH/USD": "0x014554482f55534400000000000000000000000000",
  "XRP/USD": "0x015852502f55534400000000000000000000000000"
};

export const PRICE_FEED_HELPER_ABI = FlarePriceFeedHelperABI.abi;