import React, { useEffect, useState } from 'react';
import {
    Box, Button, HStack, Icon, Text, VStack, SimpleGrid, Flex,
    Input, Select, Divider, Progress, Tooltip, Spacer, Image,
    Spinner
} from '@chakra-ui/react';
import {
    FaCalendarDay, FaPlayCircle, FaClock, FaCheckCircle,
    FaListAlt, FaRegClock, FaEthereum, FaWallet, FaTrophy,
    FaArrowUp, FaArrowDown, FaCoins
} from 'react-icons/fa';
import { IoWalletOutline } from "react-icons/io5";
import { SiBitcoinsv } from "react-icons/si";
import { GoInfinity } from "react-icons/go";
import { useToast } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { format, formatDistanceToNow } from 'date-fns';
import { BinaryOptionMarketService } from '../service/binary-option-market-service';
import { getCurrentTimestamp, isTimestampPassed, getTimeRemaining } from '../utils/timeUtils';
import { AuthClient } from '@dfinity/auth-client';
import { Principal } from '@dfinity/principal';

interface ListAddressOwnerProps {
    ownerAddress: string;
    page: number;
}

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
}

enum Phase { Trading, Bidding, Maturity, Expiry }

// Function to get color for phase
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

// Function to get name for phase
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

// Format maturity time
const formatMaturityTime = (maturityTime: any) => {
    try {
        if (!maturityTime) return "Unknown";
        const timestamp = Number(maturityTime);
        if (isNaN(timestamp) || timestamp === 0) return "Unknown";
        const date = new Date(timestamp * 1000);
        return format(date, 'MMM d, yyyy h:mm a');
    } catch (error) {
        console.error("Error formatting maturity time:", error);
        return "Unknown";
    }
};

// Check if market has ended
const isMarketEnded = (maturityTime: any, phase: number): boolean => {
    try {
        if (!maturityTime) return false;
        const maturityDate = new Date(Number(maturityTime) * 1000);
        const currentTime = new Date();
        return currentTime.getTime() > maturityDate.getTime();
    } catch (error) {
        console.error("Error checking if market ended:", error);
        return false;
    }
};

// Format time remaining
const formatTimeRemaining = (maturityTime: any) => {
    try {
        if (!maturityTime) return "Unknown";
        const maturityDate = new Date(Number(maturityTime) * 1000);
        const currentTime = new Date();
        if (currentTime > maturityDate) {
            return "Ended";
        }
        return formatDistanceToNow(maturityDate, { addSuffix: true });
    } catch (error) {
        console.error("Error formatting time remaining:", error);
        return "Unknown";
    }
};

// Get market title
const getMarketTitle = (tradingPair: string, strikePrice: string) => {
    if (!tradingPair || !strikePrice) return "Unknown Market";
    const formattedStrikePrice = parseFloat(strikePrice).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return `${tradingPair} @ $${formattedStrikePrice}`;
};

// Get background image based on trading pair
const getBackgroundImage = (tradingPair: string) => {
    switch (tradingPair) {
        case 'BTC/USD':
            return "url('/images/btc-logo.png')";
        case 'ETH/USD':
            return "url('/images/eth-logo.png')";
        case 'ICP/USD':
            return "url('/images/icp-logo.png')";
        default:
            return "none";
    }
};

