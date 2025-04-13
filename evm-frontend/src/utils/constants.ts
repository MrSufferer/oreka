// Định nghĩa hằng số để chuyển đổi giữa giá trị số thực và số nguyên trong blockchain
import { ethers } from 'ethers';

// Usar BigNumber để tránh vấn đề về độ chính xác với các số lớn
export const STRIKE_PRICE_DECIMALS = 8;
export const STRIKE_PRICE_MULTIPLIER = ethers.BigNumber.from(10).pow(STRIKE_PRICE_DECIMALS);

// Otras constantes... 