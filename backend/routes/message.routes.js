import express from 'express';
import {
  sendMessage,
  getMessages,
  markAsRead,
  getUnreadCount
} from '../controllers/message.controller.js';

const router = express.Router();

// Send a message
router.post('/send', sendMessage);

// Get messages between two users
router.get('/:userId1/:userId2', getMessages);

// Mark message as read
router.put('/:messageId/read', markAsRead);

// Get unread message count
router.get('/unread/:userId', getUnreadCount);

export default router;

