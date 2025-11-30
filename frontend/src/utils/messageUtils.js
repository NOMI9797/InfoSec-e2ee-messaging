/**
 * Message encryption/decryption utilities
 * Handles E2EE message operations
 */

import { encryptMessage, decryptMessage } from './crypto.js';
import { getSessionKey } from './keyStorage.js';
import api from '../services/api.js';

/**
 * Send an encrypted message
 * @param {string} fromUserId - Sender's user ID
 * @param {string} toUserId - Recipient's user ID
 * @param {string} plaintext - Message to encrypt and send
 * @param {string} exchangeId - Key exchange ID (used to retrieve session key)
 * @returns {Promise<Object>} Sent message response
 */
export async function sendEncryptedMessage(fromUserId, toUserId, plaintext, exchangeId) {
  try {
    // Retrieve session key from IndexedDB
    const sessionKey = await getSessionKey(exchangeId);
    
    // Encrypt the message
    const { ciphertext, iv, tag } = await encryptMessage(plaintext, sessionKey);
    
    // Send encrypted message to server
    const response = await api.post('/messages/send', {
      fromUserId,
      toUserId,
      exchangeId,
      ciphertext,
      iv,
      tag,
      timestamp: Date.now(),
      messageType: 'text'
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending encrypted message:', error);
    throw error;
  }
}

/**
 * Get and decrypt messages between two users
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @param {string} exchangeId - Key exchange ID (used to retrieve session key)
 * @param {string} currentUserId - Current user's ID (to determine if message is incoming or outgoing)
 * @returns {Promise<Array>} Array of decrypted messages
 */
export async function getAndDecryptMessages(userId1, userId2, exchangeId, currentUserId) {
  try {
    // Retrieve session key from IndexedDB
    const sessionKey = await getSessionKey(exchangeId);
    
    // Get encrypted messages from server
    const response = await api.get(`/messages/${userId1}/${userId2}`);
    const encryptedMessages = response.data.messages;
    
    // Decrypt each message
    const decryptedMessages = await Promise.all(
      encryptedMessages.map(async (msg) => {
        try {
          const plaintext = await decryptMessage(
            msg.ciphertext,
            msg.iv,
            msg.tag,
            sessionKey
          );
          
          return {
            ...msg,
            plaintext, // Add decrypted text
            isOwn: msg.fromUserId._id === currentUserId || msg.fromUserId === currentUserId
          };
        } catch (error) {
          console.error('Error decrypting message:', error);
          return {
            ...msg,
            plaintext: '[Unable to decrypt message]',
            isOwn: msg.fromUserId._id === currentUserId || msg.fromUserId === currentUserId,
            decryptionError: true
          };
        }
      })
    );
    
    return decryptedMessages;
  } catch (error) {
    console.error('Error getting and decrypting messages:', error);
    throw error;
  }
}

/**
 * Mark message as read
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID marking as read
 */
export async function markMessageAsRead(messageId, userId) {
  try {
    await api.put(`/messages/${messageId}/read`, { userId });
  } catch (error) {
    console.error('Error marking message as read:', error);
    throw error;
  }
}

