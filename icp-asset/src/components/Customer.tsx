import React, { useState, useEffect, useRef } from 'react';
import { useCallback } from 'react'; // Thêm import useCallback
import {
    Flex, Box, Text, Button, VStack, useToast, Input,
    Select, HStack, Icon, ScaleFade, Table, Thead, Tbody, Tr, Th, Td, TableContainer,
    Tabs, TabList, TabPanels, Tab, TabPanel, Heading, Divider, Circle, Spacer
} from '@chakra-ui/react';
import { FaEthereum, FaWallet, FaTrophy, FaRegClock, FaArrowUp, FaArrowDown, FaCoins } from 'react-icons/fa';
import { GoInfinity } from "react-icons/go";
import { PiChartLineUpLight } from "react-icons/pi";
import { SiBitcoinsv } from "react-icons/si";
import { useRouter } from 'next/router';
import { BinaryOptionMarketService, IBinaryOptionMarketService } from '../service/binary-option-market-service';
import { Principal } from '@dfinity/principal';
import { current } from '@reduxjs/toolkit';
import { AuthClient } from '@dfinity/auth-client';
import { setActorIdentity, setIcpLedgerIdentity } from '../service/actor-locator';
import { IIcpLedgerService, IcpLedgerService } from '../service/icp-ledger-service';
import { format } from 'date-fns';
import { PriceService, PriceData } from '../service/price-service';
import MarketCharts from './charts/MarketCharts';

// Add typings import for ICRC1 Account
import type { Account as ICRC1Account } from '../service/icp-ledger-service';

// Add import for FactoryService
import { FactoryService, MarketInfo } from '../service/factory-service';

enum Side { Long, Short }
enum Phase { Bidding, Trading, Maturity, Expiry }

interface Coin {
    value: string;
    label: string;
}

interface CustomerProps {
    contractAddress: string;
}

