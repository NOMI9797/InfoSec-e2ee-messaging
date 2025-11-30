/**
 * Key Exchange Protocol Implementation
 * ECDH-based key exchange with digital signatures
 */

import { 
  generateECCKeyPair, 
  exportPublicKey, 
  importPublicKey,
  importPrivateKey
} from './crypto.js';
import { 
  getPrivateKey,
  storeEphemeralKeyPair,
  getEphemeralKeyPair,
  storeSessionKey
} from './keyStorage.js';
import api from '../services/api.js';

/**
 * Derive shared secret using ECDH
 * @param {CryptoKey} privateKey - Our ECDH private key
 * @param {CryptoKey} publicKey - Other party's ECDH public key
 * @returns {Promise<ArrayBuffer>} Shared secret
 */
export async function deriveSharedSecret(privateKey, publicKey) {
  try {
    const sharedSecret = await window.crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: publicKey
      },
      privateKey,
      256 // 256 bits = 32 bytes
    );
    return sharedSecret;
  } catch (error) {
    console.error('Error deriving shared secret:', error);
    throw error;
  }
}

/**
 * Derive session key using HKDF
 * @param {ArrayBuffer} sharedSecret - ECDH shared secret
 * @param {string} fromUserId - Sender user ID
 * @param {string} toUserId - Receiver user ID
 * @param {string} nonce - Random nonce
 * @returns {Promise<CryptoKey>} Derived session key
 */
export async function deriveSessionKey(sharedSecret, fromUserId, toUserId, nonce) {
  try {
    // Import shared secret as a key for HKDF
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      sharedSecret,
      'HKDF',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Create info parameter: "E2EE-SessionKey" + user IDs + nonce
    const info = new TextEncoder().encode(
      `E2EE-SessionKey-${fromUserId}-${toUserId}-${nonce}`
    );

    // Derive session key using HKDF
    const sessionKey = await window.crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(0), // No salt for simplicity (can be improved)
        info: info
      },
      baseKey,
      {
        name: 'AES-GCM',
        length: 256
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );

    return sessionKey;
  } catch (error) {
    console.error('Error deriving session key:', error);
    throw error;
  }
}

/**
 * Generate random nonce
 * @param {number} length - Nonce length in bytes (default: 16)
 * @returns {string} Base64-encoded nonce
 */
