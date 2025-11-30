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
    const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
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

    const publicKey = await window.crypto.subtle.importKey(
      'spki',
      bytes,
      keyAlgorithm,
      true,
      algorithm === 'RSA-OAEP' ? ['encrypt'] : ['deriveKey', 'deriveBits']
    );

    return publicKey;
  } catch (error) {
    console.error('Error importing public key:', error);
    throw error;
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

