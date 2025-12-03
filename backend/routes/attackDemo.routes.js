import express from 'express';
import { logMITMAttack, logReplayAttack } from '../controllers/attackDemo.controller.js';

const router = express.Router();

// Log attack demonstrations
router.post('/mitm', logMITMAttack);
router.post('/replay', logReplayAttack);

export default router;