export function generateNonce(length = 16) {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

/**
 * Import RSA private key for signing (RSA-PSS)
 * @param {string} base64Key - Base64-encoded PKCS#8 format private key
 * @returns {Promise<CryptoKey>} Imported private key for signing
 */
async function importRSASigningKey(base64Key) {
  try {
    const binaryString = atob(base64Key);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Import the same key material but with RSA-PSS algorithm for signing
    const privateKey = await window.crypto.subtle.importKey(
      'pkcs8',
      bytes,
      {
        name: 'RSA-PSS',
        hash: 'SHA-256',
      },
      true,
      ['sign']
    );

    return privateKey;
  } catch (error) {
    console.error('Error importing RSA signing key:', error);
    throw error;
  }
}

/**
 * Import RSA public key for verification (RSA-PSS)
 * @param {string} base64Key - Base64-encoded SPKI format public key
 * @returns {Promise<CryptoKey>} Imported public key for verification
 */
async function importRSAVerificationKey(base64Key) {
  try {
    const binaryString = atob(base64Key);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Import the same key material but with RSA-PSS algorithm for verification
    const publicKey = await window.crypto.subtle.importKey(
      'spki',
      bytes,
      {
        name: 'RSA-PSS',
        hash: 'SHA-256',
      },
      true,
      ['verify']
    );

    return publicKey;
  } catch (error) {
    console.error('Error importing RSA verification key:', error);
    throw error;
  }
}

/**
 * Sign a message using RSA private key
 * @param {string} message - Message to sign (JSON string)
 * @param {string} username - Username to get private key
 * @returns {Promise<string>} Base64-encoded signature
 */
export async function signMessage(message, username) {
  try {
    // Get user's private key from storage
    const keyData = await getPrivateKey(username);
    
    // Import key for signing (RSA-PSS)
    const privateKey = await importRSASigningKey(keyData.privateKey);

    // Convert message to ArrayBuffer
    const messageBuffer = new TextEncoder().encode(message);

    // Sign the message
    const signature = await window.crypto.subtle.sign(
      {
        name: 'RSA-PSS',
        saltLength: 32
      },
      privateKey,
      messageBuffer
    );

    // Convert to base64
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  } catch (error) {
    console.error('Error signing message:', error);
    throw error;
  }
}

/**
 * Verify a digital signature
 * @param {string} message - Original message
 * @param {string} signature - Base64-encoded signature
 * @param {string} publicKeyBase64 - Sender's public key (SPKI format)
 * @returns {Promise<boolean>} True if signature is valid
 */
export async function verifySignature(message, signature, publicKeyBase64) {
  try {
    // Import public key for verification (RSA-PSS)
    const publicKey = await importRSAVerificationKey(publicKeyBase64);

    // Convert message and signature to ArrayBuffer
    const messageBuffer = new TextEncoder().encode(message);
    const signatureBuffer = Uint8Array.from(atob(signature), c => c.charCodeAt(0));

    // Verify signature
    const isValid = await window.crypto.subtle.verify(
      {
        name: 'RSA-PSS',
        saltLength: 32
      },
      publicKey,
      signatureBuffer,
      messageBuffer
    );

    return isValid;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

/**
 * Create HMAC for key confirmation
 * @param {CryptoKey} sessionKey - Session key
 * @param {string} nonce - Nonce to include in HMAC
 * @returns {Promise<string>} Base64-encoded HMAC
 */
export async function createKeyConfirmation(sessionKey, nonce) {
  try {
    // Import session key for HMAC (we'll use AES key material)
    // For key confirmation, we'll derive an HMAC key from the session key
    const hmacKey = await window.crypto.subtle.importKey(
      'raw',
      await window.crypto.subtle.exportKey('raw', sessionKey),
      {
        name: 'HMAC',
        hash: 'SHA-256'
      },
      false,
      ['sign']
    );

    // Create HMAC
    const message = new TextEncoder().encode(`KeyConfirmation-${nonce}`);
    const hmac = await window.crypto.subtle.sign(
      'HMAC',
      hmacKey,
      message
    );

    return btoa(String.fromCharCode(...new Uint8Array(hmac)));
  } catch (error) {
    console.error('Error creating key confirmation:', error);
    throw error;
  }
}

/**
 * Verify key confirmation HMAC
 * @param {CryptoKey} sessionKey - Session key
 * @param {string} nonce - Nonce used in HMAC
 * @param {string} hmac - Base64-encoded HMAC to verify
 * @returns {Promise<boolean>} True if HMAC is valid
 */
export async function verifyKeyConfirmation(sessionKey, nonce, hmac) {
  try {
    const expectedHmac = await createKeyConfirmation(sessionKey, nonce);
    return hmac === expectedHmac;
  } catch (error) {
    console.error('Error verifying key confirmation:', error);
    return false;
  }
}

/**
 * Initiate key exchange with another user
 * @param {string} fromUserId - Our user ID
 * @param {string} toUserId - Target user ID
 * @param {string} username - Our username (for signing)
 * @returns {Promise<Object>} Key exchange initiation response
 */
export async function initiateKeyExchange(fromUserId, toUserId, username) {
  try {
    // Generate ephemeral ECDH key pair
    const ephemeralKeyPair = await generateECCKeyPair('P-256');
    const ephemeralPublicKey = await exportPublicKey(ephemeralKeyPair.publicKey);

    // Generate nonce
    const nonce = generateNonce();

    // Create initiation message (order matters for signature verification)
    const timestamp = Date.now();
    const message = {
      ephemeralPublicKey,
      fromUserId,
      nonce,
      timestamp,
      toUserId
    };

    // Sign the message (use sorted keys for consistency)
    const messageString = JSON.stringify(message, Object.keys(message).sort());
    const signature = await signMessage(messageString, username);

    // Send to server
    const response = await api.post('/key-exchange/initiate', {
      ...message,
      signature
    });

    // Store ephemeral key pair in IndexedDB for later use during completion
    await storeEphemeralKeyPair(response.data.exchangeId, ephemeralKeyPair);

    return {
      exchangeId: response.data.exchangeId,
      ephemeralKeyPair, // Also return for immediate use if needed
      nonce
    };
  } catch (error) {
    console.error('Error initiating key exchange:', error);
    throw error;
  }
}

/**
 * Respond to a key exchange initiation
 * @param {string} exchangeId - Key exchange ID
 * @param {string} fromUserId - Initiator's user ID
 * @param {string} toUserId - Our user ID
 * @param {string} username - Our username (for signing)
 * @param {string} initiatorPublicKey - Initiator's ECDH public key
 * @param {string} initiatorSignature - Initiator's signature
 * @param {string} initiatorRSAKey - Initiator's RSA public key (for verification)
 * @param {number} timestamp - Original timestamp from initiation (required for signature verification)
 * @param {string} nonce - Original nonce from initiation (required for signature verification)
 * @returns {Promise<Object>} Response with session key
 */
export async function respondToKeyExchange(
  exchangeId,
  fromUserId,
  toUserId,
  username,
  initiatorPublicKey,
  initiatorSignature,
  initiatorRSAKey,
  timestamp,
  nonce
) {
  try {
    // Verify initiator's signature using the EXACT message that was signed
    // Order must match the initiation message format
    const initMessage = {
      ephemeralPublicKey: initiatorPublicKey,
      fromUserId,
      nonce: nonce, // Use the actual nonce from initiation
      timestamp: timestamp, // Use the actual timestamp from initiation
      toUserId
    };
    
    // Stringify with sorted keys to ensure consistent format (must match initiation)
    const messageString = JSON.stringify(initMessage, Object.keys(initMessage).sort());
    
    const isValid = await verifySignature(
      messageString,
      initiatorSignature,
      initiatorRSAKey
    );

    if (!isValid) {
      console.error('Signature verification failed. Message:', messageString);
      console.error('Signature:', initiatorSignature);
      throw new Error('Invalid signature from initiator');
    }

    // Generate our ephemeral ECDH key pair
    const ephemeralKeyPair = await generateECCKeyPair('P-256');
    const ephemeralPublicKey = await exportPublicKey(ephemeralKeyPair.publicKey);

    // Import initiator's public key
    const initiatorECDHKey = await importPublicKey(initiatorPublicKey, 'ECDH', 'P-256');

    // Derive shared secret
    const sharedSecret = await deriveSharedSecret(ephemeralKeyPair.privateKey, initiatorECDHKey);

    // Generate nonce for response (different from initiation nonce)
    const responseNonce = generateNonce();

    // Derive session key
    const sessionKey = await deriveSessionKey(sharedSecret, fromUserId, toUserId, responseNonce);

    // Create key confirmation
    const keyConfirmation = await createKeyConfirmation(sessionKey, responseNonce);

    // Create response message
    const responseMessage = {
      exchangeId,
      ephemeralPublicKey,
      keyConfirmation,
      timestamp: Date.now(),
      nonce: responseNonce
    };

    // Sign the response (use sorted keys for consistency)
    const responseMessageString = JSON.stringify(responseMessage, Object.keys(responseMessage).sort());
    const signature = await signMessage(responseMessageString, username);

    // Send to server
    await api.post('/key-exchange/respond', {
      ...responseMessage,
      signature
    });

    // Store session key
    await storeSessionKey(exchangeId, sessionKey, fromUserId);

    return {
      sessionKey,
      exchangeId
    };
  } catch (error) {
    console.error('Error responding to key exchange:', error);
    throw error;
  }
}

/**
 * Complete key exchange (initiator's side after receiving response)
 * @param {string} exchangeId - Key exchange ID
 * @param {string} fromUserId - Our user ID
 * @param {string} toUserId - Responder's user ID
 * @param {CryptoKeyPair} ephemeralKeyPair - Our ephemeral key pair (from initiation)
 * @param {string} responderPublicKey - Responder's ECDH public key
 * @param {string} keyConfirmation - Responder's key confirmation HMAC
 * @param {string} nonce - Nonce from response
 * @param {string} responderSignature - Responder's signature
 * @param {string} responderRSAKey - Responder's RSA public key
 * @returns {Promise<CryptoKey>} Session key
 */
export async function completeKeyExchange(
  exchangeId,
  fromUserId,
  toUserId,
  responderPublicKey,
  keyConfirmation,
  nonce,
  responderSignature,
  responderRSAKey,
  responseTimestamp
) {
  try {
    // Retrieve ephemeral key pair from storage
    const ephemeralKeyPair = await getEphemeralKeyPair(exchangeId);

    // Verify responder's signature using the EXACT message that was signed
    // Order must match the response message format
    const responseMessage = {
      exchangeId,
      ephemeralPublicKey: responderPublicKey,
      keyConfirmation,
      timestamp: responseTimestamp, // Use the original timestamp from response
      nonce
    };

    // Stringify with sorted keys to ensure consistent format (must match response)
    const messageString = JSON.stringify(responseMessage, Object.keys(responseMessage).sort());

    const isValid = await verifySignature(
      messageString,
      responderSignature,
      responderRSAKey
    );

    if (!isValid) {
      throw new Error('Invalid signature from responder');
    }

    // Import responder's public key
    const responderECDHKey = await importPublicKey(responderPublicKey, 'ECDH', 'P-256');

    // Derive shared secret
    const sharedSecret = await deriveSharedSecret(ephemeralKeyPair.privateKey, responderECDHKey);

    // Derive session key
    const sessionKey = await deriveSessionKey(sharedSecret, fromUserId, toUserId, nonce);

    // Verify key confirmation
    const confirmationValid = await verifyKeyConfirmation(sessionKey, nonce, keyConfirmation);
    if (!confirmationValid) {
      throw new Error('Key confirmation failed');
    }

    // Store session key
    await storeSessionKey(exchangeId, sessionKey, toUserId);

    // Send confirmation to server
    await api.post('/key-exchange/confirm', {
      exchangeId,
      confirmed: true
    });

    return sessionKey;
  } catch (error) {
    console.error('Error completing key exchange:', error);
    throw error;
  }
}

