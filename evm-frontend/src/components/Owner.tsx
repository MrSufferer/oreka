import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Box, Button, Input, VStack, useToast, HStack, Icon, SimpleGrid, Text, Select, Divider, Progress, InputGroup, InputRightAddon, Spinner, Slider, SliderTrack, SliderFilledTrack, SliderThumb, Tooltip, InputRightElement } from '@chakra-ui/react';
import { FaEthereum, FaWallet, FaArrowUp, FaArrowDown, FaClock } from 'react-icons/fa';
import BinaryOptionMarket from '../contracts/abis/BinaryOptionMarketABI.json';
import Factory from '../contracts/abis/FactoryABI.json';  // ABI of Factory contract
import { FACTORY_ADDRESS } from '../config/contracts';
import { setContractTradingPair } from '../config/tradingPairs';
import { useAuth } from '../context/AuthContext';
import { UnorderedList, ListItem } from '@chakra-ui/react';
import { PriceService } from '../services/PriceService';
import { format, toZonedTime } from 'date-fns-tz';

interface OwnerProps {
  address: string;
}

// Add interface for Coin with currentPrice
interface Coin {
  value: string;
  label: string;
  currentPrice: number;
}

// Add constant for converting real number
const STRIKE_PRICE_MULTIPLIER = 100000000; // 10^8 - allow up to 8 decimal places

