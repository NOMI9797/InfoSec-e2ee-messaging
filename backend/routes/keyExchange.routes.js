import express from 'express';
import {
  initiateKeyExchange,
  respondToKeyExchange,
  confirmKeyExchange,
  getPendingExchanges,
  getKeyExchange,
  getCompletedExchanges
} from '../controllers/keyExchange.controller.js';

const router = express.Router();

router.post('/initiate', initiateKeyExchange);
router.post('/respond', respondToKeyExchange);
router.post('/confirm', confirmKeyExchange);
router.get('/pending/:userId', getPendingExchanges);
router.get('/completed/:userId', getCompletedExchanges); // Must be before /:exchangeId
router.get('/:exchangeId', getKeyExchange);

export default router;

