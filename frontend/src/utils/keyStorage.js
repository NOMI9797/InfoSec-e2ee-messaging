/**
 * Secure key storage using IndexedDB
 * Stores private keys encrypted with user password
 */

const DB_NAME = 'E2EEKeyStorage';
const DB_VERSION = 2; // Incremented to add session keys store
const STORE_NAME = 'privateKeys';
const SESSION_STORE_NAME = 'sessionKeys';

/**
 * Open IndexedDB database
 * @returns {Promise<IDBDatabase>} Database instance
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'username' });
        objectStore.createIndex('username', 'username', { unique: true });
      }
      if (!db.objectStoreNames.contains(SESSION_STORE_NAME)) {
        const sessionStore = db.createObjectStore(SESSION_STORE_NAME, { keyPath: 'sessionId' });
        sessionStore.createIndex('userId', 'userId', { unique: false });
        sessionStore.createIndex('expiresAt', 'expiresAt', { unique: false });
      }
    };
  });
}

/**
 * Store private key for a user
 * @param {string} username - Username
 * @param {string} privateKeyBase64 - Base64-encoded private key
 * @param {string} algorithm - Algorithm type: 'RSA-OAEP' or 'ECDH'
 * @param {string} keySize - Key size or curve name
 * @returns {Promise<void>}
 */
