/**
 * Security logging utility
 * Logs security-related events for audit and monitoring
 */

import SecurityLog from '../models/SecurityLog.model.js';

/**
 * Create a security log entry
 * @param {Object} logData - Log entry data
 * @param {string} logData.eventType - Type of event
 * @param {string} logData.severity - Severity level (INFO, WARNING, ERROR, CRITICAL)
 * @param {string} logData.userId - User ID (optional)
 * @param {string} logData.username - Username (optional)
 * @param {string} logData.ipAddress - IP address (optional)
 * @param {string} logData.userAgent - User agent (optional)
 * @param {Object} logData.details - Additional details (optional)
 * @param {boolean} logData.success - Whether the operation succeeded
 * @param {string} logData.errorMessage - Error message if failed
 */
export async function logSecurityEvent({
  eventType,
  severity = 'INFO',
  userId = null,
  username = null,
  ipAddress = null,
  userAgent = null,
  details = {},
  success = true,
  errorMessage = null
}) {
  try {
    const logEntry = new SecurityLog({
      eventType,
      severity,
      userId,
      username,
      ipAddress,
      userAgent,
      details,
      success,
      errorMessage,
      timestamp: new Date()
    });

    await logEntry.save();
    
    // Log to console for development
    if (process.env.NODE_ENV !== 'production') {
      const logMessage = `[${severity}] ${eventType} - User: ${username || userId || 'Unknown'} - Success: ${success}`;
      if (errorMessage) {
        console.log(logMessage, '- Error:', errorMessage);
      } else {
        console.log(logMessage);
      }
    }
  } catch (error) {
    // Don't throw - logging should never break the application
    console.error('Error creating security log:', error);
  }
}

/**
 * Extract IP address and user agent from request
 * @param {Object} req - Express request object
 * @returns {Object} - { ipAddress, userAgent }
 */
export function extractRequestInfo(req) {
  const ipAddress = req.ip || 
                    req.headers['x-forwarded-for']?.split(',')[0] || 
                    req.connection?.remoteAddress || 
                    'unknown';
  
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  return { ipAddress, userAgent };
}

/**
 * Log authentication attempt
 */
export async function logAuthAttempt(req, username, success, errorMessage = null) {
  const { ipAddress, userAgent } = extractRequestInfo(req);
  
  await logSecurityEvent({
    eventType: success ? 'AUTH_SUCCESS' : 'AUTH_FAILURE',
    severity: success ? 'INFO' : 'WARNING',
    username,
    ipAddress,
    userAgent,
    success,
    errorMessage
  });
}

/**
 * Log key exchange event
 */
export async function logKeyExchange(req, eventType, userId, username, exchangeId, success, errorMessage = null) {
  const { ipAddress, userAgent } = extractRequestInfo(req);
  
  await logSecurityEvent({
    eventType,
    severity: success ? 'INFO' : 'ERROR',
    userId,
    username,
    ipAddress,
    userAgent,
    details: { exchangeId },
    success,
    errorMessage
  });
}

/**
 * Log decryption event
 */
export async function logDecryption(req, userId, username, success, errorMessage = null, details = {}) {
  const { ipAddress, userAgent } = extractRequestInfo(req);
  
  await logSecurityEvent({
    eventType: success ? 'DECRYPTION_SUCCESS' : 'DECRYPTION_FAILURE',
    severity: success ? 'INFO' : 'WARNING',
    userId,
    username,
    ipAddress,
    userAgent,
    details,
    success,
    errorMessage
  });
}

/**
 * Log replay attack detection
 */
export async function logReplayAttack(req, userId, username, reason, details = {}) {
  const { ipAddress, userAgent } = extractRequestInfo(req);
  
  await logSecurityEvent({
    eventType: 'REPLAY_ATTACK_DETECTED',
    severity: 'CRITICAL',
    userId,
    username,
    ipAddress,
    userAgent,
    details: { reason, ...details },
    success: false,
    errorMessage: `Replay attack detected: ${reason}`
  });
}

/**
 * Log invalid nonce/timestamp/sequence
 */
export async function logInvalidRequest(req, eventType, userId, username, reason, details = {}) {
  const { ipAddress, userAgent } = extractRequestInfo(req);
  
  await logSecurityEvent({
    eventType,
    severity: 'WARNING',
    userId,
    username,
    ipAddress,
    userAgent,
    details: { reason, ...details },
    success: false,
    errorMessage: reason
  });
}


