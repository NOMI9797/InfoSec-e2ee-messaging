import express from 'express';
import {
  initiateKeyExchange,
  respondToKeyExchange,
  confirmKeyExchange,
  getPendingExchanges,
  getKeyExchange
} from '../controllers/keyExchange.controller.js';

const router = express.Router();

router.post('/initiate', initiateKeyExchange);
router.post('/respond', respondToKeyExchange);
router.post('/confirm', confirmKeyExchange);
router.get('/pending/:userId', getPendingExchanges);
router.get('/:exchangeId', getKeyExchange);

export default router;

