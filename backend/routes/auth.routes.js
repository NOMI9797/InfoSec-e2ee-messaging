import express from 'express';
import { register, login } from '../controllers/auth.controller.js';

const router = express.Router();

// OPTIONS requests are handled at server level, no need for route-level handlers

router.post('/register', register);
router.post('/login', login);

export default router;

