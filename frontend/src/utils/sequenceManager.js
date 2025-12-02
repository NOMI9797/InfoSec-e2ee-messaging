/**
 * Sequence number and nonce management for replay protection
 * Stores sequence numbers per exchangeId in IndexedDB
 */

const DB_NAME = 'e2ee-messaging';
const STORE_NAME = 'messageSequences';

/**
 * Open IndexedDB
 */
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'exchangeId' });
        store.createIndex('exchangeId', 'exchangeId', { unique: true });
      }
    };
  });
}

/**
 * Get or create sequence number for an exchange
 * @param {string} exchangeId - Key exchange ID
 * @param {string} fromUserId - Sender user ID
 * @param {string} toUserId - Recipient user ID
 * @returns {Promise<number>} Next sequence number
 */
export async function getNextSequenceNumber(exchangeId, fromUserId, toUserId) {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(exchangeId);
      
      request.onsuccess = () => {
        let sequenceData = request.result;
        
        if (!sequenceData) {
          // Create new sequence data
          sequenceData = {
            exchangeId,
            fromUserId,
            toUserId,
            sequenceFromTo: 0,
            sequenceToFrom: 0
          };
        }

        // Determine direction based on stored user IDs
        // The sequence data stores the original fromUserId and toUserId from the key exchange
        const isFromTo = sequenceData.fromUserId === fromUserId && 
                         sequenceData.toUserId === toUserId;
        const isToFrom = sequenceData.fromUserId === toUserId && 
                         sequenceData.toUserId === fromUserId;
        
        if (!isFromTo && !isToFrom) {
          // User pair mismatch - this shouldn't happen, but handle gracefully
          console.warn('User pair mismatch in sequence manager', {
            stored: { from: sequenceData.fromUserId, to: sequenceData.toUserId },
            requested: { from: fromUserId, to: toUserId }
          });
          // Update to match current request
          sequenceData.fromUserId = fromUserId;
          sequenceData.toUserId = toUserId;
          sequenceData.sequenceFromTo = 0;
          sequenceData.sequenceToFrom = 0;
        }
        
        // Get and increment sequence number
        const currentSequence = isFromTo 
          ? sequenceData.sequenceFromTo 
          : sequenceData.sequenceToFrom;
        
        const nextSequence = currentSequence + 1;
        
        // Update sequence
        if (isFromTo) {
          sequenceData.sequenceFromTo = nextSequence;
        } else {
          sequenceData.sequenceToFrom = nextSequence;
        }
        
        // Save updated sequence
        const putRequest = store.put(sequenceData);
        putRequest.onsuccess = () => resolve(nextSequence);
        putRequest.onerror = () => reject(putRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting sequence number:', error);
    // Return a timestamp-based sequence as fallback
    return Date.now();
  }
}

/**
 * Generate a random nonce
 * @returns {string} Base64-encoded nonce
 */
export function generateNonce() {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

