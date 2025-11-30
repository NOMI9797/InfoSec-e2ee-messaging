import express from 'express';
import { getAllUsers, getPublicKey, getPublicKeyByUsername } from '../controllers/user.controller.js';

const router = express.Router();

// OPTIONS requests are handled at server level, no need for route-level handlers

// Get all users (must be before /:userId route to avoid conflict)
router.get('/', getAllUsers);

router.get('/:userId/public-key', getPublicKey);
router.get('/username/:username/public-key', getPublicKeyByUsername);

export default router;

