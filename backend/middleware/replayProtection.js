/**
 * Replay attack protection middleware
 * Validates nonces, timestamps, and sequence numbers
 */

import MessageSequence from '../models/MessageSequence.model.js';
import { logReplayAttack, logInvalidRequest, extractRequestInfo } from '../utils/securityLogger.js';

// Time window for timestamp validation (5 minutes)
const TIMESTAMP_WINDOW = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Validate and update sequence numbers for replay protection
 * @param {string} exchangeId - Key exchange ID
 * @param {string} fromUserId - Sender user ID
 * @param {string} toUserId - Recipient user ID
 * @param {number} sequenceNumber - Sequence number from request
 * @param {string} nonce - Nonce from request
 * @param {number} timestamp - Timestamp from request
 * @param {Object} req - Express request object
 * @returns {Promise<{valid: boolean, reason?: string}>}
 */
export async function validateReplayProtection(
  exchangeId,
  fromUserId,
  toUserId,
  sequenceNumber,
  nonce,
  timestamp,
  req
) {
  try {
    // Find or create sequence document
    let sequenceDoc = await MessageSequence.findOne({ exchangeId });
    
    if (!sequenceDoc) {
      // Create new sequence document
      sequenceDoc = new MessageSequence({
        exchangeId,
        fromUserId,
        toUserId,
        sequenceFromTo: 0,
        sequenceToFrom: 0,
        usedNonces: [],
        recentTimestamps: []
      });
    }

    // Cleanup old entries
    await sequenceDoc.cleanupOldEntries();

    // Determine direction and expected sequence number
    const isFromTo = sequenceDoc.fromUserId.toString() === fromUserId.toString() &&
                     sequenceDoc.toUserId.toString() === toUserId.toString();
    const isToFrom = sequenceDoc.toUserId.toString() === fromUserId.toString() &&
                     sequenceDoc.fromUserId.toString() === toUserId.toString();

    if (!isFromTo && !isToFrom) {
      // User pair mismatch - this shouldn't happen, but handle gracefully
      return {
        valid: false,
        reason: 'User pair mismatch'
      };
    }

    const expectedSequence = isFromTo ? sequenceDoc.sequenceFromTo + 1 : sequenceDoc.sequenceToFrom + 1;

    // Validate sequence number
    if (sequenceNumber !== undefined && sequenceNumber !== null) {
      if (sequenceNumber < expectedSequence) {
        // Sequence number is too old - possible replay
        const { ipAddress, userAgent } = extractRequestInfo(req);
        await logReplayAttack(req, fromUserId, null, 
          `Sequence number too old: received ${sequenceNumber}, expected ${expectedSequence}`,
          { exchangeId, sequenceNumber, expectedSequence }
        );
        return {
          valid: false,
          reason: `Sequence number too old: received ${sequenceNumber}, expected ${expectedSequence}`
        };
      } else if (sequenceNumber > expectedSequence) {
        // Sequence number is in the future - might be out of order, but allow it
        // Update to the highest seen sequence
        if (isFromTo) {
          sequenceDoc.sequenceFromTo = sequenceNumber;
        } else {
          sequenceDoc.sequenceToFrom = sequenceNumber;
        }
      } else {
        // Perfect match - update sequence
        if (isFromTo) {
          sequenceDoc.sequenceFromTo = sequenceNumber;
        } else {
          sequenceDoc.sequenceToFrom = sequenceNumber;
        }
      }
    }

    // Validate nonce (must be unique)
    if (nonce) {
      const nonceExists = sequenceDoc.usedNonces.some(
        entry => entry.nonce === nonce
      );

      if (nonceExists) {
        // Nonce already used - replay attack
        const { ipAddress, userAgent } = extractRequestInfo(req);
        await logReplayAttack(req, fromUserId, null,
          `Duplicate nonce detected: ${nonce}`,
          { exchangeId, nonce }
        );
        return {
          valid: false,
          reason: `Duplicate nonce detected: ${nonce}`
        };
      }

      // Add nonce to used list
      sequenceDoc.usedNonces.push({
        nonce,
        timestamp: new Date(timestamp),
        createdAt: new Date()
      });
    }

    // Validate timestamp (must be within time window and not too old)
    if (timestamp) {
      const now = Date.now();
      const timeDiff = Math.abs(now - timestamp);

      if (timeDiff > TIMESTAMP_WINDOW) {
        // Timestamp is outside acceptable window
        await logInvalidRequest(req, 'INVALID_TIMESTAMP', fromUserId, null,
          `Timestamp outside acceptable window: diff=${timeDiff}ms, window=${TIMESTAMP_WINDOW}ms`,
          { exchangeId, timestamp, now, timeDiff }
        );
        return {
          valid: false,
          reason: `Timestamp outside acceptable window: ${timeDiff}ms difference`
        };
      }

      // Check for duplicate timestamps (within same second)
      const duplicateTimestamp = sequenceDoc.recentTimestamps.find(
        entry => Math.abs(entry.timestamp - timestamp) < 1000 // Within 1 second
      );

      if (duplicateTimestamp && nonce) {
        // Same timestamp + nonce combination might be a replay
        // But if nonce is different, it's probably just two messages in the same second
        // We already checked nonce above, so this is fine
      }

      // Add timestamp to recent list
      sequenceDoc.recentTimestamps.push({
        timestamp,
        createdAt: new Date()
      });
    }

    // Save updated sequence document
    sequenceDoc.lastUpdated = new Date();
    await sequenceDoc.save();

    return { valid: true };
  } catch (error) {
    console.error('Error in replay protection validation:', error);
    // On error, allow the request but log it
    return {
      valid: true, // Fail open for now, but log the error
      reason: `Validation error: ${error.message}`
    };
  }
}

/**
 * Middleware to validate replay protection for messages
 */
export async function validateMessageReplayProtection(req, res, next) {
  try {
    const { exchangeId, fromUserId, toUserId, sequenceNumber, nonce, timestamp } = req.body;

    // Only validate if exchangeId is provided (required for replay protection)
    if (!exchangeId) {
      // If no exchangeId, skip validation (might be a message without key exchange)
      return next();
    }

    // Validate replay protection
    const validation = await validateReplayProtection(
      exchangeId,
      fromUserId,
      toUserId,
      sequenceNumber,
      nonce,
      timestamp,
      req
    );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.reason || 'Replay protection validation failed'
      });
    }

    next();
  } catch (error) {
    console.error('Error in replay protection middleware:', error);
    // On error, allow the request but log it
    next();
  }
}


