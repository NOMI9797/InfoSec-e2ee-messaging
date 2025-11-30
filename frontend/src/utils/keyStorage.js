/**
 * Secure key storage using IndexedDB
 * Stores private keys encrypted with user password
 */

const DB_NAME = 'E2EEKeyStorage';
const DB_VERSION = 1;
const STORE_NAME = 'privateKeys';

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

