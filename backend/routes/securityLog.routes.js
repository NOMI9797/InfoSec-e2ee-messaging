import express from 'express';
import {
  getSecurityLogs,
  getSecurityLogStats,
  getSecurityLog,
  createSecurityLog
} from '../controllers/securityLog.controller.js';

const router = express.Router();

// Create a security log (for client-side logging)
router.post('/', createSecurityLog);

// Get security logs with filtering
router.get('/', getSecurityLogs);

// Get security log statistics
router.get('/stats', getSecurityLogStats);

// Get a specific security log
router.get('/:logId', getSecurityLog);

export default router;

