import mongoose from 'mongoose';
import Message from '../models/Message.model.js';
import User from '../models/User.model.js';

/**
 * Send a message (encrypted on client side)
 * Server only stores ciphertext, IV, and tag
 */
export const sendMessage = async (req, res) => {
  try {
    const { fromUserId, toUserId, exchangeId, ciphertext, iv, tag, timestamp, messageType, fileName, fileSize, fileType } = req.body;

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

    // Create message (server cannot decrypt - only stores encrypted data)
    const message = new Message({
      fromUserId,
      toUserId,
      exchangeId: exchangeId || null, // Store exchangeId for reference
      ciphertext, // Encrypted message (base64)
      iv,         // Initialization vector (base64)
      tag,        // Authentication tag (base64)
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      messageType: messageType || 'text',
      fileName: fileName || null,
      fileSize: fileSize || null,
      fileType: fileType || null,
      status: 'sent'
    });

    await message.save();

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
    const { limit = 50, before } = req.query;

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

    // Build query
    const query = {
      $or: [
        { fromUserId: userId1, toUserId: userId2 },
        { fromUserId: userId2, toUserId: userId1 }
      ]
    };

    // Pagination: get messages before a certain timestamp
    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    // Fetch messages (most recent first)
    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .select('fromUserId toUserId ciphertext iv tag messageType timestamp fileName fileSize fileType status createdAt')
      .populate('fromUserId', 'username')
      .populate('toUserId', 'username');

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

