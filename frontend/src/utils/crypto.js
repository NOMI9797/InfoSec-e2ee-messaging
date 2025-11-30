/**
 * Cryptographic utilities using Web Crypto API
 * Generates RSA or ECC key pairs for end-to-end encryption
 */

/**
 * Generate RSA key pair (2048 or 3072 bits)
 * @param {number} modulusLength - Key size: 2048 or 3072 (default: 2048)
 * @returns {Promise<CryptoKeyPair>} RSA key pair
 */
export async function generateRSAKeyPair(modulusLength = 2048) {
  try {
    if (modulusLength !== 2048 && modulusLength !== 3072) {
      throw new Error('RSA key size must be 2048 or 3072 bits');
    }

    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: modulusLength,
        publicExponent: new Uint8Array([1, 0, 1]), // 65537
        hash: 'SHA-256',
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );

    return keyPair;
  } catch (error) {
    console.error('Error generating RSA key pair:', error);
    throw error;
  }
}

/**
 * Generate ECC key pair (P-256 or P-384)
 * @param {string} namedCurve - Curve name: 'P-256' or 'P-384' (default: 'P-256')
 * @returns {Promise<CryptoKeyPair>} ECC key pair
 */
export async function generateECCKeyPair(namedCurve = 'P-256') {
  try {
    if (namedCurve !== 'P-256' && namedCurve !== 'P-384') {
      throw new Error('ECC curve must be P-256 or P-384');
    }

    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: namedCurve,
      },
      true, // extractable
      ['deriveKey', 'deriveBits']
    );

    return keyPair;
  } catch (error) {
    console.error('Error generating ECC key pair:', error);
    throw error;
  }
}

/**
 * Export public key to SPKI format (base64 string)
 * @param {CryptoKey} publicKey - Public key to export
 * @returns {Promise<string>} Base64-encoded SPKI format public key
 */
export async function exportPublicKey(publicKey) {
  try {
    const exported = await window.crypto.subtle.exportKey('spki', publicKey);
    const bytes = new Uint8Array(exported);
    // Use a more robust base64 encoding method
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64;
  } catch (error) {
    console.error('Error exporting public key:', error);
    throw error;
  }
}

/**
 * Export private key to PKCS#8 format (base64 string)
 * @param {CryptoKey} privateKey - Private key to export
 * @returns {Promise<string>} Base64-encoded PKCS#8 format private key
 */
export async function exportPrivateKey(privateKey) {
  try {
    const exported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
    return base64;
  } catch (error) {
    console.error('Error exporting private key:', error);
    throw error;
  }
}

/**
 * Import public key from SPKI format
 * @param {string} base64Key - Base64-encoded SPKI format public key
 * @param {string} algorithm - Algorithm name: 'RSA-OAEP' or 'ECDH'
 * @param {string} namedCurve - For ECC: 'P-256' or 'P-384' (required for ECC)
 * @returns {Promise<CryptoKey>} Imported public key
 */
export async function importPublicKey(base64Key, algorithm = 'RSA-OAEP', namedCurve = null) {
  try {
    // Validate and clean input
    if (!base64Key || typeof base64Key !== 'string') {
      throw new Error('Invalid base64 key: must be a non-empty string');
    }
    const cleanKey = base64Key.trim().replace(/\s/g, '');
    
    let binaryString;
    let bytes;
    try {
      binaryString = atob(cleanKey);
      bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
    } catch (e) {
      throw new Error(`Invalid base64 encoding: ${e.message}`);
    }

    let keyAlgorithm;
    if (algorithm === 'RSA-OAEP') {
      keyAlgorithm = {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      };
    } else if (algorithm === 'ECDH') {
      if (!namedCurve) {
        throw new Error('namedCurve is required for ECC keys');
      }
      keyAlgorithm = {
        name: 'ECDH',
        namedCurve: namedCurve,
      };
    } else {
      throw new Error('Unsupported algorithm');
    }

    // Determine key usages based on algorithm
    let keyUsages;
    if (algorithm === 'RSA-OAEP') {
      keyUsages = ['encrypt'];
    } else if (algorithm === 'ECDH') {
      // For ECDH public keys, use empty array []
      // The public key doesn't have usages - it's used as input to deriveBits with a private key
      keyUsages = [];
    } else {
      throw new Error('Unsupported algorithm for key import');
    }

    console.log('Importing public key:', { 
      algorithm, 
      namedCurve, 
      keyUsages, 
      keyLength: bytes.length,
      base64Length: cleanKey.length
    });

    // Import the key
    const publicKey = await window.crypto.subtle.importKey(
      'spki',
      bytes,
      keyAlgorithm,
      true, // Extractable
      keyUsages
    );

    return publicKey;
  } catch (error) {
    console.error('Error importing public key:', error);
    console.error('Key details:', { 
      algorithm, 
      namedCurve, 
      base64Length: base64Key?.length,
      keyUsages: algorithm === 'ECDH' ? ['deriveBits'] : ['encrypt']
    });
    throw new Error(`Failed to import ${algorithm} public key: ${error.message}`);
  }
}

