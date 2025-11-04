import express from 'express';
import * as accountController from '../controllers/accountController';

const router = express.Router();

// Account routes
router.get('/info', accountController.getAccountInfo);
router.post('/deposit', accountController.deposit);
router.post('/refund', accountController.requestRefund);

export default router; 