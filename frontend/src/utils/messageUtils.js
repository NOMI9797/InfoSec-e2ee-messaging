/**
 * Message encryption/decryption utilities
 * Handles E2EE message operations
 */

import { encryptMessage, decryptMessage, encryptFile, decryptFile } from './crypto.js';
import { getSessionKey } from './keyStorage.js';
import { getNextSequenceNumber, generateNonce } from './sequenceManager.js';
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
    
    // Get sequence number and generate nonce for replay protection
    const sequenceNumber = await getNextSequenceNumber(exchangeId, fromUserId, toUserId);
    const nonce = generateNonce();
    const timestamp = Date.now();
    
    // Send encrypted message to server
    const response = await api.post('/messages/send', {
      fromUserId,
      toUserId,
      exchangeId,
      ciphertext,
      iv,
      tag,
      timestamp,
      messageType: 'text',
      sequenceNumber,
      nonce
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
    
    // Get encrypted messages from server (pass currentUserId to log MESSAGE_RECEIVED)
    const response = await api.get(`/messages/${userId1}/${userId2}`, {
      params: { currentUserId }
    });
    const encryptedMessages = response.data.messages;
    
    // Decrypt each message
    const decryptedMessages = await Promise.all(
      encryptedMessages.map(async (msg) => {
        // Skip decryption for file messages (they're decrypted on download)
        if (msg.messageType === 'file') {
          return {
            ...msg,
            plaintext: `📎 ${msg.fileName || 'File'}`,
            isOwn: msg.fromUserId._id === currentUserId || msg.fromUserId === currentUserId
          };
        }
        
        // Decrypt text messages
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
          
          // Log decryption failure (client-side logging)
          try {
            await api.post('/security-logs', {
              eventType: 'DECRYPTION_FAILURE',
              severity: 'WARNING',
              userId: currentUserId,
              details: {
                messageId: msg._id,
                exchangeId,
                error: error.message
              },
              success: false,
              errorMessage: error.message
            });
          } catch (logError) {
            console.error('Failed to log decryption error:', logError);
          }
          
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

/**
 * Send an encrypted file
 * @param {string} fromUserId - Sender's user ID
 * @param {string} toUserId - Recipient's user ID
 * @param {File} file - File to encrypt and send
 * @param {string} exchangeId - Key exchange ID (used to retrieve session key)
 * @param {Function} progressCallback - Optional callback for upload progress
 * @returns {Promise<Object>} Sent message response
 */
export async function sendEncryptedFile(fromUserId, toUserId, file, exchangeId, progressCallback) {
  try {
    // Retrieve session key from IndexedDB
    const sessionKey = await getSessionKey(exchangeId);
    
    // Encrypt the file (with chunking)
    const { chunks, fileName, fileType, fileSize, totalChunks } = await encryptFile(file, sessionKey);
    
    // Report progress
    if (progressCallback) {
      progressCallback(50); // Encryption complete
    }
    
    // Get sequence number and generate nonce for replay protection
    const sequenceNumber = await getNextSequenceNumber(exchangeId, fromUserId, toUserId);
    const nonce = generateNonce();
    const timestamp = Date.now();
    
    // Send encrypted file to server
    const response = await api.post('/messages/send', {
      fromUserId,
      toUserId,
      exchangeId,
      ciphertext: JSON.stringify(chunks), // Store chunks as JSON string
      iv: chunks[0]?.iv || '', // First chunk's IV (for compatibility)
      tag: chunks[0]?.tag || '', // First chunk's tag (for compatibility)
      timestamp,
      messageType: 'file',
      fileName,
      fileType,
      fileSize,
      totalChunks,
      sequenceNumber,
      nonce
    });
    
    // Report progress
    if (progressCallback) {
      progressCallback(100); // Upload complete
    }
    
    return response.data;
  } catch (error) {
    console.error('Error sending encrypted file:', error);
    throw error;
  }
}

/**
 * Get and decrypt a file message
 * @param {Object} message - Message object containing encrypted file data
 * @param {string} exchangeId - Key exchange ID (used to retrieve session key)
 * @returns {Promise<Blob>} Decrypted file as Blob
 */
export async function getAndDecryptFile(message, exchangeId) {
  try {
    // Retrieve session key from IndexedDB
    const sessionKey = await getSessionKey(exchangeId);
    
    // Parse chunks from ciphertext
    let chunks;
    if (typeof message.ciphertext === 'string') {
      try {
        chunks = JSON.parse(message.ciphertext);
      } catch (e) {
        // If parsing fails, assume it's a single chunk (backward compatibility)
        chunks = [{
          chunkIndex: 0,
          ciphertext: message.ciphertext,
          iv: message.iv,
          tag: message.tag
        }];
      }
    } else {
      chunks = message.ciphertext;
    }
    
    // Decrypt the file
    const decryptedBlob = await decryptFile(
      chunks,
      sessionKey,
      message.fileName || 'file',
      message.fileType || 'application/octet-stream'
    );
    
    return decryptedBlob;
  } catch (error) {
    console.error('Error getting and decrypting file:', error);
    throw error;
  }
}

/**
 * Download a file blob
 * @param {Blob} blob - File blob to download
 * @param {string} fileName - Name for the downloaded file
 */
export function downloadFile(blob, fileName) {
  try {
    // Create a temporary URL for the blob
    const url = window.URL.createObjectURL(blob);
    
    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'download';
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}