/**
 * Import private key from PKCS#8 format
 * @param {string} base64Key - Base64-encoded PKCS#8 format private key
 * @param {string} algorithm - Algorithm name: 'RSA-OAEP' or 'ECDH'
 * @param {string} namedCurve - For ECC: 'P-256' or 'P-384' (required for ECC)
 * @returns {Promise<CryptoKey>} Imported private key
 */
export async function importPrivateKey(base64Key, algorithm = 'RSA-OAEP', namedCurve = null) {
  try {
    const binaryString = atob(base64Key);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    let keyAlgorithm;
    if (algorithm === 'RSA-OAEP') {
      keyAlgorithm = {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      };
    } else if (algorithm === 'ECDH') {
      if (!namedCurve) {
        throw new Error('namedCurve is required for ECC keys');
      }
      keyAlgorithm = {
        name: 'ECDH',
        namedCurve: namedCurve,
      };
    } else {
      throw new Error('Unsupported algorithm');
    }

    const privateKey = await window.crypto.subtle.importKey(
      'pkcs8',
      bytes,
      keyAlgorithm,
      true,
      algorithm === 'RSA-OAEP' ? ['decrypt'] : ['deriveKey', 'deriveBits']
    );

    return privateKey;
  } catch (error) {
    console.error('Error importing private key:', error);
    throw error;
  }
}

/**
 * Encrypt message using AES-256-GCM
 * @param {string} plaintext - Message to encrypt
 * @param {CryptoKey} sessionKey - AES-GCM session key
 * @returns {Promise<{ciphertext: string, iv: string, tag: string}>} Encrypted message components
 */
export async function encryptMessage(plaintext, sessionKey) {
  try {
    // Generate random IV (96 bits = 12 bytes for AES-GCM)
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Convert plaintext to bytes
    const plaintextBytes = new TextEncoder().encode(plaintext);
    
    // Encrypt using AES-GCM
    // Note: AES-GCM returns ciphertext with tag appended
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128 // 128-bit authentication tag
      },
      sessionKey,
      plaintextBytes
    );
    
    // Extract ciphertext and tag
    // In AES-GCM, the tag is appended to the ciphertext
    const encryptedArray = new Uint8Array(encryptedData);
    const tagLength = 16; // 128 bits = 16 bytes
    const actualCiphertext = encryptedArray.slice(0, -tagLength);
    const tag = encryptedArray.slice(-tagLength);
    
    // Convert to base64 for storage/transmission
    let ciphertextBase64 = '';
    for (let i = 0; i < actualCiphertext.length; i++) {
      ciphertextBase64 += String.fromCharCode(actualCiphertext[i]);
    }
    ciphertextBase64 = btoa(ciphertextBase64);
    
    let ivBase64 = '';
    for (let i = 0; i < iv.length; i++) {
      ivBase64 += String.fromCharCode(iv[i]);
    }
    ivBase64 = btoa(ivBase64);
    
    let tagBase64 = '';
    for (let i = 0; i < tag.length; i++) {
      tagBase64 += String.fromCharCode(tag[i]);
    }
    tagBase64 = btoa(tagBase64);
    
    return {
      ciphertext: ciphertextBase64,
      iv: ivBase64,
      tag: tagBase64
    };
  } catch (error) {
    console.error('Error encrypting message:', error);
    throw error;
  }
}

/**
 * Decrypt message using AES-256-GCM
 * @param {string} ciphertext - Encrypted message (base64)
 * @param {string} iv - Initialization vector (base64)
 * @param {string} tag - Authentication tag (base64)
 * @param {CryptoKey} sessionKey - AES-GCM session key
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decryptMessage(ciphertext, iv, tag, sessionKey) {
  try {
    // Decode base64 strings
    const ciphertextBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
    const tagBytes = Uint8Array.from(atob(tag), c => c.charCodeAt(0));
    
    // Combine ciphertext and tag (AES-GCM expects them together)
    const ciphertextWithTag = new Uint8Array(ciphertextBytes.length + tagBytes.length);
    ciphertextWithTag.set(ciphertextBytes);
    ciphertextWithTag.set(tagBytes, ciphertextBytes.length);
    
    // Decrypt using AES-GCM
    const plaintextBytes = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
        tagLength: 128 // 128-bit authentication tag
      },
      sessionKey,
      ciphertextWithTag
    );
    
    // Convert bytes to string
    const plaintext = new TextDecoder().decode(plaintextBytes);
    
    return plaintext;
  } catch (error) {
    console.error('Error decrypting message:', error);
    throw new Error('Failed to decrypt message. The message may be corrupted or the key is incorrect.');
  }
}

