/*
ListAddressOwner.tsx
@author: Hieu Nguyen
@description: This component displays a list of binary option markets owned by a specific address
@param: ownerAddress - Ethereum address to display contracts for
@param: page - Current pagination page number
*/
import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Box, Button, HStack, Icon, Text, VStack, SimpleGrid, Flex, Input, Select, Divider, Progress, InputGroup, InputRightAddon, Spinner, Slider, SliderTrack, SliderFilledTrack, SliderThumb, Tooltip, Spacer, Image, InputRightElement } from '@chakra-ui/react';
import { FaCalendarDay, FaPlayCircle, FaClock, FaCheckCircle, FaListAlt, FaRegClock, FaDollarSign, FaSearch, FaChevronLeft } from 'react-icons/fa';
import { IoLogoUsd, IoWalletOutline } from "react-icons/io5";
import { FaEthereum, FaWallet, FaTrophy, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import { LiaCoinsSolid } from "react-icons/lia";
import { LuCircleDollarSign } from "react-icons/lu";
import { GoInfinity } from "react-icons/go";
import { SiBitcoinsv, SiChainlink, SiDogecoin } from "react-icons/si";
import { FaCoins } from "react-icons/fa";
import Factory from '../contracts/abis/FactoryABI.json';
import { useToast } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { FACTORY_ADDRESS } from '../config/contracts';
import BinaryOptionMarket from '../contracts/abis/BinaryOptionMarketChainlinkABI.json';
import { useAuth } from '../context/AuthContext';
import { PriceService } from '../services/PriceService';
import { format, formatDistanceToNow } from 'date-fns';
import { getCurrentTimestamp, isTimestampPassed, getTimeRemaining } from '../utils/timeUtils';
import { GrDeploy } from 'react-icons/gr';
import { determineMarketResult } from '../utils/market';

// ListAddressOwnerProps interface
interface ListAddressOwnerProps {
  ownerAddress: string;
  page: number;
}

// ContractData interface
interface ContractData {
  address: string;
  createDate: string;
  longAmount: string;
  shortAmount: string;
  strikePrice: string;
  phase: number;
  maturityTime: string;
  tradingPair: string;
  owner: string;
  indexBg: string;
}

// Phase enum
enum Phase { Trading, Bidding, Maturity, Expiry }


// function to get color for phase
const getPhaseColor = (phase: number) => {
  switch (phase) {
    case Phase.Trading:
      return "green.400";
    case Phase.Bidding:
      return "blue.400";
    case Phase.Maturity:
      return "orange.400";
    case Phase.Expiry:
      return "red.400";
    default:
      return "gray.400";
  }
};

// function to get name for phase
const getPhaseName = (phase: number) => {
  switch (phase) {
    case Phase.Trading:
      return "Trading";
    case Phase.Bidding:
      return "Bidding";
    case Phase.Maturity:
      return "Maturity";
    case Phase.Expiry:
      return "Expiry";
    default:
      return "Unknown";
  }
};


// Function to get market title text
const getMarketTitleText = (contract: any): string => {
  try {
    const pair = contract.tradingPair.replace('/', '-');
    const timestamp = Number(contract.maturityTime);
    if (isNaN(timestamp) || timestamp === 0) return `${pair} Market`;

    const date = new Date(timestamp * 1000);
    const maturityTimeFormatted = format(date, 'MMM d, yyyy h:mm a');

    let strikePriceInteger;
    try {
      strikePriceInteger = ethers.BigNumber.from(contract.strikePrice);
    } catch (e) {
      strikePriceInteger = parseInt(contract.strikePrice);
    }

    let strikePriceFormatted;
    if (pair.includes('BTC') || pair.includes('ETH')) {
      strikePriceFormatted = (strikePriceInteger / 10 ** 8).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    } else {
      strikePriceFormatted = (strikePriceInteger / 10 ** 8).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
      });
    }

    return `${pair} will reach $${strikePriceFormatted} by ${maturityTimeFormatted}?`;
  } catch (error) {
    return 'Unknown Market';
  }
};

// Function to get market title JSX
const getMarketTitleJSX = (contract: any): JSX.Element => {
  const text = getMarketTitleText(contract);

  const bgColors = [
    "#6EE7B7", "#FCD34D", "#FCA5A5", "#A5B4FC", "#F9A8D4",
    "#FDBA74", "#67E8F9", "#C4B5FD", "#F87171", "#34D399"
  ];
  const indexBg = contract.indexBg ?? 0;
  const bgColor = bgColors[indexBg % bgColors.length];

  const pair = contract.tradingPair.replace('/', '-');
  const pairColor = "#FEDF56";

  return (
    <Text>
      <Text as="span" color={pairColor} fontWeight="semibold">{pair}</Text>{' '}
      will reach{' '}
      <Text as="span" color={bgColor} fontWeight="bold">
        ${text.split('$')[1]?.split(' ')[0]}
      </Text>{' '}
      by {text.split('by ')[1]}
    </Text>
  );
};