// Owner component: Allows users to create and manage binary option markets
// This component handles market creation, fee setting, and contract deployment
const Owner: React.FC<OwnerProps> = ({ address }) => {
  // Authentication context for wallet connection and balance
  const { isConnected, walletAddress, balance, connectWallet, refreshBalance } = useAuth();

  // State for contract information
  const [contractAddress, setContractAddress] = useState('');
  const [strikePrice, setStrikePrice] = useState('');
  const [contractBalance, setContractBalance] = useState('');
  const [deployedContracts, setDeployedContracts] = useState<string[]>([]); // Stores list of user's deployed contracts

  // State for trading pair selection
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);

  // State for maturity date and time
  const [maturityDate, setMaturityDate] = useState('');
  const [maturityTime, setMaturityTime] = useState('');

  // State for gas settings and fee estimation
  const [gasPrice, setGasPrice] = useState('78');
  const [estimatedGasFee, setEstimatedGasFee] = useState('276.40');
  const [estimatedGasUnits, setEstimatedGasUnits] = useState<string>("0");
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);
  const [daysToExercise, setDaysToExercise] = useState<string>('Not set');

  // State for price tracking
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChangePercent, setPriceChangePercent] = useState<number>(0);

  // Available trading pairs with current prices
  const [availableCoins, setAvailableCoins] = useState<Coin[]>([
    { value: "BTCUSD", label: "BTC/USD", currentPrice: 47406.92 },
    { value: "ETHUSD", label: "ETH/USD", currentPrice: 3521.45 },
    { value: "ICPUSD", label: "ICP/USD", currentPrice: 12.87 }
  ]);

  // State for market creator fee
  const [feePercentage, setFeePercentage] = useState<string>("1.0");
  const [showTooltip, setShowTooltip] = useState(false);

  // Factory contract address from config
  const FactoryAddress = FACTORY_ADDRESS;
  const toast = useToast();

  // Handler for coin selection dropdown
  const handleCoinSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = availableCoins.find(coin => coin.value === event.target.value);
    setSelectedCoin(selected || null);
    setCurrentPrice(null);
  };

  // Calculate network fee (gas) for contract deployment
  const calculateNetworkFee = async () => {
    if (!selectedCoin || !strikePrice || !maturityDate || !maturityTime) {
      setEstimatedGasFee(""); // Default value
      return;
    }

    try {
      setIsCalculatingFee(true);

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      // Convert strikePrice to BigNumber
      const strikePriceValue = ethers.utils.parseUnits(strikePrice, "0");

      // Convert maturity date and time to timestamp
      const maturityTimestamp = Math.floor(new Date(`${maturityDate} ${maturityTime}`).getTime() / 1000);

      // Create a factory to estimate gas when deploy
      const factory = new ethers.ContractFactory(
        BinaryOptionMarket.abi,
        BinaryOptionMarket.bytecode,
        signer
      );

      // Convert fee to integer (multiply by 10 to handle decimal)
      const feeValue = Math.round(parseFloat(feePercentage) * 10);

      // Create data for deploy - add feeValue here
      const deployData = factory.getDeployTransaction(
        strikePriceValue,
        await signer.getAddress(),
        selectedCoin.label,
        maturityTimestamp,
        feeValue
      ).data || '0x';

      // Estimate gas units needed for deploy
      const gasUnits = await provider.estimateGas({
        from: walletAddress,
        data: deployData
      });

      // Estimate gas for registering with Factory
      const factoryContract = new ethers.Contract(FactoryAddress, Factory.abi, signer);
      const factoryData = factoryContract.interface.encodeFunctionData('deploy', [FACTORY_ADDRESS]); // Temporary address

      const factoryGasUnits = await provider.estimateGas({
        from: walletAddress,
        to: FactoryAddress,
        data: factoryData
      });

      // Total gas units needed
      const totalGasUnits = gasUnits.add(factoryGasUnits);
      setEstimatedGasUnits(totalGasUnits.toString());

      // Calculate gas cost
      const gasPriceWei = ethers.utils.parseUnits(gasPrice, "gwei");
      const gasFeeWei = totalGasUnits.mul(gasPriceWei);
      const gasFeeEth = parseFloat(ethers.utils.formatEther(gasFeeWei));

      // Get current ETH price to calculate USD value
      const priceService = PriceService.getInstance();
      let ethUsdPrice = 3500;
      try {
        const ethPriceData = await priceService.fetchPrice('ETH-USD');
        ethUsdPrice = ethPriceData.price;
      } catch (error) {
        console.error('Error fetching ETH price:', error);
      }

      // Calculate fee in USD
      const gasFeeUsd = (gasFeeEth * ethUsdPrice).toFixed(2);
      setEstimatedGasFee(gasFeeUsd);
    } catch (error) {
      console.error('Error calculating network fee:', error);
      setEstimatedGasFee("276.40"); // Default value if error
    } finally {
      setIsCalculatingFee(false);
    }
  };

  // Listen for contract deployment events from the Factory contract
  useEffect(() => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const factoryContract = new ethers.Contract(FactoryAddress, Factory.abi, provider);

    // Listen to Deployed event
    factoryContract.on("Deployed", (owner, newContractAddress, index) => {
      console.log("Event 'Deployed' received:");
      console.log("Owner:", owner);
      console.log("New contract deployed:", newContractAddress);
      console.log("Index:", index);

      setContractAddress(newContractAddress);
      setDeployedContracts(prev => [...prev, newContractAddress]); // Update contract list

      toast({
        title: "Contract deployed successfully!",
        description: `New Contract Address: ${newContractAddress}`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    });

    return () => {
      // Cleanup: remove listener when component unmounts
      console.log("Removing event listener on Factory contract...");
      factoryContract.removeAllListeners("Deployed");
    };
  }, []);

  // Recalculate network fee when parameters change
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateNetworkFee();
    }, 500); // Delay 500ms to avoid too many calculations

    return () => clearTimeout(timer);
  }, [selectedCoin, strikePrice, maturityDate, maturityTime, gasPrice]);

  // Handler for gas price dropdown
  const handleGasPriceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newGasPrice = event.target.value;
    setGasPrice(newGasPrice);
  };

  // Update wallet balance in real time
  useEffect(() => {
    if (isConnected) {
      // Update initial balance
      refreshBalance();

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      provider.on("block", refreshBalance);

      return () => {
        provider.removeAllListeners("block");
      };
    }
  }, [isConnected, refreshBalance]);

  // Fetch wallet balance
  const fetchBalance = async () => {
    if (!walletAddress) return;
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const balanceWei = await provider.getBalance(walletAddress);
      const balanceEth = parseFloat(ethers.utils.formatEther(balanceWei));
      refreshBalance();
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  };

  // Listen to blockchain events to update balance
  useEffect(() => {
    if (!walletAddress) return;

    // Update initial balance
    fetchBalance();

    // Listen to block event
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    provider.on("block", () => {
      fetchBalance();
    });

    // Use type assertion for ethereum
    const ethereum = window.ethereum as any;
    ethereum.on('accountsChanged', fetchBalance);

    return () => {
      provider.removeAllListeners("block");
      if (ethereum && typeof ethereum.removeListener === 'function') {
        ethereum.removeListener('accountsChanged', fetchBalance);
      }
    };
  }, [walletAddress]);

  // Reset form to default values
  const resetForm = () => {
    setSelectedCoin(null);
    setStrikePrice('');
    setMaturityDate('');
    setMaturityTime('');
    setFeePercentage('1');
    setDaysToExercise('Not set');
    setCurrentPrice(null);
    setPriceChangePercent(0);
  };

  // Estimate gas for contract deployment
  const estimateGas = async () => {
    try {
      if (!selectedCoin || !strikePrice || !maturityDate || !maturityTime) {
        return;
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      // Convert float to large integer
      const strikePriceFloat = parseFloat(strikePrice);
      const strikePriceInteger = Math.round(strikePriceFloat * STRIKE_PRICE_MULTIPLIER);
      const strikePriceValue = ethers.BigNumber.from(strikePriceInteger.toString());

      const maturityTimestamp = Math.floor(new Date(`${maturityDate} ${maturityTime}`).getTime() / 1000);

      // Convert fee to integer (multiply by 10 to handle decimal)
      const feeValue = Math.round(parseFloat(feePercentage) * 10);

      // Sample index background (using 5 as an example for estimation)
      const indexBg = 5;

      // Create contract factory to estimate gas
      const factory = new ethers.ContractFactory(
        BinaryOptionMarket.abi,
        BinaryOptionMarket.bytecode,
        signer
      );

      // Estimate gas for deployment - add indexBg here
      const estimatedGas = await provider.estimateGas({
        from: walletAddress,
        data: factory.getDeployTransaction(
          strikePriceValue,
          await signer.getAddress(),
          selectedCoin.label,
          maturityTimestamp,
          feeValue,
          indexBg
        ).data || '0x'
      });

      // Calculate gas fee based on current gas price
      const gasPriceWei = ethers.utils.parseUnits(gasPrice, "gwei");
      const gasFeeEth = parseFloat(ethers.utils.formatEther(estimatedGas.mul(gasPriceWei)));

      // Fetch current ETH price from PriceService instead of using hardcoded value
      const priceService = PriceService.getInstance();
      let ethUsdPrice = 3500; // Default fallback value if fetch fails

      try {
        // Use ETH-USD as the symbol for Ethereum price
        const ethPriceData = await priceService.fetchPrice('ETH-USD');
        ethUsdPrice = ethPriceData.price;
        console.log('Current ETH price:', ethUsdPrice);
      } catch (priceError) {
        console.error('Error fetching ETH price:', priceError);
        // Continue with default value if fetch fails
      }

      // Calculate fee in USD using the fetched ETH price
      const gasFeeUsd = (gasFeeEth * ethUsdPrice).toFixed(2);
      setEstimatedGasFee(gasFeeUsd);
    } catch (error) {
      console.error("Error estimating gas:", error);
      setEstimatedGasFee("276.40"); // Default value if error
    }
  };

  // Call the estimate gas function when necessary params change
  useEffect(() => {
    estimateGas();
  }, [selectedCoin, strikePrice, maturityDate, maturityTime, gasPrice]);

  // Handler for fee input changes
  const handleFeeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and decimal point
    if (/^\d*\.?\d*$/.test(value)) {
      const numValue = parseFloat(value);
      if (isNaN(numValue) || value === '') {
        setFeePercentage('');
      } else if (numValue < 0.1) {
        setFeePercentage('0.1');
      } else if (numValue > 20) {
        setFeePercentage('20');
      } else {
        // Ensure value has 1 decimal place to sync with slider
        setFeePercentage(numValue.toFixed(1));
      }
    }
  };

  // Deploy a new binary option market contract
  const deployContract = async () => {
    try {
      // Validation checks
      if (!selectedCoin || !strikePrice || !maturityDate || !maturityTime) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          status: "error",
          duration: 5000,
          isClosable: true
        });
        return;
      }

      // Get timestamp in Eastern Time
      const maturityTimestamp = createMaturityTimestamp();

      // Check if maturityTimestamp is in the future
      if (maturityTimestamp <= Math.floor(Date.now() / 1000)) {
        toast({
          title: "Error",
          description: "Maturity time must be in the future",
          status: "error",
          duration: 5000,
          isClosable: true
        });
        return;
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      // Convert float to large integer by multiplying with MULTIPLIER
      const strikePriceFloat = parseFloat(strikePrice);
      const strikePriceInteger = Math.round(strikePriceFloat * STRIKE_PRICE_MULTIPLIER);
      const strikePriceValue = ethers.BigNumber.from(strikePriceInteger.toString());

      // Set gas price
      const overrides = {
        gasPrice: ethers.utils.parseUnits(gasPrice, "gwei")
      };

      const factory = new ethers.ContractFactory(
        BinaryOptionMarket.abi,
        BinaryOptionMarket.bytecode,
        signer
      );

      // Convert fee to integer (multiply by 10 to handle decimal)
      const feeValue = Math.round(parseFloat(feePercentage) * 10);

      // Deploy with maturityTimestamp, gas price and fee
      const contract = await factory.deploy(
        strikePriceValue,
        await signer.getAddress(),
        selectedCoin.label,
        maturityTimestamp,
        feeValue,
        overrides
      );
      await contract.deployed();

      // Register with Factory
      const factoryContract = new ethers.Contract(FactoryAddress, Factory.abi, signer);
      await factoryContract.deploy(contract.address, overrides);

      setContractAddress(contract.address);
      await fetchContractsByOwner();
      await fetchBalance();

      toast({
        title: "Success",
        description: `Contract deployed at: ${contract.address}`,
        status: "success",
        duration: 5000,
        isClosable: true
      });

      // Reset form
      resetForm();

    } catch (error) {
      console.error("Deploy error:", error);
      toast({
        title: "Error",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true
      });
    }
  };

  // Fetch contract balance
  const fetchContractBalance = async () => {
    try {
      console.log("Fetching contract balance..."); // Log before fetching balance
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contractBalanceWei = await provider.getBalance(contractAddress); // Get contract balance
      const contractBalanceEth = parseFloat(ethers.utils.formatEther(contractBalanceWei)); // Convert from Wei to ETH
      setContractBalance(contractBalanceEth.toFixed(4)); // Update balance
      console.log("Contract Balance:", contractBalanceEth);
    } catch (error: any) {
      console.error("Failed to fetch contract balance:", error); // Print error if there's an issue
      toast({
        title: "Error fetching contract balance",
        description: error.message || "An unexpected error occurred.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Listen for new contract deployment events to update contracts list
  useEffect(() => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const factoryContract = new ethers.Contract(FactoryAddress, Factory.abi, provider);

    // Listen for Deployed event to update contracts when a new contract is created
    factoryContract.on("Deployed", (owner, contractAddress, index) => {
      console.log("New contract stored:", contractAddress);
      fetchContractsByOwner(); // Update contracts list after receiving event
    });

    return () => {
      // Unsubscribe from event when component unmounts
      factoryContract.off("Deployed", (owner, contractAddress, index) => {
        console.log("New contract stored:", contractAddress);
        fetchContractsByOwner(); // Update contracts list after receiving event
      });
    };
  }, [walletAddress]);

  // Fetch all contracts owned by the current wallet address
  const fetchContractsByOwner = async () => {
    try {
      // Check if wallet is connected
      if (!walletAddress) {
        console.log("No wallet address available");
        return;
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(FactoryAddress, Factory.abi, provider);

      // Debug logs
      console.log("Fetching contracts for address:", walletAddress);
      console.log("Using Factory at:", FactoryAddress);

      // Add valid address check
      if (!ethers.utils.isAddress(walletAddress)) {
        throw new Error("Invalid wallet address");
      }

      const contracts = await contract.getContractsByOwner(walletAddress);
      console.log("Contracts fetched:", contracts);
      setDeployedContracts(contracts);

    } catch (error: any) {
      console.error("Failed to fetch contracts:", error);
      toast({
        title: "Error fetching contracts",
        description: "Please make sure your wallet is connected",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Fetch contract balance when contract address changes
  useEffect(() => {
    if (contractAddress) {
      fetchContractBalance();
    }
  }, [contractAddress]);

  // Fetch contracts when wallet address changes
  useEffect(() => {
    if (walletAddress) {
      fetchContractsByOwner();
    }
  }, [walletAddress]);

  // Utility function to shorten addresses for display
  const shortenAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Fetch current prices from Coinbase API
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD');
        const data = await response.json();
        const rates = data.data.rates;

        // Update available coins with current prices
        setAvailableCoins([
          { value: "BTCUSD", label: "BTC/USD", currentPrice: 1 / parseFloat(rates.BTC) },
          { value: "ETHUSD", label: "ETH/USD", currentPrice: 1 / parseFloat(rates.ETH) },
          { value: "ICPUSD", label: "ICP/USD", currentPrice: 1 / parseFloat(rates.ICP) || 12.87 }
        ]);
      } catch (error) {
        console.error("Error fetching prices from Coinbase:", error);
      }
    };

    fetchPrices();
    // Refresh prices every 60 seconds
    const interval = setInterval(fetchPrices, 60000);

    return () => clearInterval(interval);
  }, []);

  // Calculate days to exercise when maturity date changes
  useEffect(() => {
    if (maturityDate && maturityTime) {
      const now = new Date();
      const maturityDateTime = new Date(`${maturityDate} ${maturityTime}`);

      // Calculate remaining days
      const diffTime = maturityDateTime.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        setDaysToExercise('Expired');
      } else if (diffDays === 1) {
        setDaysToExercise('1 day');
      } else if (diffDays < 30) {
        setDaysToExercise(`${diffDays} days`);
      } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        setDaysToExercise(`${months} ${months === 1 ? 'month' : 'months'}`);
      } else {
        const years = Math.floor(diffDays / 365);
        const remainingMonths = Math.floor((diffDays % 365) / 30);
        if (remainingMonths === 0) {
          setDaysToExercise(`${years} ${years === 1 ? 'year' : 'years'}`);
        } else {
          setDaysToExercise(`${years} ${years === 1 ? 'year' : 'years'}, ${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}`);
        }
      }
    }
  }, [maturityDate, maturityTime]);

  // Fetch current price from Coinbase via PriceService
  useEffect(() => {
    if (selectedCoin) {
      const priceService = PriceService.getInstance();
      const fetchCurrentPrice = async () => {
        try {
          // Convert from BTCUSD to BTC-USD if needed
          const formattedSymbol = selectedCoin.value.includes('-')
            ? selectedCoin.value
            : `${selectedCoin.value.substring(0, 3)}-${selectedCoin.value.substring(3)}`;

          const priceData = await priceService.fetchPrice(formattedSymbol);
          setCurrentPrice(priceData.price);

          // Calculate percent change if strikePrice is set
          if (strikePrice && strikePrice !== '') {
            const strikePriceNum = parseFloat(strikePrice);
            if (!isNaN(strikePriceNum) && strikePriceNum > 0) {
              const changePercent = ((priceData.price - strikePriceNum) / strikePriceNum) * 100;
              setPriceChangePercent(changePercent);
            }
          }
        } catch (error) {
          console.error('Error fetching current price:', error);
        }
      };

      fetchCurrentPrice();

      // Update price every 30 seconds
      const intervalId = setInterval(fetchCurrentPrice, 30000);

      return () => clearInterval(intervalId);
    }
  }, [selectedCoin, strikePrice]);

  // Create Unix timestamp from date and time inputs
  const createMaturityTimestamp = () => {
    if (!maturityDate || !maturityTime) return 0;

    try {
      const [hours, minutes] = maturityTime.split(':').map(Number);
      const dateObj = new Date(`${maturityDate}T00:00:00`);
      dateObj.setHours(hours, minutes, 0, 0);

      return Math.floor(dateObj.getTime() / 1000);
    } catch (error) {
      console.error('Error creating maturity timestamp:', error);
      return 0;
    }
  };

  // Component UI render
  return (
    <Box bg="#0a1647" minH="100vh" color="white">
      {/* Header - Wallet Info */}
      {isConnected && (
        <HStack
          spacing={6}
          p={4}
          bg="rgba(10,22,71,0.8)"
          borderRadius="lg"
          border="1px solid rgba(255,255,255,0.1)"
          w="full"
          justify="space-between"
          position="sticky"
          top={0}
          zIndex={10}
        >
          <HStack>
            <Icon as={FaWallet} color="white" />
            <Text color="white">{shortenAddress(walletAddress)}</Text>
          </HStack>
          <HStack>
            <Icon as={FaEthereum} color="white" />
            <Text color="white">{parseFloat(balance).toFixed(4)} ETH</Text>
          </HStack>
        </HStack>
      )}

      <VStack spacing={8} p={8}>
        {!isConnected ? (
          // Wallet connection button shown when not connected
          <Button
            onClick={connectWallet}
            variant="outline"
            borderColor="white"
            color="white"
            fontSize="xl"
            fontWeight="bold"
            w="500px"
            p={6}
            _hover={{
              bg: 'rgba(255,255,255,0.1)',
              transform: 'translateY(-2px)'
            }}
            transition="all 0.2s"
          >
            Connect Wallet
          </Button>
        ) : (
          <>
            {/* Main content area - displayed after wallet connection */}
            {/* Main content area with two columns */}
            <HStack spacing={0} w="full" maxW="1200px" align="flex-start" position="relative">
              {/* Left side - Market Creation Form */}
              <Box flex={1} pr={8} position="relative">
                <VStack spacing={6} align="stretch">
                  {/* Information note about market creation */}
                  <Box p={4} bg="rgba(255,255,255,0.05)" borderRadius="xl">
                    <Text fontSize="sm" color="white">
                      Note: When creating a market, you're establishing a binary options contract
                      where users can bid on whether the price will be above (LONG) or below (SHORT)
                      the strike price at maturity. The fee you set (between 0.1% and 20%) will be
                      applied to winning positions and distributed to you as the market creator.
                    </Text>
                  </Box>

                  {/* Asset selection dropdown */}
                  <Box>
                    <Text color="white" mb={4} fontWeight="bold">SELECT ASSET:</Text>
                    <Select
                      placeholder="Select Trading Pair"
                      value={selectedCoin?.value || ''}
                      onChange={handleCoinSelect}
                      bg="rgba(255,255,255,0.1)"
                      border="1px solid rgba(255,255,255,0.2)"
                      color="white"
                      borderRadius="xl"
                      h="60px"
                      _hover={{
                        borderColor: "white",
                      }}
                      _focus={{
                        borderColor: "white",
                        boxShadow: "0 0 0 1px white",
                      }}
                      icon={<Icon as={FaEthereum} color="white" />}
                    >
                      {availableCoins.map((coin) => (
                        <option
                          key={coin.value}
                          value={coin.value}
                          style={{
                            backgroundColor: "#0a1647",
                            color: "white"
                          }}
                        >
                          {coin.label}
                        </option>
                      ))}
                    </Select>
                  </Box>

                  {/* Strike price input */}
                  <Box>
                    <Text color="white" mb={4} fontWeight="bold">STRIKE PRICE:</Text>
                    <InputGroup>
                      <Input
                        placeholder="Enter strike price"
                        value={strikePrice}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (/^\d*\.?\d*$/.test(value)) {
                            setStrikePrice(value);
                          }
                        }}
                        bg="rgba(255,255,255,0.1)"
                        border="1px solid rgba(255,255,255,0.2)"
                        color="white"
                        borderRadius="xl"
                        h="60px"
                        _hover={{
                          borderColor: "white",
                        }}
                        _focus={{
                          borderColor: "white",
                          boxShadow: "0 0 0 1px white",
                        }}
                      />
                      <InputRightAddon
                        h="60px"
                        children="$"
                        bg="transparent"
                        borderColor="rgba(255,255,255,0.2)"
                        color="white"
                      />
                    </InputGroup>
                  </Box>

                  {/* Maturity date and time inputs */}
                  <HStack spacing={4}>
                    <Box flex={1}>
                      <Text color="white" mb={4} fontWeight="bold">MARKET MATURITY DATE:</Text>
                      <Input
                        type="date"
                        value={maturityDate}
                        onChange={(e) => setMaturityDate(e.target.value)}
                        bg="rgba(255,255,255,0.1)"
                        border="1px solid rgba(255,255,255,0.2)"
                        color="white"
                        borderRadius="xl"
                        h="60px"
                        _hover={{
                          borderColor: "white",
                        }}
                        _focus={{
                          borderColor: "white",
                        }}
                      />
                    </Box>
                    <Box flex={1}>
                      <Text color="white" mb={4} fontWeight="bold">TIME :</Text>
                      <InputGroup>
                        <Input
                          type="time"
                          value={maturityTime}
                          onChange={(e) => setMaturityTime(e.target.value)}
                          bg="rgba(255,255,255,0.1)"
                          border="1px solid rgba(255,255,255,0.2)"
                          color="white"
                          borderRadius="xl"
                          h="60px"
                          _hover={{
                            borderColor: "white",
                          }}
                          _focus={{
                            borderColor: "white",
                          }}
                        />
                      </InputGroup>
                    </Box>
                  </HStack>

                  {/* Fee Setting Box - slider and input */}
                  <Box>
                    <HStack spacing={4} align="center">
                      <Text color="white" fontWeight="bold" minW="50px">FEE:</Text>

                      <Box flex={1} maxW="300px" position="relative">
                        <Slider
                          id="fee-slider"
                          min={0.1}
                          max={20}
                          step={0.1}
                          value={parseFloat(feePercentage) || 0.1}
                          onChange={(val) => {
                            // Update feePercentage with 1 decimal place
                            const formattedValue = val.toFixed(1);
                            setFeePercentage(formattedValue);
                          }}
                          onMouseEnter={() => setShowTooltip(true)}
                          onMouseLeave={() => setShowTooltip(false)}
                        >
                          <SliderTrack bg="rgba(255,255,255,0.1)" h="4px">
                            <SliderFilledTrack bg="#4a63c8" />
                          </SliderTrack>
                          <Tooltip
                            hasArrow
                            bg="#4a63c8"
                            color="white"
                            placement="top"
                            isOpen={showTooltip}
                            label={`${parseFloat(feePercentage) || 0.1}%`}
                          >
                            <SliderThumb boxSize={6} bg="white" />
                          </Tooltip>
                        </Slider>
                      </Box>

                      <Box flex={1}>
                        <InputGroup>
                          <Input
                            placeholder="Enter fee"
                            value={feePercentage}
                            onChange={handleFeeInputChange}
                            bg="rgba(255,255,255,0.1)"
                            border="1px solid rgba(255,255,255,0.2)"
                            color="white"
                            borderRadius="xl"
                            h="60px"
                            _hover={{
                              borderColor: "white",
                            }}
                            _focus={{
                              borderColor: "white",
                              boxShadow: "0 0 0 1px white",
                            }}
                          />
                          <InputRightAddon
                            h="60px"
                            children="%"
                            bg="transparent"
                            borderColor="rgba(255,255,255,0.2)"
                            color="white"
                          />
                        </InputGroup>
                      </Box>
                    </HStack>

                    <Text color="gray.400" fontSize="sm" mt={1}>
                      This fee will be applied to winning positions and distributed to the market creator.
                    </Text>
                  </Box>

                  {/* Network Fee Section - gas settings */}
                  <Box mt={4}>
                    <HStack justify="space-between">
                      <Text color="white">Network fee (gas)</Text>
                      <HStack>
                        {isCalculatingFee && (
                          <Spinner size="sm" color="blue.200" mr={2} />
                        )}
                        <Text color="white">${estimatedGasFee}</Text>
                      </HStack>
                    </HStack>
                    <HStack mt={2} justify="space-between">
                      <Text color="gray.400">Gas price (gwei)</Text>
                      <HStack>
                        <Select
                          w="120px"
                          size="sm"
                          bg="rgba(255,255,255,0.1)"
                          border="1px solid rgba(255,255,255,0.2)"
                          color="white"
                          borderRadius="md"
                          _hover={{
                            borderColor: "white",
                          }}
                          _focus={{
                            borderColor: "white",
                            boxShadow: "0 0 0 1px white",
                          }}
                          value={gasPrice}
                          onChange={handleGasPriceChange}
                          sx={{
                            "& option": {
                              backgroundColor: "#0a1647",
                              color: "white"
                            }
                          }}
                        >
                          <option value="60" style={{ backgroundColor: "#0a1647", color: "white" }}>60.00 (Slow)</option>
                          <option value="78" style={{ backgroundColor: "#0a1647", color: "white" }}>78.00 (Normal)</option>
                          <option value="90" style={{ backgroundColor: "#0a1647", color: "white" }}>90.00 (Fast)</option>
                          <option value="120" style={{ backgroundColor: "#0a1647", color: "white" }}>120.00 (Rapid)</option>
                        </Select>
                      </HStack>
                    </HStack>
                    <Text color="gray.500" fontSize="xs" mt={1}>
                      Estimated gas: {parseInt(estimatedGasUnits).toLocaleString()} units
                    </Text>
                  </Box>
                </VStack>
              </Box>

              {/* Vertical Divider between columns */}
              <Box
                position="absolute"
                left="50%"
                top={0}
                bottom={0}
                width="1px"
                bg="rgba(255,255,255,0.2)"
                transform="translateX(-50%)"
              />

              {/* Right side - Market Details and Preview */}
              <Box flex={1} pl={8}>
                <VStack spacing={6} align="center">
                  {/* OREKA Logo */}
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

                  {/* Market Details Box - Preview of market parameters */}
                  <Box
                    p={6}
                    bg="rgba(255,255,255,0.05)"
                    borderRadius="xl"
                    border="1px solid rgba(255,255,255,0.1)"
                  >
                    <VStack spacing={4} align="stretch">
                      <HStack justify="space-between">
                        <Text color="gray.400">Strike price</Text>
                        <HStack>
                          <Text color="white" fontSize="xl" fontWeight="bold">
                            ${strikePrice || 'Not set'}
                          </Text>
                        </HStack>
                      </HStack>

                      <HStack justify="space-between">
                        <Text color="gray.400">Current market price</Text>
                        <HStack>
                          {priceChangePercent !== 0 && (
                            <>
                              <Icon
                                as={priceChangePercent > 0 ? FaArrowUp : FaArrowDown}
                                color={priceChangePercent > 0 ? "green.400" : "red.400"}
                              />
                              <Text
                                color={priceChangePercent > 0 ? "green.400" : "red.400"}
                              >
                                {Math.abs(priceChangePercent).toFixed(2)}%
                              </Text>
                            </>
                          )}
                          <Text color="white" fontSize="xl" fontWeight="bold">
                            ${currentPrice ? currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Loading...'}
                          </Text>
                        </HStack>
                      </HStack>

                      <Divider borderColor="rgba(255,255,255,0.1)" />

                      <HStack justify="space-between">
                        <Text color="gray.400">Maturity date</Text>
                        <Text color="white">{maturityDate || 'Not set'} {maturityTime ? `${maturityTime} ` : ''}</Text>
                      </HStack>

                      <HStack justify="space-between">
                        <Text color="gray.400">Time to exercise</Text>
                        <Text color="white">{daysToExercise}</Text>
                      </HStack>

                      <Divider borderColor="rgba(255,255,255,0.1)" />

                      {/* Replace fee section with Note */}
                      <Box p={3} bg="rgba(255,255,255,0.03)" borderRadius="md">
                        <Text fontSize="sm" color="white">
                          Note: When creating a market, you're establishing a binary options contract where users can bid on whether the price will be above (LONG) or below (SHORT) the strike price at maturity. The fee you set (between 0.1% and 20%) will be applied to winning positions and distributed to you as the market creator.
                        </Text>
                      </Box>
                    </VStack>
                  </Box>

                  {/* Market Creation Info */}
                  <Box
                    p={4}
                    bg="rgba(255,255,255,0.05)"
                    borderRadius="xl"
                    border="1px solid rgba(255,255,255,0.1)"
                  >
                    <Text color="white" fontWeight="bold" mb={2}>
                      When creating a market you will:
                    </Text>
                    <UnorderedList spacing={2} pl={4}>
                      <ListItem color="gray.300">
                        Earn the fee percentage you set (currently {feePercentage}%) from all winning positions at market expiry.
                      </ListItem>
                      <ListItem color="gray.300">
                        Control when to start the bidding phase after market creation.
                      </ListItem>
                      <ListItem color="gray.300">
                        Pay Ethereum network fees (gas) for deploying the market contract.
                      </ListItem>
                    </UnorderedList>
                  </Box>
                </VStack>
              </Box>
            </HStack>

            {/* Progress bar and Create Market Button */}
            <VStack spacing={6} w="full" maxW="1200px" mt={8}>
              <Box w="full">
                <HStack spacing={4} justify="space-between" mb={4}>
                  <Text color="white" fontWeight={600}>Approving sUSD</Text>
                  <Text color="gray.400">Creating market</Text>
                  <Text color="gray.400">Finished</Text>
                </HStack>
                <Box position="relative" h="2px" bg="rgba(255,255,255,0.1)" w="full">
                  <Box position="absolute" left={0} top={0} h="2px" w="33%" bg="white" />
                  <HStack justify="space-between" position="absolute" w="full" top="-8px">
                    <Box w="20px" h="20px" borderRadius="full" bg="white" />
                    <Box w="20px" h="20px" borderRadius="full" bg="rgba(255,255,255,0.1)" />
                    <Box w="20px" h="20px" borderRadius="full" bg="rgba(255,255,255,0.1)" />
                  </HStack>
                </Box>
              </Box>

              <Button
                onClick={deployContract}
                bg="#4a63c8"
                color="white"
                size="lg"
                w="300px"
                h="60px"
                borderRadius="full"
                fontSize="xl"
                _hover={{
                  bg: '#5a73d8',
                  transform: 'translateY(-2px)'
                }}
                transition="all 0.2s"
                isDisabled={!selectedCoin || !strikePrice || !maturityDate || !maturityTime}
              >
                Create market
              </Button>
            </VStack>
          </>
        )}
      </VStack>
    </Box>
  );
};

export default Owner;