function Customer({ contractAddress }: CustomerProps) {
    console.log("Customer component rendering with contractAddress:", contractAddress);

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [selectedSide, setSelectedSide] = useState<Side | null>(null);
    const [walletAddress, setWalletAddress] = useState<string>("");
    const [balance, setBalance] = useState("0");
    const [contractBalance, setContractBalance] = useState(0);
    const [accumulatedWinnings, setAccumulatedWinnings] = useState(0);
    const [bidAmount, setBidAmount] = useState("");
    const [currentPhase, setCurrentPhase] = useState<Phase>(Phase.Trading);
    const [totalDeposited, setTotalDeposited] = useState(0);
    const [strikePrice, setStrikePrice] = useState<number>(0);
    const [finalPrice, setFinalPrice] = useState<number>(0);
    const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
    const [showClaimButton, setShowClaimButton] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [resultMessage, setResultMessage] = useState("");
    const [countdown, setCountdown] = useState<number | null>(null);
    const [reward, setReward] = useState(0); // Số phần thưởng khi người chơi thắng
    const [positions, setPositions] = useState<{ long: number; short: number }>({ long: 0, short: 0 });
    const [totalMarketPositions, setTotalMarketPositions] = useState<{ long: number; short: number }>({ long: 0, short: 0 });
    const [authenticated, setAuthenticated] = useState(false);
    const [endTimestamp, setEndTimestamp] = useState<number | null>(null);

    // New chart-related state variables
    const [chartData, setChartData] = useState<any[]>([]);
    const [positionHistory, setPositionHistory] = useState<any[]>([]);
    const [chartSymbol, setChartSymbol] = useState<string>('ETH-USD');
    const [currentPrice, setCurrentPrice] = useState<number>(0);
    const [longPercentage, setLongPercentage] = useState<number>(50);
    const [shortPercentage, setShortPercentage] = useState<number>(50);
    const [priceTimeRange, setPriceTimeRange] = useState<string>('1w');
    const [positionTimeRange, setPositionTimeRange] = useState<string>('all');
    const [biddingStartTime, setBiddingStartTime] = useState<number>(Math.floor(Date.now() / 1000) - 3600);
    const [tradingPair, setTradingPair] = useState<string>('ETH/USD');
    const [showRules, setShowRules] = useState<boolean>(true);
    const [marketResult, setMarketResult] = useState<string>('Pending');

    const [availableCoins] = useState<Coin[]>([
        { value: "0x5fbdb2315678afecb367f032d93f642f64180aa3", label: "ICP/USD" },
        { value: "0x6fbdb2315678afecb367f032d93f642f64180aa3", label: "ETH/USD" },
        { value: "0x7fbdb2315678afecb367f032d93f642f64180aa3", label: "BTC/USD" }
    ]);

    const toast = useToast();
    const router = useRouter();
    const [marketService, setMarketService] = useState<BinaryOptionMarketService | null>(null);
    const [ledgerService, setLedgerService] = useState<IcpLedgerService | null>(null);
    const [shouldCheckRewardClaimability, setShouldCheckRewardClaimability] = useState(false);
    const [identityPrincipal, setIdentityPrincipal] = useState("");
    const [marketId, setMarketId] = useState<string | null>(null);
    // Add state to track if user is admin
    const [isAdmin, setIsAdmin] = useState(false);

    // Add a state to track if we need to show the market selection view
    const [showMarketSelection, setShowMarketSelection] = useState(false);
    const [factoryService, setFactoryService] = useState<FactoryService | null>(null);
    const [availableMarkets, setAvailableMarkets] = useState<MarketInfo[]>([]);

    // Add better debug logging for market ID
    useEffect(() => {
        if (contractAddress) {
            console.log("INITIALIZATION: Using contract address as market ID:", contractAddress);
            setMarketId(contractAddress);
            setShowMarketSelection(false);
        } else {
            console.log("INITIALIZATION: No contract address provided, showing market selection");
            setShowMarketSelection(true);
        }
    }, [contractAddress]);

    const formatTimeRemaining = (timestampSec: number): string => {
        const now = Math.floor(Date.now() / 1000); // Convert current time to seconds
        const diff = timestampSec - now;

        if (diff <= 0) return "Expired";

        const days = Math.floor(diff / (60 * 60 * 24));
        const hours = Math.floor((diff % (60 * 60 * 24)) / (60 * 60));
        const minutes = Math.floor((diff % (60 * 60)) / 60);
        const seconds = diff % 60;

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    };

    // useEffect(() => {
    //     setBalance(balanceEth);
    //     setIsLoggedIn(true);
    // }, [isLoggedIn]);

    // This effect will handle market service reinitialization when marketId changes
    useEffect(() => {
        if (marketId && marketService) {
            console.log("Reinitializing market service with ID:", marketId);
            marketService.initialize(marketId)
                .then(() => {
                    // After reinitialization, refresh market details
                    if (typeof fetchMarketDetails === 'function') {
                        fetchMarketDetails();
                    }
                })
                .catch(error => {
                    console.error("Error reinitializing market service:", error);
                });
        }
    }, [marketId, marketService]);

    // Add function to fetch markets from factory
    const fetchAvailableMarkets = useCallback(async () => {
        if (!factoryService) return;

        try {
            const markets = await factoryService.getMarkets();
            setAvailableMarkets(markets);
        } catch (error) {
            console.error("Error fetching markets:", error);
            // Fallback to at least show the default market if available
            const defaultId = process.env.NEXT_PUBLIC_BINARY_OPTION_MARKET_CANISTER_ID || "";
            if (defaultId) {
                setAvailableMarkets([{
                    id: defaultId,
                    name: "Default Market",
                    createdAt: BigInt(0) // Use zero timestamp for fallback 
                }]);
            }
        }
    }, [factoryService]);

    // Initialize factory service along with other services
    useEffect(() => {
        const initServices = async () => {
            try {
                console.log("INIT SERVICES: Starting service initialization");
                const authClient = await AuthClient.create();
                const identity = authClient.getIdentity();
                console.log("INIT SERVICES: Got identity", identity.getPrincipal().toText());

                // Initialize factory service first
                const factory = FactoryService.getInstance();
                await factory.initialize();
                setFactoryService(factory);
                console.log("INIT SERVICES: Factory service initialized");

                // Initialize other services as before
                await setIcpLedgerIdentity(identity);
                const icpLedgerService = IcpLedgerService.getInstance();
                await icpLedgerService.initialize();
                setLedgerService(icpLedgerService);
                console.log("INIT SERVICES: Ledger service initialized");

                await setActorIdentity(identity);
                const service = BinaryOptionMarketService.getInstance();

                // Only initialize market service if we have a market ID
                if (marketId) {
                    console.log("INIT SERVICES: Initializing market service with canister ID:", marketId);
                    await service.initialize(marketId);
                    setShowMarketSelection(false);
                } else {
                    // If no market ID, fetch available markets and show selection
                    console.log("INIT SERVICES: No market ID, showing selection");
                    setShowMarketSelection(true);
                    try {
                        const markets = await factory.getMarkets();
                        console.log("INIT SERVICES: Got markets:", markets);
                        setAvailableMarkets(markets);
                    } catch (error) {
                        console.error("INIT SERVICES: Error fetching markets:", error);
                    }
                }

                setMarketService(service);
                console.log("INIT SERVICES: Market service set, initialization complete");
            } catch (error) {
                console.error("INIT SERVICES: Error during initialization:", error);
            }
        };

        if (authenticated && (!factoryService || !marketService || !ledgerService)) {
            console.log("INIT SERVICES: Triggering initialization - authenticated:", authenticated);
            initServices();
        }
    }, [authenticated, marketId]);

    // Fetch markets when showing selection view
    useEffect(() => {
        if (showMarketSelection && factoryService) {
            fetchAvailableMarkets();
        }
    }, [showMarketSelection, factoryService, fetchAvailableMarkets]);

    const fetchMarketDetails = useCallback(async () => {
        try {
            console.log("FETCH DETAILS: Starting market details fetch");

            if (!marketService) {
                console.error("FETCH DETAILS: Market service not available");
                return;
            }

            console.log("FETCH DETAILS: Getting current phase");
            const phaseState = await marketService.getCurrentPhase();
            console.log("FETCH DETAILS: Current phase state:", phaseState);

            //@TODO: Make this a function
            if (('Trading' in phaseState)) {
                setCurrentPhase(Phase.Trading);
            } else if (('Bidding' in phaseState)) {
                setCurrentPhase(Phase.Bidding);
            } else if (('Maturity' in phaseState)) {
                setCurrentPhase(Phase.Maturity);
            } else if (('Expiry' in phaseState)) {
                setCurrentPhase(Phase.Expiry);
            }

            console.log("FETCH DETAILS: Getting market details");
            const marketDetails = await marketService.getMarketDetails();
            console.log("FETCH DETAILS: Market details:", marketDetails);

            // Check if user is market owner/admin
            if (marketDetails && marketDetails.owner && identityPrincipal) {
                const isOwner = marketDetails.owner.toText() === identityPrincipal;
                setIsAdmin(isOwner);
                console.log("FETCH DETAILS: User is admin:", isOwner);
            }

            const strikePrice = marketDetails.oracleDetails.strikePrice;
            const finalPrice = marketDetails.oracleDetails.finalPrice;

            console.log("FETCH DETAILS: Strike price:", strikePrice);
            console.log("FETCH DETAILS: Final price:", finalPrice);

            setStrikePrice(strikePrice); // Giả định 8 số thập phân
            setFinalPrice(finalPrice);   // Giả định 8 số thập phân

            // Get user position
            console.log("FETCH DETAILS: Getting user position for principal:", identityPrincipal);
            if (!identityPrincipal) {
                console.log("FETCH DETAILS: No identity principal available");
            } else {
                const userPosition = await marketService.getUserPosition(Principal.fromText(identityPrincipal));
                console.log("FETCH DETAILS: User position:", userPosition);

                if (userPosition) {
                    setPositions({
                        long: Number(userPosition.long) / 10e7,
                        short: Number(userPosition.short) / 10e7
                    });
                } else {
                    console.log("FETCH DETAILS: User position is null. Setting default positions.");
                    setPositions({ long: 0, short: 0 });
                }

                // Get total market positions
                console.log("FETCH DETAILS: Setting total market positions");
                setTotalMarketPositions({
                    long: Number(marketDetails.positions.long) / 10e7,
                    short: Number(marketDetails.positions.short) / 10e7
                });

                console.log("FETCH DETAILS: Getting total deposit");
                const totalDeposit = await marketService.getTotalDeposit();
                setTotalDeposited(Number(totalDeposit) / 10e7);

                if (currentPhase === Phase.Expiry) {
                    console.log("FETCH DETAILS: Market is in Expiry phase, checking reward claimability");
                    setShouldCheckRewardClaimability(true);
                }

                console.log("FETCH DETAILS: Getting end timestamp");
                const timestamp = await marketService.getEndTimestamp();
                if (timestamp) {
                    console.log("FETCH DETAILS: End timestamp (seconds):", timestamp);
                    setEndTimestamp(Number(timestamp));  // No need for conversion since it's already in seconds
                }
            }
        } catch (error) {
            console.error("FETCH DETAILS: Error fetching market details:", error);
        }

        try {
            if (ledgerService && identityPrincipal) {
                console.log("FETCH DETAILS: Getting user balance");
                const userBalance = await ledgerService.getBalance({
                    owner: Principal.fromText(identityPrincipal),
                    subaccount: []
                });
                console.log("FETCH DETAILS: User balance:", userBalance);
                setBalance((Number(userBalance) / 10e7).toFixed(4).toString());
            }
        } catch (error) {
            console.error("FETCH DETAILS: Error fetching user balance:", error);
        }
    }, [marketService, ledgerService, identityPrincipal, currentPhase]);

    const setInitialIdentity = async () => {
        try {
            console.log("IDENTITY: Starting identity initialization");
            const authClient = await AuthClient.create();
            const identity = authClient.getIdentity();
            const isAuthenticated = await authClient.isAuthenticated();

            if (isAuthenticated) {
                console.log("IDENTITY: User is authenticated with principal:", identity.getPrincipal().toText());
                setIdentityPrincipal(identity.getPrincipal().toText());

                console.log("IDENTITY: Setting actor identity");
                await setActorIdentity(identity);

                console.log("IDENTITY: Setting ICP ledger identity");
                await setIcpLedgerIdentity(identity);

                console.log("IDENTITY: Initializing services");
                const icpLedgerService = IcpLedgerService.getInstance();
                await icpLedgerService.initialize();
                setLedgerService(icpLedgerService);

                const service = BinaryOptionMarketService.getInstance();

                // Initialize with market ID if available
                if (marketId) {
                    console.log("IDENTITY: Initializing market service with ID:", marketId);
                    await service.initialize(marketId);
                } else {
                    console.log("IDENTITY: Initializing market service without specific ID");
                    await service.initialize();
                }

                setMarketService(service);
                console.log("IDENTITY: Services initialized successfully");
            } else {
                console.log("IDENTITY: User is not authenticated");
            }

            setAuthenticated(isAuthenticated);
        } catch (error) {
            console.error("IDENTITY: Error during identity initialization:", error);
        }
    };

    useEffect(() => {
        // prevent server-side rendering
        if (typeof window !== 'undefined') {
            setInitialIdentity();
        }
    }, []);

    const signIn = async () => {
        const authClient = await AuthClient.create();

        const internetIdentityUrl = (process.env.NODE_ENV == "production")
            ? `https://identity.ic0.app` :
            `http://${process.env.NEXT_PUBLIC_INTERNET_IDENTITY_CANISTER_ID}.localhost:4943`;

        await new Promise((resolve) => {
            authClient.login({
                identityProvider: internetIdentityUrl,
                onSuccess: () => resolve(undefined),
            });
        });

        const identity = authClient.getIdentity();
        setActorIdentity(identity);
        const isAuthenticated = await authClient.isAuthenticated();
        console.log(isAuthenticated);
        setIdentityPrincipal(identity.getPrincipal().toText())
        setAuthenticated(isAuthenticated);
    };

    useEffect(() => {
        if (currentPhase === Phase.Maturity) {
            setCountdown(5);
            const countdownInterval = setInterval(() => {
                setCountdown(prev => {
                    if (prev !== null && prev > 0) {
                        return prev - 1;
                    } else {
                        clearInterval(countdownInterval);
                        setCountdown(null);

                        setCurrentPhase(Phase.Expiry);
                        return null;
                    }
                });
            }, 1000);

            setTimeout(async () => {
                handleAfterCountdown();
            }, 5000);

            const handleAfterCountdown = async () => {
                clearInterval(countdownInterval);
                setCountdown(null);

                if (marketService) {
                    const marketDetails = await marketService.getMarketDetails()

                    const finalPrice = marketDetails.oracleDetails.finalPrice;
                    const strikePrice = marketDetails.oracleDetails.strikePrice;

                    console.log("Final Price:", finalPrice);
                    console.log("Strike Price:", strikePrice);
                    console.log("Selected Side:", selectedSide);

                    if (finalPrice >= strikePrice) {
                        console.log("long win")
                    } else {
                        console.log("short win")
                    }

                    setFinalPrice(finalPrice);
                    setStrikePrice(strikePrice);
                    // Logic so sánh
                    if (selectedSide === Side.Long && finalPrice >= strikePrice) {
                        setResultMessage("YOU WIN");
                    } else if (selectedSide === Side.Short && finalPrice <= strikePrice) {
                        setResultMessage("YOU WIN");
                    } else {
                        setResultMessage("YOU LOSE");
                    }
                    setShowResult(true);
                    setTimeout(() => {
                        setShowResult(false);
                    }, 2000);
                }
            }
        }
    }, [currentPhase]);

    const handleCoinSelect = async (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedValue = event.target.value;
        setSelectedCoin(availableCoins.find(coin => coin.value === selectedValue) || null);
    };

    // Hàm đặt cược
    const handleBid = async (side: Side, amount: number) => {
        try {
            if (!marketService || !ledgerService) {
                throw new Error("Services not initialized");
            }

            const amountInE8s = BigInt(Math.floor(amount * 10e7));
            console.log("Amount in e8s:", amountInE8s.toString());

            // First approve the market canister to spend your tokens
            const approveArgs = {
                spender: {
                    owner: Principal.fromText(marketId || ""),
                    subaccount: []
                },
                amount: amountInE8s,

            };

            const approveResult = await ledgerService.approve(approveArgs);
            console.log("Approve result:", approveResult);

            // Now place the bid
            const result = await marketService.bid(
                side === Side.Long ? { Long: null } : { Short: null },
                amountInE8s
            );

            console.log("Bid result:", result);
            if ('ok' in result) {
                toast({
                    description: "Bid placed successfully!",
                    status: "success",
                    duration: 3000,
                    isClosable: true,
                });
                // Refresh data after successful bid
                await fetchMarketDetails();
            } else {
                toast({
                    description: "Failed to place bid: " + result.err,
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
            }
        } catch (err) {
            console.error('Error placing bid:', err);
            toast({
                description: err instanceof Error ? err.message : "An unexpected error occurred",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
    };

    useEffect(() => {
        console.log("current phase is:", currentPhase);
        const interval = setInterval(() => {
            if (marketService && ledgerService) {
                fetchMarketDetails();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [marketService, ledgerService, currentPhase]);

    // Hàm claimReward khi phase là Expiry
    const claimReward = async () => {
        if (marketService && currentPhase === Phase.Expiry) {
            // const provider = new ethers.providers.Web3Provider(window.ethereum); // Define provider here
            try {
                const tx = await marketService.claimReward();

                // @TODO: implement get dfinity balance here
                // const newBalanceWei = await provider.getBalance(walletAddress);
                // const newBalanceEth = parseFloat(ethers.utils.formatEther(newBalanceWei));

                // const fee = (reward * 0.10); // 10% phí
                // const finalReward = reward - fee;

                // setBalance(newBalanceEth);  // Cập nhật lại số dư
                // setReward(finalReward);  // Reset lại reward sau khi claim
                // setShowClaimButton(false);  // Ẩn nt claim sau khi đã nhận


                setTotalDeposited(0);
                // Cập nhật lại bảng Long/Short
                await fetchMarketDetails(); // Gọi lại hàm để cập nhật thông tin


                toast({
                    title: "Reward claimed!",
                    description: `You've successfully claimed your reward.`,
                    status: "success",
                    duration: 3000,
                    isClosable: true,
                });
            } catch (error) {
                toast({
                    title: "Error claiming reward",
                    description: "An error occurred. Please try again.",
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
            }
        }
    };


    const canClaimReward = async () => {
        if (marketService && currentPhase === Phase.Expiry) {
            console.log("Checking claim eligibility..."); // Log để kiểm tra
            try {
                // const hasClaimed = await contract.hasClaimed(walletAddress);
                console.log('start checking claim reward')

                let winningSide = finalPrice >= strikePrice ? Side.Long : Side.Short;

                let userSide = positions.long > 0 ? Side.Long : Side.Short;

                console.log(positions);

                let userDeposit = 0;
                if (winningSide === userSide) {
                    // Nếu người chơi chọn đúng bên thắng, kiểm tra khoản cược
                    userDeposit = (userSide === Side.Long)
                        ? positions.long
                        : positions.short;
                }

                console.log("Winning side:", winningSide); // Log bên thắng
                console.log("User deposit:", userDeposit); // Log số tiền cược của người dùng



                // generated fake data. @TODO: change this soon after it works
                const hasClaimed = await marketService?.hasUserClaimed(Principal.fromText(identityPrincipal));

                console.log("Has claimed:", hasClaimed); // Log giá trị hasClaimed

                // Đảm bảo tính toán phần thưởng và cập nhật biến `reward`
                if (!hasClaimed && userDeposit > 0) {
                    const totalWinningDeposits = winningSide === Side.Long ? positions.long : positions.short;
                    const calculatedReward = ((userDeposit * totalDeposited) / totalWinningDeposits) * 0.90;

                    // const formattedReward = parseFloat(ethers.utils.formatEther(calculatedReward.toString()));
                    setReward(calculatedReward);  // Cập nhật phần thưởng
                    setShowClaimButton(true);
                } else {
                    setShowClaimButton(false);
                }
            } catch (error) {
                console.error("Error checking claim eligibility:", error);
                setShowClaimButton(false);
            }
        }
    };


    useEffect(() => {
        console.log("check reward claimability:");

        const checkClaimReward = async () => {
            canClaimReward();
        }

        checkClaimReward();
    }, [shouldCheckRewardClaimability]);

    // Reset lại thị trường
    const resetMarket = () => {
        setStrikePrice(0);
        setFinalPrice(0);
        setCurrentPhase(Phase.Bidding);
    };


    const abbreviateAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const isPhase = (phase: Phase, phaseName: string): boolean => {
        return Object.keys(phase)[0] === phaseName;
    };

    const getDisplayPrice = () => {
        if (countdown !== null) {
            return countdown;
        }
        return strikePrice.toString();
    };

    // Add a function to select a market
    const selectMarket = (marketId: string) => {
        router.push(`/customer/${marketId}`);
        setMarketId(marketId);
        setShowMarketSelection(false);
    };

    // Add/update the renderMarketSelection function to show market selection UI
    const renderMarketSelection = () => {
        return (
            <Box p={6} maxW="800px" mx="auto" bg="gray.800" borderRadius="md" mt={8}>
                <Text fontSize="2xl" fontWeight="bold" mb={6} textAlign="center" color="white">
                    Select a Market
                </Text>
                {availableMarkets.length === 0 ? (
                    <Text color="gray.400" textAlign="center">Loading available markets...</Text>
                ) : (
                    <VStack spacing={4} align="stretch">
                        {availableMarkets.map((market) => (
                            <Button
                                key={market.id}
                                onClick={() => {
                                    router.push(`/customer/${market.id}`);
                                    setMarketId(market.id);
                                    setShowMarketSelection(false);
                                }}
                                colorScheme="yellow"
                                bg="#FEDF56"
                                color="black"
                                size="lg"
                                _hover={{ bg: "#FFE980" }}
                                justifyContent="space-between"
                                p={6}
                            >
                                <Text fontWeight="bold">{market.name || market.id}</Text>
                                <Text fontSize="sm" opacity={0.8}>Created: {new Date(Number(market.createdAt) / 1000000).toLocaleString()}</Text>
                            </Button>
                        ))}
                    </VStack>
                )}
            </Box>
        );
    };

    useEffect(() => {
        // Update position percentages based on total positions
        if (totalMarketPositions.long + totalMarketPositions.short > 0) {
            const total = totalMarketPositions.long + totalMarketPositions.short;
            setLongPercentage((totalMarketPositions.long / total) * 100);
            setShortPercentage((totalMarketPositions.short / total) * 100);
        } else {
            // Default to 50/50 if no positions
            setLongPercentage(50);
            setShortPercentage(50);
        }
    }, [totalMarketPositions]);

    // Handle price updates and chart data
    useEffect(() => {
        if (!authenticated || !marketId) return;

        const priceService = PriceService.getInstance();
        let tradingPairForChart = 'ETH-USD'; // Default

        const loadTradingPair = async () => {
            try {
                if (marketService) {
                    const marketDetails = await marketService.getMarketDetails();
                    if (marketDetails && marketDetails.tradingPair) {
                        setTradingPair(marketDetails.tradingPair);
                        tradingPairForChart = marketDetails.tradingPair.replace('/', '-');
                        setChartSymbol(tradingPairForChart);
                    }
                }
            } catch (error) {
                console.error("Error loading trading pair:", error);
            }
        };

        loadTradingPair();

        // Subscribe to price updates
        const unsubscribe = priceService.subscribeToPriceUpdates((data: PriceData) => {
            setCurrentPrice(data.price);
        }, tradingPairForChart);

        // Load historical price data
        const loadChartData = async () => {
            try {
                const data = await priceService.fetchKlines(tradingPairForChart);
                setChartData(data);
            } catch (error) {
                console.error("Error loading chart data:", error);
            }
        };

        loadChartData();

        // Create position history for the chart
        const generatePositionHistory = () => {
            const history = [];
            const now = Math.floor(Date.now() / 1000);

            // Only generate mock position history if we don't have real data
            // Start from bidding time to current time
            if (biddingStartTime) {
                const startTime = biddingStartTime;
                const endTime = now;
                const interval = Math.max(Math.floor((endTime - startTime) / 10), 1);

                let longPercent = 50;
                let shortPercent = 50;

                for (let time = startTime; time <= endTime; time += interval) {
                    // Generate some random variation
                    const variation = Math.random() * 10 - 5; // -5 to +5 percent
                    longPercent = Math.max(10, Math.min(90, longPercent + variation));
                    shortPercent = 100 - longPercent;

                    history.push({
                        timestamp: time,
                        longPercentage: longPercent / 100,
                        shortPercentage: shortPercent / 100,
                        isMainPoint: time === startTime || time === endTime
                    });
                }

                // Add the current position percentages
                if (longPercentage !== null && shortPercentage !== null) {
                    history.push({
                        timestamp: now,
                        longPercentage: longPercentage / 100,
                        shortPercentage: shortPercentage / 100,
                        isMainPoint: true,
                        isCurrentPoint: true
                    });
                }
            }

            setPositionHistory(history);
        };

        generatePositionHistory();

        return () => {
            unsubscribe();
        };
    }, [authenticated, marketId, marketService, biddingStartTime, longPercentage, shortPercentage]);

    // Function to handle time range changes for charts
    const handleTimeRangeChange = (range: string, chartType: 'price' | 'position') => {
        if (chartType === 'price') {
            setPriceTimeRange(range);
        } else {
            setPositionTimeRange(range);
        }
    };

    // Format timestamp as readable date
    const formatMaturityTime = (timestamp: number): string => {
        try {
            const date = new Date(timestamp * 1000);
            return format(date, 'MMM d, yyyy HH:mm');
        } catch (error) {
            return "Unknown";
        }
    };

    // Add function to check if current user is admin
    const checkIsAdmin = async () => {
        try {
            if (!marketService || !identityPrincipal) return false;

            const marketDetails = await marketService.getMarketDetails();
            if (marketDetails && marketDetails.owner) {
                // Check if current user is the market owner
                const isOwner = marketDetails.owner.toText() === identityPrincipal;
                setIsAdmin(isOwner);
                return isOwner;
            }
            return false;
        } catch (error) {
            console.error("Error checking admin status:", error);
            return false;
        }
    };

    return (
        <Flex direction="column" alignItems="center" justifyContent="flex-start" p={6} bg="black" minH="100vh" position="relative">
            {showMarketSelection ? (
                renderMarketSelection()
            ) : (
                <>
                    {/* Header Bar */}
                    <Flex
                        width="100%"
                        justifyContent="space-between"
                        alignItems="center"
                        py={3}
                        px={6}
                        borderBottom="1px solid"
                        borderColor="gray.800"
                        mb={4}
                    >
                        <Button
                            leftIcon={<FaArrowUp color="#FEDF56" />}
                            borderColor="#FEDF56"
                            variant="outline"
                            size="sm"
                            onClick={() => router.push('/listaddress/1')}
                            color="#FEDF56"
                        >
                            Markets
                        </Button>

                        <HStack spacing={6} ml="auto" color="#FEDF56">
                            <Icon as={FaWallet} />
                            <Text>{abbreviateAddress(identityPrincipal)}</Text>
                            <Icon as={GoInfinity} />
                            <Text>Balance: {balance} ICP</Text>
                        </HStack>
                    </Flex>

                    {/* Market Title and Info */}
                    <Box display="flex" alignItems="center" mb={6} ml={6} width="100%">
                        <HStack>
                            {/* Coin Image */}
                            <Box
                                borderRadius="full"
                                bg="gray.800"
                                p={2}
                                mr={4}
                            >
                                <Icon
                                    as={tradingPair.includes("BTC") ? SiBitcoinsv :
                                        tradingPair.includes("ETH") ? FaEthereum :
                                            GoInfinity}
                                    boxSize="30px"
                                    color="#FEDF56"
                                />
                            </Box>

                            <Box>
                                <Heading size="md" fontSize="30px">
                                    <HStack>
                                        <Text color="#FEDF56" fontSize="30px">
                                            {tradingPair}
                                        </Text>
                                        <Text color="white" fontSize="25px">
                                            will reach ${strikePrice} by {formatMaturityTime(endTimestamp || 0)}
                                        </Text>
                                    </HStack>
                                </Heading>
                                <HStack spacing={2}>
                                    <HStack color="gray.400">
                                        <PiChartLineUpLight />
                                        <Text color="gray.400" fontSize="sm">
                                            {totalDeposited.toFixed(2)} ICP |
                                        </Text>
                                    </HStack>
                                    <HStack color="gray.400">
                                        <FaRegClock />
                                        <Text color="gray.400" fontSize="sm">
                                            {endTimestamp ? formatMaturityTime(endTimestamp) : "Unknown"} |
                                        </Text>
                                    </HStack>
                                    <HStack color="gray.400">
                                        <Icon as={FaRegClock} />
                                        <Text color="gray.400" fontSize="sm">
                                            Phase: {Phase[currentPhase]}
                                        </Text>
                                    </HStack>
                                </HStack>
                            </Box>
                            {(currentPhase === Phase.Maturity || currentPhase === Phase.Expiry) && (
                                <Box
                                    border="1px solid #FEDF56"
                                    borderRadius="md"
                                    p={3}
                                    mb={4}
                                    textAlign="center"
                                    ml="100px"
                                    textColor="white"
                                >
                                    <Text fontWeight="bold">Result: {finalPrice >= strikePrice ? "LONG WINS" : "SHORT WINS"}</Text>
                                </Box>
                            )}
                        </HStack>
                    </Box>

                    {/* Main Content */}
                    <Flex direction={{ base: "column", md: "row" }} width="100%">
                        {/* Left Side - Charts and Rules */}
                        <Box width={{ base: "100%", md: "75%" }} pr={{ base: 0, md: 4 }}>
                            <Tabs variant="line" colorScheme="yellow">
                                <TabList>
                                    <Tab>Price Chart</Tab>
                                    <Tab>Position Chart</Tab>
                                </TabList>

                                <TabPanels>
                                    <TabPanel p={0} pt={4}>
                                        <Box position="relative" width="100%">
                                            <MarketCharts
                                                chartData={chartData}
                                                positionHistory={positionHistory}
                                                positions={{ long: totalMarketPositions.long, short: totalMarketPositions.short }}
                                                strikePrice={strikePrice}
                                                timeRange={priceTimeRange}
                                                chartType="price"
                                                onTimeRangeChange={handleTimeRangeChange}
                                                chartSymbol={chartSymbol}
                                                biddingStartTime={biddingStartTime}
                                                maturityTime={endTimestamp || (Math.floor(Date.now() / 1000) + 86400)}
                                            />
                                        </Box>
                                    </TabPanel>

                                    <TabPanel p={0} pt={4}>
                                        <MarketCharts
                                            chartData={[]}
                                            positionHistory={positionHistory}
                                            positions={{ long: totalMarketPositions.long, short: totalMarketPositions.short }}
                                            strikePrice={strikePrice}
                                            timeRange={positionTimeRange}
                                            chartType="position"
                                            onTimeRangeChange={handleTimeRangeChange}
                                            chartSymbol={chartSymbol}
                                            biddingStartTime={biddingStartTime}
                                            maturityTime={endTimestamp || (Math.floor(Date.now() / 1000) + 86400)}
                                        />
                                    </TabPanel>
                                </TabPanels>
                            </Tabs>

                            {/* Rules Section */}
                            <Box mt={8} border="1px solid #2D3748" borderRadius="xl" p={4}>
                                <Flex justify="space-between" align="center" onClick={() => setShowRules(!showRules)} cursor="pointer">
                                    <Heading size="md" color="#F0F8FF" fontSize="25px">Rules:</Heading>
                                </Flex>
                                {showRules && (
                                    <Box mt={4}>
                                        <Text color="gray.400" mb={3}>
                                            This is a binary option market where users can place bids on whether the price will be above (LONG) or below (SHORT) the strike price: {strikePrice} USD at maturity.
                                        </Text>

                                        <Text color="gray.300" mt={2} mb={2}>The market goes through four phases: Trading, Bidding, Maturity, and Expiry.</Text>

                                        <Text color="gray.400" mb={4}>
                                            During the Trading phase, users can view the market but cannot place bids. In the Bidding phase, users can place LONG or SHORT bids. At Maturity, the final price is determined and winners can claim their rewards. In the Expiry phase, the market is closed and all rewards are distributed.
                                        </Text>

                                        <Text color="gray.400" mb={3}>
                                            The potential profit depends on the ratio of LONG to SHORT bids. If more users bet against you, your potential profit increases. A fee of 6.8% is charged on all bids to maintain the platform.
                                        </Text>

                                        <Text color="gray.400" mb={3}>
                                            Price data is sourced from cryptocurrency exchanges to ensure accurate and reliable market prices.
                                        </Text>
                                    </Box>
                                )}
                            </Box>
                        </Box>

                        {/* Right Side - Bid Panel and Market Info */}
                        <Box width={{ base: "100%", md: "25%" }} mt={{ base: 4, md: 0 }} ml={{ base: 0, md: 4 }}>
                            {/* Strike Price */}
                            <Box
                                bg="gray.800"
                                p={4}
                                borderRadius="xl"
                                mb={4}
                                borderWidth={1}
                                borderColor="gray.700"
                            >
                                <Flex justify="space-between" align="center" textAlign="center" fontSize="20px" color="#FEDF56">
                                    <HStack justify="center" align="center">
                                        <Text color="gray.400">Strike Price: </Text>
                                        <Text fontWeight="bold">{strikePrice} USD</Text>
                                    </HStack>
                                </Flex>

                                {/* Show Final Price in Maturity and Expiry phases */}
                                {(currentPhase === Phase.Maturity || currentPhase === Phase.Expiry) && (
                                    <Flex justify="space-between" align="center" mt={2} textAlign="center" fontSize="20px" color="#FEDF56">
                                        <Text color="gray.400">Final Price: </Text>
                                        <Text fontWeight="bold" color="white">{finalPrice} USD</Text>
                                    </Flex>
                                )}

                                {reward > 0 && currentPhase === Phase.Expiry && (
                                    <Button
                                        onClick={claimReward}
                                        colorScheme="yellow"
                                        bg="#FEDF56"
                                        color="black"
                                        _hover={{ bg: "#FFE56B" }}
                                        isDisabled={reward === 0}
                                        width="100%"
                                        mt={4}
                                    >
                                        Claim {reward.toFixed(4)} ICP
                                    </Button>
                                )}
                            </Box>

                            <Box
                                bg="gray.800"
                                p={4}
                                borderRadius="xl"
                                mb={4}
                                borderWidth={1}
                                borderColor="gray.700"
                            >
                                {/* LONG/SHORT Ratio */}
                                <Flex
                                    align="center"
                                    w="100%"
                                    h="25px"
                                    borderRadius="full"
                                    bg="gray.800"
                                    border="1px solid"
                                    borderColor="gray.600"
                                    position="relative"
                                    overflow="hidden"
                                    boxShadow="inset 0 1px 3px rgba(0,0,0,0.6)"
                                    mb={4}
                                >
                                    {/* LONG Section */}
                                    <Box
                                        width={`${longPercentage}%`}
                                        bgGradient="linear(to-r, #0f0c29, #00ff87)"
                                        transition="width 0.6s ease"
                                        h="full"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="flex-end"
                                        pr={3}
                                        position="relative"
                                        zIndex={1}
                                    >
                                        {longPercentage > 8 && (
                                            <Text
                                                fontSize="sm"
                                                fontWeight="bold"
                                                color="whiteAlpha.800"
                                            >
                                                {longPercentage.toFixed(0)}%
                                            </Text>
                                        )}
                                    </Box>

                                    {/* SHORT Section */}
                                    <Box
                                        position="absolute"
                                        right="0"
                                        top="0"
                                        h="100%"
                                        width={`${shortPercentage}%`}
                                        bgGradient="linear(to-r, #ff512f, #dd2476)"
                                        transition="width 0.6s ease"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="flex-start"
                                        pl={3}
                                        zIndex={0}
                                    >
                                        {shortPercentage > 8 && (
                                            <Text
                                                fontSize="sm"
                                                fontWeight="bold"
                                                color="whiteAlpha.800"
                                            >
                                                {shortPercentage.toFixed(0)}%
                                            </Text>
                                        )}
                                    </Box>
                                </Flex>

                                <Text textAlign="center" fontSize="md" mb={4} color="gray.400">You're betting</Text>

                                <Input
                                    placeholder="Enter bid amount in ICP"
                                    value={bidAmount}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (/^\d*\.?\d*$/.test(value)) setBidAmount(value);
                                    }}
                                    color="#FEDF56"
                                    bg="transparent"
                                    border="1px solid"
                                    borderColor="gray.600"
                                    textAlign="center"
                                    _placeholder={{ color: "gray.500" }}
                                    size="lg"
                                    mb={4}
                                />

                                <Button
                                    onClick={() => handleBid(Side.Long, Number(bidAmount))}
                                    isDisabled={!bidAmount || Number(bidAmount) <= 0 || currentPhase !== Phase.Bidding}
                                    bg="#00ff87"
                                    color="black"
                                    _hover={{ opacity: 0.8 }}
                                    width="100%"
                                    mb={2}
                                >
                                    LONG
                                </Button>

                                <Button
                                    onClick={() => handleBid(Side.Short, Number(bidAmount))}
                                    isDisabled={!bidAmount || Number(bidAmount) <= 0 || currentPhase !== Phase.Bidding}
                                    bg="#ff416c"
                                    color="white"
                                    _hover={{ opacity: 0.8 }}
                                    width="100%"
                                >
                                    SHORT
                                </Button>

                                <Divider my={4} />

                                <Text fontSize="sm" color="gray.400" mb={1}>Pot. profit: {totalDeposited > 0 ? "0.0000 -> 0.0000 ICP" : "N/A"}</Text>
                                <Text fontSize="sm" color="gray.400" mb={4}>Fee: 6.8%</Text>

                                <Text fontSize="md" fontWeight="bold" color="white" mb={2}>Your Position</Text>
                                <HStack justify="space-between" mb={1}>
                                    <Text color="#00ff87">LONG:</Text>
                                    <Text color="white">{positions.long.toFixed(4)} ICP</Text>
                                </HStack>
                                <HStack justify="space-between">
                                    <Text color="#ff416c">SHORT:</Text>
                                    <Text color="white">{positions.short.toFixed(4)} ICP</Text>
                                </HStack>
                            </Box>

                            <Box
                                bg="gray.800"
                                p={4}
                                borderRadius="xl"
                                borderWidth={1}
                                borderColor="gray.700"
                            >
                                <Text fontSize="md" fontWeight="bold" color="white" mb={3}>My Holdings</Text>
                                <Button
                                    colorScheme="blue"
                                    variant="outline"
                                    size="sm"
                                    width="100%"
                                    rightIcon={<FaArrowDown />}
                                >
                                    Make your first Prediction Market
                                </Button>
                            </Box>

                            {/* Market Timeline */}
                            <Box
                                bg="gray.800"
                                p={4}
                                borderRadius="xl"
                                borderWidth={1}
                                borderColor="gray.700"
                                position="relative"
                                mb={4}
                            >
                                <Text fontSize="md" fontWeight="bold" color="white" mb={4} textAlign="center">
                                    Market is Live
                                </Text>

                                <Box
                                    bg="#1A202C"
                                    p={4}
                                    borderRadius="xl"
                                    borderWidth={1}
                                    borderColor="gray.700"
                                >
                                    <VStack align="stretch" spacing={3} position="relative">
                                        {/* Vertical Line */}
                                        <Box
                                            position="absolute"
                                            left="16px"
                                            top="30px"
                                            bottom="20px"
                                            width="2px"
                                            bg="gray.700"
                                            zIndex={0}
                                        />

                                        {/* Trading Phase */}
                                        <HStack spacing={4}>
                                            <Circle size="35px" bg={currentPhase === Phase.Trading ? "green.400" : "gray.700"} color="white">1</Circle>
                                            <VStack align="start" spacing={0} fontWeight="bold">
                                                <Text fontSize="md" color={currentPhase === Phase.Trading ? "green.400" : "gray.500"}>
                                                    Trading
                                                </Text>
                                                <Text fontSize="xs" color="gray.500">
                                                    {endTimestamp ? new Date((Number(endTimestamp) - 86400) * 1000).toLocaleString() : 'Pending'}
                                                </Text>
                                            </VStack>
                                            <Spacer />
                                            {currentPhase === Phase.Trading && isAdmin && (
                                                <Button
                                                    onClick={async () => {
                                                        try {
                                                            if (marketService) {
                                                                await marketService.startTrading();
                                                                await fetchMarketDetails();
                                                            }
                                                        } catch (error) {
                                                            console.error("Error starting bidding:", error);
                                                        }
                                                    }}
                                                    size="sm"
                                                    colorScheme="yellow"
                                                    bg="#FEDF56"
                                                    color="black"
                                                    _hover={{ bg: "#FFE56B" }}
                                                    width="35%"
                                                >
                                                    Start Bidding
                                                </Button>
                                            )}
                                        </HStack>

                                        {/* Bidding Phase */}
                                        <HStack spacing={4}>
                                            <Circle size="35px" bg={currentPhase === Phase.Bidding ? "blue.400" : "gray.700"} color="white">2</Circle>
                                            <VStack align="start" spacing={0} fontWeight="bold">
                                                <Text fontSize="md" color={currentPhase === Phase.Bidding ? "blue.400" : "gray.500"}>
                                                    Bidding
                                                </Text>
                                                <Text fontSize="xs" color="gray.500">
                                                    {endTimestamp ? new Date((Number(endTimestamp) - 43200) * 1000).toLocaleString() : 'Waiting'}
                                                </Text>
                                            </VStack>
                                            <Spacer />
                                            {currentPhase === Phase.Bidding && isAdmin && (
                                                <Button
                                                    onClick={async () => {
                                                        try {
                                                            if (marketService) {
                                                                await marketService.resolveMarket();
                                                                await fetchMarketDetails();
                                                            }
                                                        } catch (error) {
                                                            console.error("Error resolving market:", error);
                                                        }
                                                    }}
                                                    size="sm"
                                                    colorScheme="yellow"
                                                    bg="#FEDF56"
                                                    color="black"
                                                    _hover={{ bg: "#FFE56B" }}
                                                    width="35%"
                                                >
                                                    Resolve
                                                </Button>
                                            )}
                                        </HStack>

                                        {/* Maturity Phase */}
                                        <HStack spacing={4} justify="space-between">
                                            <HStack spacing={4}>
                                                <Circle size="35px" bg={currentPhase === Phase.Maturity ? "orange.400" : "gray.700"} color="white">3</Circle>
                                                <VStack align="start" spacing={0} fontWeight="bold">
                                                    <Text fontSize="md" color={currentPhase === Phase.Maturity ? "orange.400" : "gray.500"}>
                                                        Maturity
                                                    </Text>
                                                    <Text fontSize="xs" color="gray.500">
                                                        {endTimestamp ? new Date(Number(endTimestamp) * 1000).toLocaleString() : 'Pending'}
                                                    </Text>
                                                </VStack>
                                            </HStack>
                                            <Spacer />
                                            {currentPhase === Phase.Maturity && finalPrice && isAdmin && (
                                                <Button
                                                    onClick={async () => {
                                                        try {
                                                            if (marketService) {
                                                                await marketService.expireMarket();
                                                                await fetchMarketDetails();
                                                            }
                                                        } catch (error) {
                                                            console.error("Error expiring market:", error);
                                                        }
                                                    }}
                                                    size="sm"
                                                    colorScheme="yellow"
                                                    bg="#FEDF56"
                                                    color="black"
                                                    _hover={{ bg: "#FFE56B" }}
                                                    width="35%"
                                                >
                                                    Expire
                                                </Button>
                                            )}
                                        </HStack>

                                        {/* Expiry Phase */}
                                        <HStack spacing={4}>
                                            <Circle size="35px" bg={currentPhase === Phase.Expiry ? "red.400" : "gray.700"} color="white">4</Circle>
                                            <VStack align="start" spacing={0} fontWeight="bold">
                                                <Text fontSize="md" color={currentPhase === Phase.Expiry ? "red.400" : "gray.500"}>
                                                    Expiry
                                                </Text>
                                                <Text fontSize="xs" color="gray.500">
                                                    {endTimestamp ? new Date((Number(endTimestamp) + 3600) * 1000).toLocaleString() : 'Pending'}
                                                </Text>
                                            </VStack>
                                        </HStack>
                                    </VStack>
                                </Box>
                            </Box>
                        </Box>
                    </Flex>
                </>
            )}
            {showResult && (
                <Box
                    position="fixed"
                    bottom={4}
                    left="50%"
                    transform="translateX(-50%)"
                    bg={resultMessage === "YOU WIN" ? "green.500" : "red.500"}
                    color="white"
                    px={6}
                    py={3}
                    borderRadius="md"
                    boxShadow="lg"
                >
                    {resultMessage}
                </Box>
            )}
        </Flex>
    );
}

export default Customer;