/**
 * ListAddressOwner Component
 * Displays a list of binary option markets owned by a specific address
 * Provides filtering, pagination, and real-time market data updates
 * 
 * @param {string} ownerAddress - Ethereum address to display contracts for
 * @param {number} page - Current pagination page number
 */
const ListAddressOwner: React.FC<ListAddressOwnerProps> = ({ ownerAddress, page }) => {
  // Authentication and wallet context
  const { isConnected, walletAddress, balance, connectWallet, refreshBalance } = useAuth();

  // Contract data state management
  const [deployedContracts, setDeployedContracts] = useState<ContractData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const toast = useToast();
  const router = useRouter();

  // Contract position percentage tracking for visualizing LONG/SHORT distribution
  const [contractPercentages, setContractPercentages] = useState<{ [key: string]: { long: number, short: number } }>({});

  // Pagination configuration
  const currentPage = page;
  const contractsPerPage = 32;
  const [currentContracts, setCurrentContracts] = useState<ContractData[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ContractData[]>([]);


  // Factory contract address for interacting with the main factory
  const FactoryAddress = FACTORY_ADDRESS;

  // Tab selection for filtering markets
  const [currentTab, setCurrentTab] = useState<string>('All Markets');

  // One week ago timestamp
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  /**
   * Filters contracts based on the currently selected tab
   * Different tabs show different subsets of markets (All, Recent, Active, Expired, By Asset)
   */
  const filteredContracts = currentContracts
  .filter(contract => {
    const contractTimestamp = contract.createDate
      ? new Date(contract.createDate).getTime()
      : Number(contract.maturityTime) * 1000;

    const now = Date.now();

    switch (currentTab) {
      case 'All Markets':
        return true;

      case 'Most recent':
        return (
          contractTimestamp >= oneWeekAgo 
          //  && Number(contract.phase) !== Phase.Maturity &&
          // Number(contract.phase) !== Phase.Expiry
        );

      case 'Quests':
        return Number(contract.phase) === Phase.Trading || Number(contract.phase) === Phase.Bidding;

      case 'Results':
        return Number(contract.phase) === Phase.Maturity || Number(contract.phase) === Phase.Expiry;

      default:
        return contract.tradingPair === currentTab;
    }
  })
  .sort((a, b) => {
    if (currentTab === 'All Markets') {
      const now = Date.now();
      const aMaturity = Number(a.maturityTime) * 1000;
      const bMaturity = Number(b.maturityTime) * 1000;

      const aHasExpired = now > aMaturity;
      const bHasExpired = now > bMaturity;

      // If both are not expired, sort by maturity time
      if (!aHasExpired && !bHasExpired) {
        return aMaturity - bMaturity;
      }

      // If only a has expired, prioritize b
      if (aHasExpired && !bHasExpired) return 1;
      if (!aHasExpired && bHasExpired) return -1;

      // If both have expired, keep the order
      return 0;
    }

    return 0;
  });

  /**
     * Sorts contracts by creation date when "Most recent" tab is selected
     * Newest contracts appear at the top of the list
     */
  useEffect(() => {
    if (currentTab === 'Most recent') {
      // Create a copy of the array to avoid modifying the original state directly
      const sortedContracts = [...currentContracts].sort((a, b) => {
        // Sort by creation date in descending order (newest first)
        return new Date(b.createDate).getTime() - new Date(a.createDate).getTime();
      });
      setCurrentContracts(sortedContracts);
    }
  }, [currentTab]);

  /**
 * Updates displayed contracts when page changes or when contract data updates
 * Slices the full contracts array to show only the current page's worth of contracts
 */
  useEffect(() => {
    const indexOfLastContract = page * contractsPerPage;
    const indexOfFirstContract = indexOfLastContract - contractsPerPage;
    const newCurrentContracts = deployedContracts.slice(indexOfFirstContract, indexOfLastContract);
    setCurrentContracts(newCurrentContracts);
  }, [deployedContracts, page]);

  /**
   * Updates displayed contracts when page changes or when contract data updates
   * Slices the full contracts array to show only the current page's worth of contracts
   */
  useEffect(() => {
    fetchDeployedContracts();
  }, [ownerAddress, page]);

  /**
   * Fetches all deployed contracts from the blockchain
   * Retrieves contracts from known owners and falls back to event logs if needed
   */
  const fetchDeployedContracts = async () => {
    try {
      setLoading(true);

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();
      console.log("Current network:", network.name, network.chainId);

      // Use network-specific factory address if necessary
      let factoryAddress = FACTORY_ADDRESS;
      console.log("Using factory address:", factoryAddress);

      const factoryContract = new ethers.Contract(factoryAddress, Factory.abi, provider);

      console.log("Fetching all contracts from all known owners");

      // List of known wallet addresses to check for contracts
      // Can be expanded with additional addresses as the platform grows
      const knownOwners = [
        // "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Default Hardhat account #0
        // "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Default Hardhat account #1
        // "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Default Hardhat account #2

        // Additional known addresses can be added here
      ];

      // Add current user's address and requested owner address to the lookup list
      if (walletAddress && !knownOwners.includes(walletAddress)) {
        knownOwners.push(walletAddress);
      }
      if (ownerAddress && !knownOwners.includes(ownerAddress)) {
        knownOwners.push(ownerAddress);
      }

      console.log("Known owners:", knownOwners);

      // Retrieve all contracts from all known owner addresses
      let allContracts: string[] = [];

      for (const owner of knownOwners) {
        try {
          if (owner && owner !== "") {
            const ownerContracts = await factoryContract.getContractsByOwner(owner);
            console.log(`Contracts for owner ${owner}:`, ownerContracts);

            // Add new contracts to the list (avoiding duplicates)
            ownerContracts.forEach((contract: string) => {
              if (!allContracts.includes(contract)) {
                allContracts.push(contract);
              }
            });
          }
        } catch (err) {
          console.error(`Error fetching contracts for owner ${owner}:`, err);
        }
      }

      console.log("All contracts:", allContracts);

      // Fallback to event logs if no contracts found through direct lookup
      if (allContracts.length === 0) {
        try {
          console.log("Trying to fetch from event logs");
          const filter = factoryContract.filters.Deployed();
          const events = await factoryContract.queryFilter(filter);

          console.log("Found events:", events.length);

          // Extract contract addresses from deployment events
          events.forEach(event => {
            const contractAddress = event.args?.contractAddress;
            if (contractAddress && !allContracts.includes(contractAddress)) {
              allContracts.push(contractAddress);
            }
          });

          console.log("Contracts from events:", allContracts);
        } catch (error) {
          console.error("Error fetching from events:", error);
        }
      }

      // Fetch detailed data for each contract address
      const contractsData = await Promise.all(allContracts.map(async (address: string) => {
        const contract = new ethers.Contract(address, BinaryOptionMarket.abi, provider);

        try {
          // Get basic data from contract
          const [
            positions,
            oracleDetails,
            phase,
            maturityTimeBN,
            tradingPair,
            owner
          ] = await Promise.all([
            contract.positions(),
            contract.oracleDetails(),
            contract.currentPhase(),
            contract.maturityTime(),
            contract.tradingPair().catch(() => 'Unknown'),
            contract.owner()
          ]);

          const strikePriceBN = oracleDetails.strikePrice;

          // Handle background index separately
          let indexBgValue = 1; // Default random value
          try {
            const indexBgResult = await contract.indexBg();
            indexBgValue = indexBgResult.toNumber ? indexBgResult.toNumber() : parseInt(indexBgResult.toString());
            console.log(`Contract ${address} has indexBg: ${indexBgValue}`);
          } catch (error) {
            console.log(`Error getting indexBg for contract ${address}, using random: ${indexBgValue}`);
          }

          // Convert maturityTime from BigNumber to number
          let maturityTimeValue;
          if (maturityTimeBN && typeof maturityTimeBN.toNumber === 'function') {
            maturityTimeValue = maturityTimeBN.toNumber();
            console.log("Converted maturityTime from BigNumber:", maturityTimeValue);
          } else if (typeof maturityTimeBN === 'string') {
            maturityTimeValue = parseInt(maturityTimeBN);
            console.log("Converted maturityTime from string:", maturityTimeValue);
          } else {
            maturityTimeValue = maturityTimeBN;
            console.log("Using maturityTime as is:", maturityTimeValue);
          }

          // Check for valid maturityTime
          if (!maturityTimeValue || isNaN(maturityTimeValue) || maturityTimeValue <= 0) {
            console.log("Invalid maturityTime, using current time + 1 day as fallback");
            maturityTimeValue = Math.floor(Date.now() / 1000) + 86400; // Current time + 1 day
          }

          // Diagnostic logging for maturity time validation
          const maturityDate = new Date(maturityTimeValue * 1000);
          console.log("Maturity date:", maturityDate.toISOString());
          console.log("Current time:", new Date().toISOString());
          console.log("Is maturity in the past?", maturityDate <= new Date());

          return {
            address,
            createDate: new Date().toISOString(),
            longAmount: ethers.utils.formatEther(positions.long),
            shortAmount: ethers.utils.formatEther(positions.short),
            strikePrice: strikePriceBN.toString(),
            phase: phase.toString(),
            maturityTime: maturityTimeValue,
            tradingPair,
            owner,
            indexBg: indexBgValue.toString()
          };
        } catch (error) {
          console.error(`Error fetching data for contract ${address}:`, error);
          return {
            address,
            createDate: new Date().toISOString(),
            longAmount: '0',
            shortAmount: '0',
            strikePrice: '0',
            phase: '0',
            maturityTime: 0,
            tradingPair: 'Unknown',
            owner: '',
            indexBg: '1'
          };
        }
      }));

      setDeployedContracts(contractsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching deployed contracts:", error);
      setLoading(false);
    }
  };

  /**
   * Log owner address on component mount for debugging
   */
  useEffect(() => {
    console.log("Component mounted. Owner address:", ownerAddress);
  }, []);

  /**
 * Initial contract data loading when owner address changes
 */
  useEffect(() => {
    fetchDeployedContracts();
  }, [ownerAddress]);

  /**
   * Get icon by symbol
   * @param {string} tradingPair - The trading pair symbol
   * @returns {React.ReactNode} The icon component
   */
  const getIconBySymbol = (tradingPair: string) => {
    if (tradingPair.includes("BTC")) return SiBitcoinsv;
    if (tradingPair.includes("ETH")) return FaEthereum;
    if (tradingPair.includes("LINK")) return SiChainlink;
    if (tradingPair.includes("DAI")) return SiDogecoin;
    if (tradingPair.includes("USDC")) return IoLogoUsd;
    return FaDollarSign; // fallback mặc định
  };

  /**
   * Set up event listeners for new contract deployments
   * Refreshes contract list automatically when new contracts are deployed
   */
  useEffect(() => {
    fetchDeployedContracts();

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = new ethers.Contract(FactoryAddress, Factory.abi, provider);

    /**
     * Handler for new contract deployment events
     * @param {string} owner - Address of the contract owner
     * @param {string} contractAddress - Address of the newly deployed contract
     * @param {number} index - Index of the contract in the owner's list
     */
    const handleNewContract = (owner: string, contractAddress: string, index: number) => {
      console.log("New contract deployed event received:", contractAddress);
      console.log("Owner:", owner);
      console.log("Index:", index);

      // Always update contract list when a new contract is deployed
      fetchDeployedContracts();
    };

    // Listen for Deployed events
    contract.on("Deployed", handleNewContract);

    // Cleanup listener on unmount
    return () => {
      contract.removeListener("Deployed", handleNewContract);
    };
  }, []);

  /**
 * Handles contract selection and navigation
 * Stores contract data in localStorage and redirects to appropriate view
 * 
 * @param {string} contractAddress - Address of the selected contract
 * @param {string} owner - Owner address of the contract
 * @param {ContractData} contractData - Full contract data object
 */
  const handleAddressClick = (contractAddress: string, owner: string, contractData: ContractData) => {
    // Store contract address in localStorage for persistence across page navigations
    localStorage.setItem('selectedContractAddress', contractAddress);

    // Store additional contract data for Customer.tsx to use immediately
    localStorage.removeItem('contractData');


    // Always navigate to the customer view for the contract
    router.push({
      pathname: `/customer/${contractData.address}`,
      query: {
        data: JSON.stringify(contractData), // serialize object
      },
    });

  };

  /**
   * Shortens an Ethereum address for display purposes
   * @param {string} address - The full Ethereum address to shorten
   * @returns {string} - The shortened version of the address
   */
  const shortenAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  /**
   * Updates balance in real-time using Web3Provider
   * Listens for block events to refresh balance
   */
  useEffect(() => {
    if (isConnected) {
      refreshBalance();

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      provider.on("block", refreshBalance);

      return () => {
        provider.removeAllListeners("block");
      };
    }
  }, [isConnected, refreshBalance]);

  /**
 * State for storing fixed background image indices for contract cards
 * Maps contract addresses to specific background image indices
 */
  const [contractImageIndices, setContractImageIndices] = useState<{ [key: string]: number }>({});

  /**
 * State for storing countdown timers for each contract
 * Maps contract addresses to formatted time remaining strings
 */
  const [countdowns, setCountdowns] = useState<{ [key: string]: string }>({});

  /**
  * Updates countdown timers for all contracts every second
  * Shows "Ended" for expired contracts and time remaining for active ones
  */
  useEffect(() => {
    /**
    * Updates all contract countdowns with current values
    */
    const updateCountdowns = () => {
      const newCountdowns: { [key: string]: string } = {};

      currentContracts.forEach(contract => {
        const timestamp = Number(contract.maturityTime);
        if (!isNaN(timestamp) && timestamp > 0) {
          if (isTimestampPassed(timestamp)) {
            newCountdowns[contract.address] = "Ended";
          } else {
            newCountdowns[contract.address] = getTimeRemaining(timestamp);
          }
        } else {
          newCountdowns[contract.address] = "Unknown";
        }
      });

      setCountdowns(newCountdowns);
    };

    // Update countdowns immediately
    updateCountdowns();

    // Set interval to update countdowns every second
    const intervalId = setInterval(updateCountdowns, 1000);

    return () => clearInterval(intervalId);
  }, [currentContracts]);

  /**
  * Assigns fixed background image indices to contracts when the contract list changes
  * Uses indexBg from contract data if available, with fallback to default value
  */
  useEffect(() => {
    console.log("Setting contract image indices...");
    const newImageIndices: { [key: string]: number } = {};

    currentContracts.forEach(contract => {
      if (!contract) return;

      // Get indexBg from contract data
      let bgIndex: number;

      if (contract.indexBg && contract.indexBg !== '0') {
        // Use indexBg from contract
        bgIndex = parseInt(contract.indexBg);
        console.log(`Contract ${contract.address} has indexBg from contract: ${bgIndex}`);
      } else {
        // Generate a random indexBg if not available
        bgIndex = 1; // Random value between 1-10
        console.log(`Contract ${contract.address} using generated indexBg: ${bgIndex}`);
      }

      // Ensure value is between 1-10
      bgIndex = Math.min(Math.max(bgIndex, 1), 10);
      newImageIndices[contract.address] = bgIndex;
    });

    setContractImageIndices(newImageIndices);
  }, [currentContracts]);

  /**
 * Renders time remaining for a contract using the countdown state
 * 
 * @param {string} contractAddress - Address of the contract to display time for
 * @return {string} Formatted time remaining or status message
 */
  const renderTimeRemaining = (contractAddress: string) => {
    const countdown = countdowns[contractAddress];
    if (!countdown) return "Unknown";

    return countdown;
  };

  /**
   * State for storing current prices of asset pairs
   * Maps asset pairs to their current prices
   */
  const [assetPrices, setAssetPrices] = useState<{ [key: string]: number }>({});

  /**
   * Replaces the old useEffect for polling prices with WebSocket implementation
   * Uses Coinbase WebSocket API to get real-time price updates
   */
  useEffect(() => {
    if (deployedContracts.length === 0) return;

    // Get unique pairs from deployed contracts
    const uniquePairs = Array.from(new Set(
      deployedContracts.map(c => c.tradingPair.replace('/', '-'))
    ));

    // Get price service instance
    const priceService = PriceService.getInstance();

    // Format pair for display
    const formatPairForDisplay = (apiSymbol: string) => apiSymbol.replace('-', '/');

    // Subscribe to WebSocket prices
    const unsubscribe = priceService.subscribeToWebSocketPrices((priceData) => {
      const displaySymbol = formatPairForDisplay(priceData.symbol);
      setAssetPrices(prev => ({
        ...prev,
        [displaySymbol]: priceData.price
      }));
    }, uniquePairs);

    // Fetch initial prices for unique pairs
    uniquePairs.forEach(async (pair) => {
      try {
        const priceData = await priceService.fetchPrice(pair);
        const displaySymbol = formatPairForDisplay(pair);
        setAssetPrices(prev => ({
          ...prev,
          [displaySymbol]: priceData.price
        }));
      } catch (error) {
        console.error(`Error fetching initial price for ${pair}:`, error);
      }
    });

    // Cleanup WebSocket subscription on unmount
    return () => unsubscribe();
  }, [deployedContracts]);


  /**
   * Calculates percentage of long and short positions for each contract
   * Maps contract addresses to their respective percentages
   */
  useEffect(() => {
    const newPercentages: { [key: string]: { long: number, short: number } } = {};

    currentContracts.forEach(contract => {
      const longAmount = parseFloat(contract.longAmount || '0');
      const shortAmount = parseFloat(contract.shortAmount || '0');
      const total = longAmount + shortAmount;

      if (total > 0) {
        const longPercent = (longAmount / total) * 100;
        const shortPercent = (shortAmount / total) * 100;

        newPercentages[contract.address] = {
          long: longPercent,
          short: shortPercent
        };
      } else {
        // Default to 50/50 if no amounts are present
        newPercentages[contract.address] = {
          long: 50,
          short: 50
        };
      }
    });

    // Update contract percentages state
    setContractPercentages(newPercentages);
  }, [currentContracts]);

  /**
   * State for storing market titles for each contract
   * Maps contract addresses to their respective titles
   */
  const [marketTitles, setMarketTitles] = useState({});

  /**
   * Fetches market titles for all deployed contracts
   * Maps contract addresses to their respective titles
   */
  useEffect(() => {
    const fetchTitles = async () => {
      const titles = {};
      for (const contract of deployedContracts) {
        titles[contract.address] = await getMarketTitleJSX(contract);
      }
      setMarketTitles(titles);
    };

    if (deployedContracts.length > 0) {
      fetchTitles();
    }
  }, [deployedContracts]);

  /**
   * Filters contracts based on a search query
   * @param {string} query - The search query to filter contracts by
   * @returns {ContractData[]} - Array of filtered contracts
   */
  const filterContractsByQuery = (query: string) => {
    const lowerCaseQuery = query.toLowerCase();
    return deployedContracts.filter(contract => {
      const title = getMarketTitleText(contract).toLowerCase();
      return title.includes(lowerCaseQuery);
    });
  };

  return (
    <Box bg="#0A0B0E" minH="100vh">
      {/* Application header with wallet connection status */}
      <Flex
        as="header"
        align="center"
        justify="space-between"
        p={4}
        bg="#0A0B0E"
        borderBottom="1px"
        borderColor="gray.200"
        position="sticky"
        top="0"
        zIndex="sticky"
        boxShadow="sm"
      >
        {/* Left group: Logo + Search */}
        <HStack spacing={6}>
          <Text
            fontSize="5xl"
            fontWeight="bold"
            bgGradient="linear(to-r, #4a63c8, #5a73d8, #6a83e8)"
            bgClip="text"
            letterSpacing="wider"
            textShadow="0 0 10px rgba(74, 99, 200, 0.7), 0 0 20px rgba(74, 99, 200, 0.5)"
            fontFamily="'Orbitron', sans-serif"
          >
            OREKA
          </Text>

          {/* Search input */}
          <Box position="relative" maxW="600px" w="100%" height="50px" display="flex" alignItems="center">
            <InputGroup ml="50px" w="500px" height="50px">
              <Input
                placeholder="Search OREKA"
                value={searchQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchQuery(value);
                  if (value.trim() === '') {
                    setSearchResults([]);
                  } else {
                    const results = filterContractsByQuery(value); 
                    setSearchResults(results);
                  }
                }}
                bg="#1A1C21"
                color="white"
                borderColor="gray.600"
                borderRadius="3xl"
                fontSize="md"
                py={6}
                px={4}
                boxShadow="0 4px 10px rgba(0, 0, 0, 0.2)"
                _placeholder={{ color: 'gray.400' }}
                _focus={{ borderColor: 'blue.400', boxShadow: '0 0 0 2px rgba(66, 153, 225, 0.6)' }}
                _hover={{ borderColor: 'blue.300' }}
              />
              <InputRightElement pointerEvents="none" height="90%" pr={4} mr="5px" mt="1px" mb="1px"
                children={<Icon as={FaSearch} color="gray.400" />}
                bg="#1A1C21"
                borderColor="gray.600"
                borderRadius="3xl"
              />
            </InputGroup>

            {/* Search results */}
            {searchResults.length > 0 && (
              <Box
                position="absolute"
                top="60px"
                left="0"
                width="100%"
                bg="gray.900"
                borderRadius="lg"
                boxShadow="xl"
                zIndex="dropdown"
                maxHeight="300px"
                overflowY="auto"
                border="1px solid"
                borderColor="gray.700"
              >
                {searchResults.slice(0, 6).map((contract) => {
                  const tradingPair = contract.tradingPair || "";
                  const address = contract.address;
                  const baseToken = tradingPair.split('/')[0]?.toLowerCase();
                  const imageIndex = contractImageIndices?.[address] || 1;
                  const imageSrc = `/images/${baseToken}/${baseToken}${imageIndex}.png`;

                  return (
                    <Box
                      key={address}
                      display="flex"
                      alignItems="center"
                      px={4}
                      py={3}
                      _hover={{ bg: "gray.700", cursor: "pointer" }}
                      onClick={() => {
                        handleAddressClick(contract.address, contract.owner, contract);
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                    >
                      <Image
                        src={imageSrc}
                        alt="token"
                        boxSize="32px"
                        borderRadius="full"
                        mr={4}
                        fallbackSrc="/images/default-token.png"
                      />
                      <Text fontSize="sm" fontWeight="medium" color="white">
                        {getMarketTitleJSX(contract)}
                      </Text>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>

        </HStack>

        {/* Right group: Wallet info */}
        {isConnected ? (
          <HStack spacing={4}>
            <Box
              mr="10px"
              bg="#1A1C21"
              borderRadius="3xl"
              border="1px solid transparent"
              backgroundImage="linear-gradient(to right, #00B894, #00A8FF)"
              boxShadow="0 4px 10px rgba(0, 0, 0, 0.3)"
            >
              <Button
                leftIcon={<GrDeploy />}
                variant="solid"
                color="white"
                bg="#1A1C21"
                borderRadius="3xl"
                onClick={() => router.push('/owner')}
                _hover={{
                  bg: 'rgba(0, 183, 148, 0.8)',
                  color: 'white',
                  transform: 'scale(1.05)',
                }}
                _active={{
                  transform: 'scale(0.95)',
                }}
              >
                Deploy Markets
              </Button>
            </Box>
            <HStack
              p={2}
              bg="#1A1C21"
              borderRadius="md"
              borderWidth="1px"
              borderColor="gray.200"
            >
              <Icon as={LiaCoinsSolid} color="#FEDF56" />
              <Text color="#FEDF56" fontWeight="medium">
                {parseFloat(balance).toFixed(4)} ETH
              </Text>
            </HStack>
            <Button
              leftIcon={<FaWallet />}
              colorScheme="blue"
              variant="outline"
              size="md"
            >
              {shortenAddress(walletAddress)}
            </Button>
          </HStack>
        ) : (
          <Button
            leftIcon={<FaWallet />}
            colorScheme="blue"
            size="md"
            onClick={connectWallet}
          >
            Connect Wallet
          </Button>
        )}
      </Flex>



      <Box p={6}>
        {/* Header with tabs */}
        <Box mb={6}>

          {/* Horizontally scrollable tab navigation */}
          <Flex
            overflowX="auto"
            pb={2}
            mb={4}
            css={{
              '&::-webkit-scrollbar': {
                height: '8px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(0,0,0,0.1)',
                borderRadius: '4px',
              }
            }}
          >
            <HStack spacing={4}>
              {/* List of tabs */}
              {['All Markets', 'Most recent', 'Quests', 'Results', 'BTC/USD', 'ETH/USD', 'LINK/USD', 'DAI/USD', 'USDC/USD'].map((tab) => (
                <Button
                  key={tab}
                  size="md"
                  variant={currentTab === tab ? "solid" : "ghost"}
                  colorScheme={currentTab === tab ? "blue" : "gray"}
                  onClick={() => setCurrentTab(tab)}
                  minW="120px"
                  leftIcon={
                    tab === 'All Markets' ? <FaListAlt /> :
                      tab === 'Most recent' ? <FaCalendarDay /> :
                        tab === 'Quests' ? <FaPlayCircle /> :
                          tab === 'Results' ? <FaTrophy /> :
                            tab === 'BTC/USD' ? <SiBitcoinsv /> :
                              tab === 'ETH/USD' ? <FaEthereum /> :
                                tab === 'LINK/USD' ? <SiChainlink /> :
                                  tab === 'DAI/USD' ? < SiDogecoin /> :
                                    tab === 'USDC/USD' ? <IoLogoUsd /> :
                                      <FaCoins />
                  }
                >
                  {tab}
                </Button>
              ))}
            </HStack>
          </Flex>
        </Box>

        {loading ? (
          // {/* Loading message */}
          <Text color="gray.600">Loading...</Text>
        ) : deployedContracts.length > 0 ? (
          // {/* Display contracts in a grid layout */}
          <SimpleGrid
            columns={{ base: 1, md: 2, lg: 3, xl: 4 }}
            spacing={4}
            width="100%"
          >
            {filteredContracts.map(({ address, createDate, longAmount, shortAmount, phase, maturityTime, tradingPair, owner }, index) => (

              <Box
                key={index}
                p="2px"
                borderRadius="lg"
                background="linear-gradient(135deg, #00c6ff, #0072ff, #6a11cb, #2575fc)" 
                transition="transform 0.2s"
                _hover={{ transform: 'translateY(-4px)' }}
                cursor="pointer"
              >
                <Box
                  borderRadius="md"
                  overflow="hidden"
                  boxShadow="md"
                  bg="#1A202C"
                  onClick={() =>
                    handleAddressClick(address, owner, {
                      address,
                      createDate,
                      longAmount,
                      shortAmount,
                      phase,
                      maturityTime,
                      tradingPair,
                      owner,
                      indexBg: contractImageIndices[address] ? contractImageIndices[address].toString() : '1'
                    })
                  }
                >
                  {/* Image section - use fixed random number from state */}
                  <Box
                    h="230px"
                    w="100%"
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    bg="#151A23"
                    p={1}
                    position="relative"

                  >
                    <Image
                      src={`/images/${tradingPair.split('/')[0].toLowerCase()}/${tradingPair.split('/')[0].toLowerCase()}${contractImageIndices[address] || 1}.png`}
                      alt={tradingPair}
                      w="100%"
                      h="100%"
                      objectFit="cover"
                      position="relative"
                      fallback={<Box h="100%" w="100%" bg="#1A202C" borderRadius="full" />}
                    />
                    <Box
                      display="inline-block"
                      bg={getPhaseColor(parseInt(phase))}
                      color="white"
                      px={3}
                      py={1}
                      borderRadius="md"
                      fontSize="sm"
                      fontWeight="bold"
                      mb={2}
                      position="absolute"
                      bottom="3px"
                      left="7px"
                    >
                      {getPhaseName(parseInt(phase))}
                    </Box>
                  </Box>

                  {/* Info section in the middle */}
                  <Box p={3}>
                    {/* Phase indicator */}


                    {/* Market title */}
                    <Box fontSize="xl" fontWeight="semibold" color="white" mb={2}>
                      {marketTitles[address] || "Loading..."}
                    </Box>


                    <HStack direction="column" w="100%" mb={4} width="650px">
                      {Number(phase) === Phase.Maturity || Number(phase) === Phase.Expiry ? (
                        <Box
                          w="380px"
                          py={2}
                          alignItems="center"
                          borderRadius="md"
                          bg={determineMarketResult(Number(longAmount), Number(shortAmount)) === 'LONG' ? "#1B3B3F" : "#3D243A"}
                          border="1px solid"
                          borderColor="gray.600"
                          textAlign="center"
                        >
                          <Text
                            fontSize="md"
                            fontWeight="bold"
                            color={determineMarketResult(Number(longAmount), Number(shortAmount)) === 'LONG' ? "#20BCBB" : "#FF6492"}
                          >
                            {determineMarketResult(Number(longAmount), Number(shortAmount))}
                          </Text>
                        </Box>
                      ) : (
                        <>
                          {/* Percentage LONG */}
                          <Flex justify="space-between" mb={1}>
                            <Text fontSize="sm" fontWeight="bold" color="#5FDCC6" textAlign="left">
                              {contractPercentages[address]?.long.toFixed(0)}%
                            </Text>
                          </Flex>

                          {/* Long/Short bar */}
                          <Flex
                            w="100%"
                            h="13px"
                            borderRadius="full"
                            overflow="hidden"
                            border="1px solid"
                            borderColor="gray.600"
                            bg="gray.800"
                            boxShadow="inset 0 1px 3px rgba(0,0,0,0.6)"
                            mt="20px"
                            mb="10px"
                          >
                            <Box
                              h="100%"
                              w={`${contractPercentages[address]?.long}%`}
                              bgGradient="linear(to-r, #00ea00, #56ff56, #efef8b)"
                              transition="width 0.6s ease"
                            />

                            <Box
                              h="100%"
                              w={`${contractPercentages[address]?.short}%`}
                              bgGradient="linear(to-r, #FF6B81, #D5006D)"
                              transition="width 0.6s ease"
                            />
                          </Flex>

                          {/* Percentage SHORT */}
                          <Flex justify="space-between" w="100%">
                            <Text fontSize="sm" fontWeight="bold" color="#ED5FA7" textAlign="left">
                              {contractPercentages[address]?.short.toFixed(0)}%
                            </Text>
                          </Flex>
                        </>
                      )}
                    </HStack>


                    {/* Divider */}
                    <Divider my={4} borderColor="gray.600" />

                    {/* Price and time remaining */}
                    <Flex justify="space-between" align="center">
                      <HStack spacing={2}>
                        <Icon as={getIconBySymbol(tradingPair)} color="blue.300" boxSize={6} />
                        <Text fontWeight="bold" fontSize="lg" color="white">
                          {assetPrices[tradingPair]
                            ? `$${assetPrices[tradingPair].toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}`
                            : "Loading..."}
                        </Text>
                      </HStack>
                      <HStack>
                        <Icon as={FaRegClock} color="gray.400" />
                        <Text fontSize="sm" color="gray.400" textAlign="right">
                          {renderTimeRemaining(address)}
                        </Text>
                      </HStack>
                    </Flex>
                  </Box>
                </Box>
              </Box>
            ))}
          </SimpleGrid>
        ) : (
          <Text color="gray.600">No contracts found for this owner.</Text>
        )}
      </Box>
    </Box>
  );
};

export default ListAddressOwner;