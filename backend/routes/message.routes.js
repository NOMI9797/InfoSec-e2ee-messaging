import express from 'express';
import {
  sendMessage,
  getMessages,
  markAsRead,
  getUnreadCount,
  getMostRecentMessage
} from '../controllers/message.controller.js';

const router = express.Router();

// Send a message
router.post('/send', sendMessage);

// Get unread message count (must be before /:userId1/:userId2)
router.get('/unread/:userId', getUnreadCount);

// Get most recent message for a user (must be before /:userId1/:userId2)
router.get('/recent/:userId', getMostRecentMessage);

// Get messages between two users (must be last to avoid matching other routes)
router.get('/:userId1/:userId2', getMessages);

// Mark message as read
router.put('/:messageId/read', markAsRead);

export default router;

