import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Box, Tabs, TabList, TabPanels, Tab, TabPanel, HStack, Button, Text, ButtonGroup, Flex, Skeleton } from '@chakra-ui/react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, AreaChart, Area } from 'recharts';
import { PriceService } from '../../service/price-service';
import { format, subDays } from 'date-fns';

interface Position {
    long: number;
    short: number;
}

interface PositionPoint {
    timestamp: number;
    longPercentage: number | null;
    shortPercentage: number | null;
    isMainPoint?: boolean;
    isCurrentPoint?: boolean;
}

interface MarketChartsProps {
    chartData?: any[];
    positionHistory: PositionPoint[];
    positions: Position;
    chartSymbol?: string;
    strikePrice?: number;
    timeRange?: string;
    chartType?: 'price' | 'position';
    onTimeRangeChange?: (range: string, chartType: 'price' | 'position') => void;
    options?: {
        showPrice?: boolean;
        showPositions?: boolean;
    };
    biddingStartTime: number;
    maturityTime: number;
}

/**
 * MarketCharts Component
 * Renders interactive charts for binary option markets showing price history and position distribution
 */
const MarketCharts: React.FC<MarketChartsProps> = ({
    chartData = [],
    positionHistory,
    positions,
    strikePrice = 0,
    chartType = 'price',
    options = { showPrice: true, showPositions: true },
    chartSymbol = 'ETH-USD',
    biddingStartTime,
    maturityTime
}) => {
    const [currentTime, setCurrentTime] = useState<number>(Math.floor(Date.now() / 1000));
    const [isLoadingChart, setIsLoadingChart] = useState<boolean>(true);
    const [localChartData, setLocalChartData] = useState<any[]>([]);
    const [effectiveChartSymbol, setEffectiveChartSymbol] = useState<string>(chartSymbol || 'ETH-USD');
    const [hoverData, setHoverData] = useState<any>(null);
    const initialLoadRef = useRef<boolean>(true);
    const priceServiceRef = useRef(PriceService.getInstance());

    // Initialize chart data
    useEffect(() => {
        const loadChartData = async () => {
            try {
                if (chartType === 'price' && effectiveChartSymbol) {
                    const service = priceServiceRef.current;
                    const data = await service.fetchKlines(effectiveChartSymbol, '1d', 30);
                    setLocalChartData(data);
                }
            } catch (error) {
                console.error("Error loading chart data:", error);
            } finally {
                setIsLoadingChart(false);
            }
        };

        loadChartData();

        // Update current time periodically
        const interval = setInterval(() => {
            setCurrentTime(Math.floor(Date.now() / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [chartType, effectiveChartSymbol]);

    // Update chart symbol if needed
    useEffect(() => {
        if (chartSymbol) {
            setEffectiveChartSymbol(chartSymbol);
        }
    }, [chartSymbol]);

    // Generate tick marks for price chart x-axis
    const getPriceChartTicks = () => {
        const today = new Date();
        const ticks = [];

        for (let i = 6; i >= 0; i--) {
            const date = subDays(today, i);
            ticks.push(date.getTime());
        }

        return ticks;
    };

    // Format price chart x-axis tick labels as dates
    const formatPriceXAxisTick = (timestamp: number) => {
        return format(new Date(timestamp), 'dd/MM');
    };

    // Format position chart x-axis tick labels as dates
    const formatPositionXAxisTick = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return format(date, 'HH:mm dd/MM');
    };

    // Custom tooltip for price chart
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <Box
                    bg="gray.800"
                    p={2}
                    borderRadius="md"
                    border="1px solid"
                    borderColor="gray.700"
                >
                    <Text color="gray.200">
                        {format(new Date(label), 'MMM dd, yyyy HH:mm')}
                    </Text>
                    <Text color="#FEDF56" fontWeight="bold">
                        ${payload[0].value.toFixed(2)}
                    </Text>
                </Box>
            );
        }

        return null;
    };

    // Handle mouse hover on chart
    const handleMouseMove = (e: any) => {
        if (e && e.activePayload && e.activePayload.length) {
            setHoverData(e.activePayload[0].payload);
        }
    };

    // Handle mouse leave from chart
    const handleMouseLeave = () => {
        setHoverData(null);
    };

    // Optimize price chart data
    const optimizedPriceData = useMemo(() => {
        if (localChartData.length === 0) return [];

        return localChartData.sort((a, b) => a.time - b.time);
    }, [localChartData]);

    // Render price chart
    const renderPriceChart = () => {
        return (
            <Box height="350px" position="relative">
                {isLoadingChart ? (
                    <Skeleton height="100%" width="100%" borderRadius="md" />
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={optimizedPriceData}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={handleMouseLeave}
                        >
                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                            <XAxis
                                dataKey="time"
                                domain={['auto', 'auto']}
                                name="Time"
                                tickFormatter={formatPriceXAxisTick}
                                ticks={getPriceChartTicks()}
                                type="number"
                                stroke="#666"
                            />
                            <YAxis
                                domain={['auto', 'auto']}
                                tickFormatter={(value) => `$${value.toFixed(0)}`}
                                stroke="#666"
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine
                                y={strikePrice}
                                stroke="#FEDF56"
                                strokeDasharray="3 3"
                                label={{
                                    value: `Strike: $${strikePrice}`,
                                    fill: '#FEDF56',
                                    fontSize: 12,
                                    position: 'right'
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="close"
                                stroke="#ff6a00"
                                dot={false}
                                strokeWidth={2}
                                animationDuration={500}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </Box>
        );
    };

    // Render position chart
    const renderPositionChart = () => {
        const positionData = positionHistory.map(point => ({
            ...point,
            timestamp: point.timestamp * 1000 // Convert to milliseconds for chart
        }));

        return (
            <Box height="350px" position="relative">
                {positionData.length === 0 ? (
                    <Flex
                        height="100%"
                        alignItems="center"
                        justifyContent="center"
                        bg="gray.800"
                        borderRadius="md"
                        color="gray.400"
                    >
                        <Text>Position data not available</Text>
                    </Flex>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={positionData}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            stackOffset="expand"
                        >
                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                            <XAxis
                                dataKey="timestamp"
                                domain={['auto', 'auto']}
                                name="Time"
                                tickFormatter={formatPositionXAxisTick}
                                type="number"
                                stroke="#666"
                            />
                            <YAxis
                                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                                stroke="#666"
                            />
                            <Tooltip
                                formatter={(value) => [`${(Number(value) * 100).toFixed(2)}%`, 'Percentage']}
                                labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy HH:mm')}
                            />
                            <Area
                                type="monotone"
                                dataKey="longPercentage"
                                stackId="1"
                                stroke="#00ff87"
                                fill="url(#colorLong)"
                                fillOpacity={0.8}
                                name="Long"
                            />
                            <Area
                                type="monotone"
                                dataKey="shortPercentage"
                                stackId="1"
                                stroke="#ff416c"
                                fill="url(#colorShort)"
                                fillOpacity={0.8}
                                name="Short"
                            />
                            <defs>
                                <linearGradient id="colorLong" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#00ff87" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#0f0c29" stopOpacity={0.2} />
                                </linearGradient>
                                <linearGradient id="colorShort" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ff416c" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#ff4b2b" stopOpacity={0.2} />
                                </linearGradient>
                            </defs>
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </Box>
        );
    };

    // Main render
    return (
        <Box
            bg="gray.800"
            p={4}
            borderRadius="xl"
            borderWidth={1}
            borderColor="gray.700"
            position="relative"
        >
            {chartType === 'price' ? renderPriceChart() : renderPositionChart()}
        </Box>
    );
};

export default MarketCharts; 