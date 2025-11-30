import KeyExchange from '../models/KeyExchange.model.js';
import User from '../models/User.model.js';
import { randomUUID } from 'crypto';

// Initiate key exchange
export const initiateKeyExchange = async (req, res) => {
  try {
    const { fromUserId, toUserId, ephemeralPublicKey, timestamp, nonce, signature } = req.body;

    // Validation
    if (!fromUserId || !toUserId || !ephemeralPublicKey || !signature || !nonce) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Verify users exist
    const fromUser = await User.findById(fromUserId);
    const toUser = await User.findById(toUserId);

    if (!fromUser || !toUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Generate unique exchange ID
    const exchangeId = randomUUID();

    // Create key exchange record
    const keyExchange = new KeyExchange({
      exchangeId,
      fromUserId,
      toUserId,
      initiatorEphemeralPublicKey: ephemeralPublicKey,
      initiatorSignature: signature,
      nonce,
      timestamp: timestamp || Date.now(),
      status: 'pending'
    });

    await keyExchange.save();

    res.status(201).json({
      success: true,
      exchangeId,
      message: 'Key exchange initiated'
    });
  } catch (error) {
    console.error('Key exchange initiation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate key exchange'
    });
  }
};

// Respond to key exchange
export const respondToKeyExchange = async (req, res) => {
  try {
    const { exchangeId, ephemeralPublicKey, keyConfirmation, timestamp, nonce, signature } = req.body;

    // Validation
    if (!exchangeId || !ephemeralPublicKey || !keyConfirmation || !signature || !nonce) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Find key exchange
    const keyExchange = await KeyExchange.findOne({ exchangeId });

    if (!keyExchange) {
      return res.status(404).json({
        success: false,
        error: 'Key exchange not found'
      });
    }

    if (keyExchange.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Key exchange already processed'
      });
    }

    // Update key exchange
    keyExchange.responderEphemeralPublicKey = ephemeralPublicKey;
    keyExchange.responderSignature = signature;
    keyExchange.keyConfirmation = keyConfirmation;
    keyExchange.responseNonce = nonce; // Store response nonce for key derivation
    keyExchange.responseTimestamp = timestamp || Date.now(); // Store response timestamp for signature verification
    keyExchange.status = 'responded';

    await keyExchange.save();

    // Get initiator's public key for client
    const fromUser = await User.findById(keyExchange.fromUserId).select('publicKey username');

    res.json({
      success: true,
      message: 'Key exchange response sent',
      keyExchange: {
        exchangeId: keyExchange.exchangeId,
        fromUserId: keyExchange.fromUserId,
        toUserId: keyExchange.toUserId,
        initiatorEphemeralPublicKey: keyExchange.initiatorEphemeralPublicKey,
        initiatorPublicKey: fromUser.publicKey,
        initiatorSignature: keyExchange.initiatorSignature,
        nonce: keyExchange.nonce,
        timestamp: keyExchange.timestamp
      }
    });
  } catch (error) {
    console.error('Key exchange response error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to respond to key exchange'
    });
  }
};

// Confirm key exchange
export const confirmKeyExchange = async (req, res) => {
  try {
    const { exchangeId, confirmed } = req.body;

    if (!exchangeId) {
      return res.status(400).json({
        success: false,
        error: 'Exchange ID required'
      });
    }

    const keyExchange = await KeyExchange.findOne({ exchangeId });

    if (!keyExchange) {
      return res.status(404).json({
        success: false,
        error: 'Key exchange not found'
      });
    }

    if (keyExchange.status !== 'responded') {
      return res.status(400).json({
        success: false,
        error: 'Invalid key exchange status'
      });
    }

    keyExchange.status = 'confirmed';
    keyExchange.confirmed = confirmed || true;
    keyExchange.completedAt = new Date();

    await keyExchange.save();

    res.json({
      success: true,
      message: 'Key exchange confirmed'
    });
  } catch (error) {
    console.error('Key exchange confirmation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm key exchange'
    });
  }
};

// Get pending key exchanges for a user
export const getPendingExchanges = async (req, res) => {
  try {
    const { userId } = req.params;

    const pendingExchanges = await KeyExchange.find({
      toUserId: userId,
      status: 'pending'
    }).populate('fromUserId', 'username publicKey').sort({ createdAt: -1 });

    res.json({
      success: true,
      exchanges: pendingExchanges
    });
  } catch (error) {
    console.error('Get pending exchanges error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve pending exchanges'
    });
  }
};

// Get key exchange by ID
export const getKeyExchange = async (req, res) => {
  try {
    const { exchangeId } = req.params;

    const keyExchange = await KeyExchange.findOne({ exchangeId })
      .populate('fromUserId', 'username publicKey')
      .populate('toUserId', 'username publicKey');

    if (!keyExchange) {
      return res.status(404).json({
        success: false,
        error: 'Key exchange not found'
      });
    }

    res.json({
      success: true,
      keyExchange
    });
  } catch (error) {
    console.error('Get key exchange error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve key exchange'
    });
  }
};

// Get completed key exchanges for a user (both as initiator and responder)
export const getCompletedExchanges = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find exchanges where user is either initiator or responder and status is confirmed/completed
    const exchanges = await KeyExchange.find({
      $or: [
        { fromUserId: userId },
        { toUserId: userId }
      ],
      status: { $in: ['confirmed', 'completed', 'responded'] }
    })
      .populate('fromUserId', 'username _id')
      .populate('toUserId', 'username _id')
      .sort({ completedAt: -1, createdAt: -1 })
      .select('exchangeId fromUserId toUserId status confirmed completedAt createdAt');

    res.json({
      success: true,
      exchanges
    });
  } catch (error) {
    console.error('Get completed exchanges error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve completed exchanges'
    });
  }
};

