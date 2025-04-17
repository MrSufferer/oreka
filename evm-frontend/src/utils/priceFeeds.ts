// Map từ Chainlink price feed addresses sang trading pairs
export const CHAINLINK_PRICE_FEEDS_MAP = {
  "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43": "BTC/USD",
  "0x694AA176935721D5E4FAC081bf1f309aDC325306": "ETH/USD",
  "0x1a81afB8146aeFCFC5E50e8479e826E7DE55b910": "EUR/USD",
  "0x8A6af2B75F23831ADc973ce6288e5329F63D86c6": "USD/JPY",
  "0x91FAB41F5f3bE955963a986366edAcFf1aaeaa83": "GBP/USD",
  "0x14866185B1962B63C3Ea9E03Bc1da838bab34C19": "DAI/USD",
  "0xc59E3633BAAC79493d98e63626716e204A45EdF": "LINK/USD",
  "0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E": "USDC/USD",
  "0xB0C712f98daE1526c8E26132BC91C40aD4d5F9": "AUD/USD",
  "0x5fb1616F78dA7aFC9FF79e0371741a747D2a7F22": "BTC/ETH"
};

// Hàm chuyển đổi từ price feed address sang trading pair
export const getTradingPairFromPriceFeed = (priceFeedAddress: string): string => {
  return CHAINLINK_PRICE_FEEDS_MAP[priceFeedAddress] || "Unknown";
};

// Hàm chuyển đổi từ trading pair sang chart symbol format
export const getChartSymbolFromTradingPair = (tradingPair: string): string => {
  if (!tradingPair) return '';
  return tradingPair.replace('/', '-');
};

// Hàm chuyển đổi strikePrice từ blockchain format (integer) sang display format (float)
export const formatStrikePriceFromContract = (strikePriceInteger: string, multiplier: number = 100000000): string => {
  if (!strikePriceInteger) return "0";
  const price = parseInt(strikePriceInteger);
  return (price / multiplier).toFixed(2);
};

// Hàm chuyển đổi strikePrice từ display format (float) sang blockchain format (integer)
export const formatStrikePriceForContract = (strikePriceFloat: string, multiplier: number = 100000000): number => {
  if (!strikePriceFloat) return 0;
  const price = parseFloat(strikePriceFloat);
  return Math.round(price * multiplier);
}; 