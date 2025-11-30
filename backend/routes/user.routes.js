import express from 'express';
import { getPublicKey, getPublicKeyByUsername } from '../controllers/user.controller.js';

const router = express.Router();

// OPTIONS requests are handled at server level, no need for route-level handlers

router.get('/:userId/public-key', getPublicKey);
router.get('/username/:username/public-key', getPublicKeyByUsername);

export default router;