function ListAddressOwner({ ownerAddress, page }: ListAddressOwnerProps) {
    const [contracts, setContracts] = useState<ContractData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [totalContracts, setTotalContracts] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [identityPrincipal, setIdentityPrincipal] = useState("");
    const [marketService, setMarketService] = useState<BinaryOptionMarketService | null>(null);

    const CONTRACTS_PER_PAGE = 10;
    const router = useRouter();
    const toast = useToast();

    useEffect(() => {
        initIdentity();
    }, []);

    useEffect(() => {
        if (marketService) {
            fetchContracts();
        }
    }, [page, marketService]);

    // Initialize identity and market service
    const initIdentity = async () => {
        try {
            const authClient = await AuthClient.create();
            const identity = authClient.getIdentity();
            const isAuthenticated = await authClient.isAuthenticated();

            if (isAuthenticated) {
                setIdentityPrincipal(identity.getPrincipal().toText());
                const service = BinaryOptionMarketService.getInstance();
                await service.initialize();
                setMarketService(service);
            } else {
                setError("Please connect your wallet first");
                setIsLoading(false);
            }
        } catch (error) {
            console.error("Error initializing identity:", error);
            setError("Failed to initialize. Please try again.");
            setIsLoading(false);
        }
    };

    // Fetch contract list
    const fetchContracts = async () => {
        try {
            setIsLoading(true);
            setError(null);

            if (!marketService) {
                setError("Market service not initialized");
                setIsLoading(false);
                return;
            }

            // Get all markets from the market service
            const allMarkets = await marketService.getAllMarkets();

            if (!allMarkets || allMarkets.length === 0) {
                setContracts([]);
                setTotalContracts(0);
                setTotalPages(1);
                setIsLoading(false);
                return;
            }

            // Calculate pagination
            const startIdx = (page - 1) * CONTRACTS_PER_PAGE;
            const endIdx = startIdx + CONTRACTS_PER_PAGE;
            const paginatedMarkets = allMarkets.slice(startIdx, endIdx);

            // Transform market data
            const contractDataPromises = paginatedMarkets.map(async (marketId: string) => {
                const marketDetails = await marketService.getMarketDetails(marketId);

                // Parse phase
                let phase = Phase.Trading;
                if (marketDetails.currentPhase && 'Trading' in marketDetails.currentPhase) {
                    phase = Phase.Trading;
                } else if (marketDetails.currentPhase && 'Bidding' in marketDetails.currentPhase) {
                    phase = Phase.Bidding;
                } else if (marketDetails.currentPhase && 'Maturity' in marketDetails.currentPhase) {
                    phase = Phase.Maturity;
                } else if (marketDetails.currentPhase && 'Expiry' in marketDetails.currentPhase) {
                    phase = Phase.Expiry;
                }

                // Format data for UI
                return {
                    address: marketId,
                    createDate: marketDetails.createTimestamp ? new Date(Number(marketDetails.createTimestamp) * 1000).toISOString() : '',
                    longAmount: marketDetails.positions ? (Number(marketDetails.positions.long) / 10e7).toString() : '0',
                    shortAmount: marketDetails.positions ? (Number(marketDetails.positions.short) / 10e7).toString() : '0',
                    strikePrice: marketDetails.oracleDetails ? (Number(marketDetails.oracleDetails.strikePrice) / 10e7).toString() : '0',
                    phase: phase,
                    maturityTime: marketDetails.endTimestamp ? marketDetails.endTimestamp.toString() : '0',
                    tradingPair: marketDetails.tradingPair || 'ICP/USD',
                    owner: marketDetails.owner ? marketDetails.owner.toString() : ''
                };
            });

            const contractDataList = await Promise.all(contractDataPromises);
            setContracts(contractDataList);
            setTotalContracts(allMarkets.length);
            setTotalPages(Math.ceil(allMarkets.length / CONTRACTS_PER_PAGE));
            setIsLoading(false);
        } catch (error) {
            console.error("Error fetching contracts:", error);
            setError("Failed to fetch markets. Please try again.");
            setIsLoading(false);
        }
    };

    // Navigate to contract details
    const handleContractClick = (contractAddress: string) => {
        router.push(`/customer/${contractAddress}`);
    };

    // Handle pagination
    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            router.push(`/listaddress/${newPage}`);
        }
    };

    // Calculate total pool amount
    const calculateTotalPool = (longAmount: string, shortAmount: string) => {
        const longValue = parseFloat(longAmount) || 0;
        const shortValue = parseFloat(shortAmount) || 0;
        return (longValue + shortValue).toFixed(4);
    };

    // Format creation date
    const formatCreateDate = (dateString: string) => {
        try {
            return format(new Date(dateString), 'MMM d, yyyy');
        } catch (error) {
            return "Unknown";
        }
    };

    return (
        <Box p={4} maxWidth="1200px" mx="auto">
            <VStack spacing={4} align="stretch">
                <Flex justifyContent="space-between" alignItems="center" mb={4}>
                    <Text fontSize="2xl" fontWeight="bold">Binary Option Markets</Text>
                    <HStack>
                        <Text>Page {page} of {totalPages}</Text>
                        <Button
                            isDisabled={page <= 1}
                            onClick={() => handlePageChange(page - 1)}
                            size="sm"
                        >
                            Previous
                        </Button>
                        <Button
                            isDisabled={page >= totalPages}
                            onClick={() => handlePageChange(page + 1)}
                            size="sm"
                        >
                            Next
                        </Button>
                    </HStack>
                </Flex>

                {isLoading ? (
                    <Flex justify="center" align="center" h="300px">
                        <Spinner size="xl" />
                    </Flex>
                ) : error ? (
                    <Box textAlign="center" p={8} borderWidth={1} borderRadius="lg">
                        <Text color="red.500">{error}</Text>
                        <Button mt={4} onClick={fetchContracts}>Retry</Button>
                    </Box>
                ) : contracts.length === 0 ? (
                    <Box textAlign="center" p={8} borderWidth={1} borderRadius="lg">
                        <Text>No markets found</Text>
                    </Box>
                ) : (
                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
                        {contracts.map((contract, index) => (
                            <Box
                                key={contract.address}
                                p={4}
                                borderWidth={1}
                                borderRadius="lg"
                                cursor="pointer"
                                onClick={() => handleContractClick(contract.address)}
                                transition="all 0.3s"
                                _hover={{ transform: 'scale(1.02)', boxShadow: 'lg' }}
                                position="relative"
                                overflow="hidden"
                                bgGradient="linear(to-br, gray.800, gray.900)"
                            >
                                {/* Background Icon */}
                                <Box
                                    position="absolute"
                                    right="-20px"
                                    bottom="-20px"
                                    width="120px"
                                    height="120px"
                                    opacity="0.1"
                                    backgroundImage={getBackgroundImage(contract.tradingPair)}
                                    backgroundSize="contain"
                                    backgroundRepeat="no-repeat"
                                    backgroundPosition="center"
                                />

                                {/* Market Status Tag */}
                                <HStack position="absolute" top={2} right={2}>
                                    <Flex
                                        bg={getPhaseColor(contract.phase)}
                                        color="white"
                                        px={2}
                                        py={1}
                                        borderRadius="md"
                                        fontSize="xs"
                                        alignItems="center"
                                    >
                                        <Icon as={FaRegClock} mr={1} />
                                        {getPhaseName(contract.phase)}
                                    </Flex>
                                </HStack>

                                {/* Market Title */}
                                <Text fontWeight="bold" fontSize="lg" mb={2}>
                                    {getMarketTitle(contract.tradingPair, contract.strikePrice)}
                                </Text>

                                {/* Time Info */}
                                <HStack fontSize="sm" color="gray.300" mb={3}>
                                    <Icon as={FaCalendarDay} />
                                    <Text>Created: {formatCreateDate(contract.createDate)}</Text>
                                </HStack>

                                <HStack fontSize="sm" color="gray.300" mb={3}>
                                    <Icon as={FaClock} />
                                    <Text>
                                        {isMarketEnded(contract.maturityTime, contract.phase) ? (
                                            "Market has ended"
                                        ) : (
                                            `Ends: ${formatTimeRemaining(contract.maturityTime)}`
                                        )}
                                    </Text>
                                </HStack>

                                {/* Pool Information */}
                                <Text fontSize="sm" fontWeight="medium" mb={1}>Total Pool: {calculateTotalPool(contract.longAmount, contract.shortAmount)} ICP</Text>

                                <Flex mb={3} alignItems="center">
                                    {/* UP Side */}
                                    <Box flex="1">
                                        <Flex alignItems="center">
                                            <Icon as={FaArrowUp} color="green.400" mr={1} />
                                            <Text fontSize="sm" color="green.400">UP</Text>
                                            <Spacer />
                                            <Text fontSize="sm">{parseFloat(contract.longAmount).toFixed(2)}</Text>
                                        </Flex>
                                    </Box>

                                    <Box width="8px" />

                                    {/* DOWN Side */}
                                    <Box flex="1">
                                        <Flex alignItems="center">
                                            <Icon as={FaArrowDown} color="red.400" mr={1} />
                                            <Text fontSize="sm" color="red.400">DOWN</Text>
                                            <Spacer />
                                            <Text fontSize="sm">{parseFloat(contract.shortAmount).toFixed(2)}</Text>
                                        </Flex>
                                    </Box>
                                </Flex>

                                {/* Progress Bar */}
                                <Box mt={2}>
                                    <Flex>
                                        <Box flex={parseFloat(contract.longAmount) || 0.001} height="8px" bg="green.400" borderLeftRadius="full" />
                                        <Box flex={parseFloat(contract.shortAmount) || 0.001} height="8px" bg="red.400" borderRightRadius="full" />
                                    </Flex>
                                </Box>

                                {/* View Details Button */}
                                <Button
                                    mt={4}
                                    size="sm"
                                    width="full"
                                    colorScheme="blue"
                                    variant="outline"
                                >
                                    View Details
                                </Button>
                            </Box>
                        ))}
                    </SimpleGrid>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <Flex justifyContent="center" mt={6}>
                        <HStack>
                            <Button
                                isDisabled={page <= 1}
                                onClick={() => handlePageChange(page - 1)}
                            >
                                Previous
                            </Button>
                            <Text>Page {page} of {totalPages}</Text>
                            <Button
                                isDisabled={page >= totalPages}
                                onClick={() => handlePageChange(page + 1)}
                            >
                                Next
                            </Button>
                        </HStack>
                    </Flex>
                )}
            </VStack>
        </Box>
    );
}

export default ListAddressOwner; 