export async function storePrivateKey(username, privateKeyBase64, algorithm, keySize) {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const keyData = {
      username: username,
      privateKey: privateKeyBase64,
      algorithm: algorithm,
      keySize: keySize,
      createdAt: new Date().toISOString()
    };

    await new Promise((resolve, reject) => {
      const request = store.put(keyData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log('Private key stored successfully for:', username);
  } catch (error) {
    console.error('Error storing private key:', error);
    throw error;
  }
}

/**
 * Retrieve private key for a user
 * @param {string} username - Username
 * @returns {Promise<{privateKey: string, algorithm: string, keySize: string}>}
 */
export async function getPrivateKey(username) {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(username);
      request.onsuccess = () => {
        if (request.result) {
          resolve({
            privateKey: request.result.privateKey,
            algorithm: request.result.algorithm,
            keySize: request.result.keySize
          });
        } else {
          reject(new Error('Private key not found for user: ' + username));
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error retrieving private key:', error);
    throw error;
  }
}

/**
 * Check if private key exists for a user
 * @param {string} username - Username
 * @returns {Promise<boolean>}
 */
export async function hasPrivateKey(username) {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(username);
      request.onsuccess = () => {
        resolve(request.result !== undefined);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error checking private key:', error);
    return false;
  }
}

/**
 * Delete private key for a user (logout)
 * @param {string} username - Username
 * @returns {Promise<void>}
 */
export async function deletePrivateKey(username) {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise((resolve, reject) => {
      const request = store.delete(username);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log('Private key deleted for:', username);
  } catch (error) {
    console.error('Error deleting private key:', error);
    throw error;
  }
}

/**
 * Clear all stored keys (use with caution)
 * @returns {Promise<void>}
 */
export async function clearAllKeys() {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log('All keys cleared');
  } catch (error) {
    console.error('Error clearing keys:', error);
    throw error;
  }
}

/**
 * Store session key
 * @param {string} sessionId - Session ID (exchangeId or combination of user IDs)
 * @param {CryptoKey} sessionKey - Session key (CryptoKey object)
 * @param {string} userId - Other user's ID
 * @param {number} expiresInHours - Expiration in hours (default: 24)
 * @returns {Promise<void>}
 */

/**
 * Store session key
 * @param {string} sessionId - Session ID (exchangeId or combination of user IDs)
 * @param {CryptoKey} sessionKey - Session key (CryptoKey object)
 * @param {string} userId - Other user's ID
 * @param {number} expiresInHours - Expiration in hours (default: 24)
 * @returns {Promise<void>}
 */
export async function storeSessionKey(sessionId, sessionKey, userId, expiresInHours = 24) {
  try {
    const db = await openDB();
    const transaction = db.transaction([SESSION_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(SESSION_STORE_NAME);

    // Export session key to store it
    const exported = await window.crypto.subtle.exportKey('raw', sessionKey);
    const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exported)));

    const sessionData = {
      sessionId: sessionId,
      userId: userId,
      sessionKey: keyBase64,
      algorithm: 'AES-GCM',
      keyLength: 256,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
    };

    await new Promise((resolve, reject) => {
      const request = store.put(sessionData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log('Session key stored:', sessionId);
  } catch (error) {
    console.error('Error storing session key:', error);
    throw error;
  }
}

/**
 * Retrieve session key
 * @param {string} sessionId - Session ID
 * @returns {Promise<CryptoKey>} Session key
 */
export async function getSessionKey(sessionId) {
  try {
    const db = await openDB();
    const transaction = db.transaction([SESSION_STORE_NAME], 'readonly');
    const store = transaction.objectStore(SESSION_STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(sessionId);
      request.onsuccess = async () => {
        if (!request.result) {
          reject(new Error('Session key not found'));
          return;
        }

        const sessionData = request.result;

        // Check expiration
        if (new Date(sessionData.expiresAt) < new Date()) {
          // Delete expired key
          const deleteTransaction = db.transaction([SESSION_STORE_NAME], 'readwrite');
          const deleteStore = deleteTransaction.objectStore(SESSION_STORE_NAME);
          deleteStore.delete(sessionId);
          reject(new Error('Session key expired'));
          return;
        }

        // Import session key
        const binaryString = atob(sessionData.sessionKey);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const sessionKey = await window.crypto.subtle.importKey(
          'raw',
          bytes,
          {
            name: 'AES-GCM',
            length: 256
          },
          true,
          ['encrypt', 'decrypt']
        );

        resolve(sessionKey);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error retrieving session key:', error);
    throw error;
  }
}

/**
 * Store ephemeral ECDH key pair for key exchange
 * @param {string} exchangeId - Exchange ID
 * @param {CryptoKeyPair} ephemeralKeyPair - Ephemeral ECDH key pair
 * @returns {Promise<void>}
 */
export async function storeEphemeralKeyPair(exchangeId, ephemeralKeyPair) {
  try {
    const { exportPrivateKey, exportPublicKey } = await import('./crypto.js');
    
    // Export both keys
    const privateKeyBase64 = await exportPrivateKey(ephemeralKeyPair.privateKey);
    const publicKeyBase64 = await exportPublicKey(ephemeralKeyPair.publicKey);

    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const keyData = {
      username: `ephemeral_${exchangeId}`, // Use exchangeId as identifier
      privateKey: privateKeyBase64,
      publicKey: publicKeyBase64,
      algorithm: 'ECDH',
      keySize: 'P-256',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours
    };

    await new Promise((resolve, reject) => {
      const request = store.put(keyData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log('Ephemeral key pair stored for exchange:', exchangeId);
  } catch (error) {
    console.error('Error storing ephemeral key pair:', error);
    throw error;
  }
}

/**
 * Retrieve ephemeral ECDH key pair for key exchange
 * @param {string} exchangeId - Exchange ID
 * @returns {Promise<CryptoKeyPair>} Ephemeral key pair
 */
export async function getEphemeralKeyPair(exchangeId) {
  try {
    const { importPrivateKey, importPublicKey } = await import('./crypto.js');
    
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise(async (resolve, reject) => {
      const request = store.get(`ephemeral_${exchangeId}`);
      request.onsuccess = async () => {
        if (!request.result) {
          reject(new Error('Ephemeral key pair not found'));
          return;
        }

        const keyData = request.result;

        // Check expiration
        if (new Date(keyData.expiresAt) < new Date()) {
          // Delete expired key
          const deleteTransaction = db.transaction([STORE_NAME], 'readwrite');
          const deleteStore = deleteTransaction.objectStore(STORE_NAME);
          deleteStore.delete(`ephemeral_${exchangeId}`);
          reject(new Error('Ephemeral key pair expired'));
          return;
        }

        // Import keys
        const privateKey = await importPrivateKey(keyData.privateKey, 'ECDH', 'P-256');
        const publicKey = await importPublicKey(keyData.publicKey, 'ECDH', 'P-256');

        resolve({ privateKey, publicKey });
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error retrieving ephemeral key pair:', error);
    throw error;
  }
}

/**
 * Get all available session keys (exchange IDs) from IndexedDB
 * @returns {Promise<Array<string>>} Array of exchange IDs that have session keys
 */
export async function getAllSessionKeyIds() {
  try {
    const db = await openDB();
    const transaction = db.transaction([SESSION_STORE_NAME], 'readonly');
    const store = transaction.objectStore(SESSION_STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const sessionKeys = request.result || [];
        // Filter out expired keys and return only valid exchange IDs
        const validIds = sessionKeys
          .filter(sk => new Date(sk.expiresAt) > new Date())
          .map(sk => sk.sessionId);
        resolve(validIds);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting all session key IDs:', error);
    return [];
  }
}

