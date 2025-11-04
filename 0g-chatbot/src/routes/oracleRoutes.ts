import { Router } from 'express';
import { resolveMarket, queryPrice } from '../controllers/oracleController';

const router = Router();

router.post('/resolve-market', resolveMarket);
router.post('/query-price', queryPrice);

export default router;

