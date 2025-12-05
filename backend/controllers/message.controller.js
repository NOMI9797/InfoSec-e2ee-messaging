import mongoose from 'mongoose';
import Message from '../models/Message.model.js';
import User from '../models/User.model.js';
import { validateReplayProtection } from '../middleware/replayProtection.js';
import { logSecurityEvent, logDecryption, extractRequestInfo } from '../utils/securityLogger.js';

/**
 * Send a message (encrypted on client side)
 * Server only stores ciphertext, IV, and tag
 */
export const sendMessage = async (req, res) => {
  try {
    const { fromUserId, toUserId, exchangeId, ciphertext, iv, tag, timestamp, messageType, fileName, fileSize, fileType, totalChunks, sequenceNumber, nonce } = req.body;

    // Validation
    if (!fromUserId || !toUserId || !ciphertext || !iv || !tag) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fromUserId, toUserId, ciphertext, iv, tag'
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(fromUserId) || !mongoose.Types.ObjectId.isValid(toUserId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
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

    // Validate replay protection if exchangeId is provided
    if (exchangeId) {
      const validation = await validateReplayProtection(
        exchangeId,
        fromUserId,
        toUserId,
        sequenceNumber,
        nonce,
        timestamp || Date.now(),
        req
      );

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.reason || 'Replay protection validation failed'
        });
      }
    }

    // Create message (server cannot decrypt - only stores encrypted data)
    const message = new Message({
      fromUserId,
      toUserId,
      exchangeId: exchangeId || null, // Store exchangeId for reference
      ciphertext, // Encrypted message (base64) or JSON string of chunks for files
      iv,         // Initialization vector (base64)
      tag,        // Authentication tag (base64)
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      messageType: messageType || 'text',
      fileName: fileName || null,
      fileSize: fileSize || null,
      fileType: fileType || null,
      totalChunks: totalChunks || null,
      sequenceNumber: sequenceNumber || null,
      nonce: nonce || null,
      status: 'sent'
    });

    await message.save();

    // Log message sent
    await logSecurityEvent({
      eventType: 'MESSAGE_SENT',
      severity: 'INFO',
      userId: fromUserId,
      username: fromUser.username,
      ...extractRequestInfo(req),
      details: {
        messageId: message._id,
        exchangeId,
        messageType,
        toUserId: toUserId.toString()
      },
      success: true
    });

    res.status(201).json({
      success: true,
      message: {
        _id: message._id,
        fromUserId: message.fromUserId,
        toUserId: message.toUserId,
        messageType: message.messageType,
        timestamp: message.timestamp,
        status: message.status,
        createdAt: message.createdAt
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
};

/**
 * Get messages between two users
 * Returns encrypted messages (client will decrypt)
 */
export const getMessages = async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;
    const { limit = 50, before, currentUserId } = req.query;

    // Validation
    if (!userId1 || !userId2 || userId1 === 'undefined' || userId2 === 'undefined') {
      return res.status(400).json({
        success: false,
        error: 'Both userId1 and userId2 are required'
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId1) || !mongoose.Types.ObjectId.isValid(userId2)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    // Convert to ObjectId for proper querying
    const userId1Obj = new mongoose.Types.ObjectId(userId1);
    const userId2Obj = new mongoose.Types.ObjectId(userId2);

    // Build query
    const query = {
      $or: [
        { fromUserId: userId1Obj, toUserId: userId2Obj },
        { fromUserId: userId2Obj, toUserId: userId1Obj }
      ]
    };

    // Pagination: get messages before a certain timestamp
    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    // Debug logging
    console.log('Get Messages Debug:', {
      userId1: userId1,
      userId2: userId2,
      userId1Obj: userId1Obj.toString(),
      userId2Obj: userId2Obj.toString(),
      query
    });

    // Also check total messages in database for debugging
    const totalMessages = await Message.countDocuments({});
    const messagesForUser1 = await Message.countDocuments({ fromUserId: userId1Obj });
    const messagesForUser2 = await Message.countDocuments({ fromUserId: userId2Obj });
    console.log('Database Debug:', {
      totalMessages,
      messagesForUser1,
      messagesForUser2,
      queryResult: await Message.find(query).countDocuments()
    });

    // Fetch messages (most recent first)
    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .select('fromUserId toUserId exchangeId sequenceNumber nonce ciphertext iv tag messageType timestamp fileName fileSize fileType status createdAt')
      .populate('fromUserId', 'username')
      .populate('toUserId', 'username');

    // Log message retrieval (MESSAGE_RECEIVED) for the current user
    if (currentUserId && mongoose.Types.ObjectId.isValid(currentUserId)) {
      const receivingUser = await User.findById(currentUserId);
      if (receivingUser && messages.length > 0) {
        // Determine the other user in the conversation
        const otherUserId = String(currentUserId) === String(userId1) ? userId2 : userId1;
        const otherUser = await User.findById(otherUserId);
        
        await logSecurityEvent({
          eventType: 'MESSAGE_RECEIVED',
          severity: 'INFO',
          userId: currentUserId,
          username: receivingUser.username,
          ...extractRequestInfo(req),
          details: {
            messageCount: messages.length,
            otherUserId: otherUserId.toString(),
            otherUsername: otherUser?.username || 'Unknown'
          },
          success: true
        });
      }
    }

    // Debug: Log message count
    console.log('Get Messages Result:', {
      messagesFound: messages.length,
      messagesWithReplayFields: messages.filter(m => m.exchangeId && m.sequenceNumber && m.nonce).length
    });

    res.json({
      success: true,
      messages: messages.reverse() // Return in chronological order (oldest first)
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve messages'
    });
  }
};

/**
 * Mark message as read
 */
export const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Only the recipient can mark as read
    if (message.toUserId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the recipient can mark message as read'
      });
    }

    message.status = 'read';
    message.readAt = new Date();
    await message.save();

    res.json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark message as read'
    });
  }
};

/**
 * Get unread message count for a user
 */
export const getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.params;

    const count = await Message.countDocuments({
      toUserId: userId,
      status: { $in: ['sent', 'delivered'] }
    });

    res.json({
      success: true,
      unreadCount: count
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count'
    });
  }
};

/**
 * Get the most recent message for a user
 * Returns the message and the other user's ID
 */
export const getMostRecentMessage = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || userId === 'undefined') {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);

    // Find the most recent message where user is either sender or receiver
    const mostRecentMessage = await Message.findOne({
      $or: [
        { fromUserId: userIdObj },
        { toUserId: userIdObj }
      ]
    })
      .sort({ timestamp: -1 })
      .select('fromUserId toUserId exchangeId sequenceNumber nonce timestamp')
      .populate('fromUserId', 'username _id')
      .populate('toUserId', 'username _id');

    if (!mostRecentMessage) {
      return res.json({
        success: true,
        message: null,
        otherUser: null
      });
    }

    // Determine the other user
    const otherUserId = String(mostRecentMessage.fromUserId._id) === String(userId)
      ? mostRecentMessage.toUserId
      : mostRecentMessage.fromUserId;

    res.json({
      success: true,
      message: mostRecentMessage,
      otherUser: {
        _id: otherUserId._id,
        username: otherUserId.username
      }
    });
  } catch (error) {
    console.error('Get most recent message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get most recent message'
    });
  }
};

