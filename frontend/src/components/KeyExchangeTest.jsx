import { useState } from 'react';
import * as keyExchange from '../utils/keyExchange';
import api from '../services/api';
import { getSessionKey } from '../utils/keyStorage';

const KeyExchangeTest = () => {
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [username, setUsername] = useState('');
  const [exchangeId, setExchangeId] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  // Get current user info from localStorage
  const currentUserId = localStorage.getItem('userId');
  const currentUsername = localStorage.getItem('username');

  // Helper to clean user ID (remove extra text)
  const cleanUserId = (userId) => {
    if (!userId) return userId;
    // Extract just the MongoDB ObjectId (24 hex characters)
    const match = userId.match(/[0-9a-fA-F]{24}/);
    return match ? match[0] : userId.trim();
  };

  const testInitiate = async () => {
    setLoading(true);
    setResult('Initiating key exchange...\n');
    try {
      const cleanFromId = cleanUserId(fromUserId || currentUserId);
      const cleanToId = cleanUserId(toUserId);
      
      if (!cleanToId) {
        throw new Error('To User ID is required');
      }

      setResult(prev => prev + `Using From ID: ${cleanFromId}\nUsing To ID: ${cleanToId}\n`);
      
      const result = await keyExchange.initiateKeyExchange(
        cleanFromId,
        cleanToId,
        username || currentUsername
      );
      setExchangeId(result.exchangeId);
      setResult(prev => prev + '✅ Initiated!\nExchange ID: ' + result.exchangeId + '\n\n' + JSON.stringify(result, null, 2));
      
      // Store ephemeral key pair in sessionStorage for later use
      if (result.ephemeralKeyPair) {
        // Note: We can't directly store CryptoKeyPair, but we can store the exchangeId
        // and retrieve the key pair when needed
        sessionStorage.setItem(`ephemeral_${result.exchangeId}`, 'stored');
      }
    } catch (error) {
      setResult(prev => prev + '❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const testGetPending = async () => {
    setLoading(true);
    setResult('Fetching pending exchanges...\n');
    try {
      const cleanId = cleanUserId(toUserId || currentUserId);
      const response = await api.get(`/key-exchange/pending/${cleanId}`);
      
      if (response.data.exchanges && response.data.exchanges.length > 0) {
        const firstExchange = response.data.exchanges[0];
        setExchangeId(firstExchange.exchangeId);
        setResult(prev => prev + `✅ Found ${response.data.exchanges.length} pending exchange(s)\n` +
          `First Exchange ID: ${firstExchange.exchangeId}\n\n` +
          JSON.stringify(response.data, null, 2));
      } else {
        setResult(prev => prev + 'ℹ️ No pending exchanges found.\n');
      }
    } catch (error) {
      setResult(prev => prev + '❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const testGetExchange = async () => {
    if (!exchangeId) {
      setResult('Please enter an exchange ID');
      return;
    }
    setLoading(true);
    setResult('Fetching exchange details...\n');
    try {
      const response = await api.get(`/key-exchange/${exchangeId}`);
      setResult(prev => prev + '✅ Exchange details:\n' + JSON.stringify(response.data, null, 2));
    } catch (error) {
      setResult(prev => prev + '❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const testGetSessionKey = async () => {
    if (!exchangeId) {
      setResult('Please enter an exchange ID');
      return;
    }
    setLoading(true);
    setResult('Retrieving session key...\n');
    try {
      const key = await getSessionKey(exchangeId);
      setResult(prev => prev + '✅ Session key retrieved!\nAlgorithm: ' + key.algorithm.name + '\nKey Length: ' + key.algorithm.length);
    } catch (error) {
      setResult(prev => prev + '❌ Error: ' + error.message + '\n\n💡 Note: Session key is only stored after key exchange is completed (respond + confirm).');
    } finally {
      setLoading(false);
    }
  };

  const testRespondToExchange = async () => {
    if (!exchangeId) {
      setResult('Please enter an exchange ID from pending exchanges');
      return;
    }
    setLoading(true);
    setResult('Responding to key exchange...\n');
    try {
      // First get the exchange details
      const exchangeRes = await api.get(`/key-exchange/${exchangeId}`);
      const exchange = exchangeRes.data.keyExchange;
      
      if (!exchange) {
        throw new Error('Exchange not found');
      }

      const fromUserId = exchange.fromUserId._id || exchange.fromUserId;
      const cleanToUserId = cleanUserId(toUserId || currentUserId);

      // Get initiator's public key
      const initiatorKeyRes = await api.get(`/users/${fromUserId}/public-key`);
      const initiatorRSAKey = initiatorKeyRes.data.publicKey;

      setResult(prev => prev + `From User ID: ${fromUserId}\nTo User ID: ${cleanToUserId}\n`);

      // Get timestamp and nonce from exchange (required for signature verification)
      const exchangeTimestamp = exchange.timestamp || exchange.createdAt?.getTime() || Date.now();
      const exchangeNonce = exchange.nonce;

      setResult(prev => prev + `Timestamp: ${exchangeTimestamp}\nNonce: ${exchangeNonce}\n`);

      // Respond to key exchange
      const result = await keyExchange.respondToKeyExchange(
        exchangeId,
        fromUserId,
        cleanToUserId,
        username || currentUsername,
        exchange.initiatorEphemeralPublicKey,
        exchange.initiatorSignature,
        initiatorRSAKey,
        exchangeTimestamp,
        exchangeNonce
      );

      setResult(prev => prev + '✅ Key exchange responded!\n✅ Session key stored for User 2.\n' + 
        `Exchange ID: ${result.exchangeId}\n\nYou can now get the session key using button 7.`);
    } catch (error) {
      setResult(prev => prev + '❌ Error: ' + error.message + '\n\n' + error.stack);
    } finally {
      setLoading(false);
    }
  };

  const testCompleteExchange = async () => {
    if (!exchangeId) {
      setResult('Please enter an exchange ID');
      return;
    }
    setLoading(true);
    setResult('Completing key exchange...\n');
    try {
      // Get exchange details
      const exchangeRes = await api.get(`/key-exchange/${exchangeId}`);
      const exchange = exchangeRes.data.keyExchange;

      if (!exchange || exchange.status !== 'responded') {
        throw new Error('Exchange not found or not ready for completion');
      }

      const fromUserId = exchange.fromUserId._id || exchange.fromUserId;
      const toUserId = exchange.toUserId._id || exchange.toUserId;
      const cleanFromUserId = cleanUserId(fromUserId);
      const cleanToUserId = cleanUserId(toUserId);

      setResult(prev => prev + `From User ID: ${cleanFromUserId}\nTo User ID: ${cleanToUserId}\n`);

      // Get responder's RSA public key for signature verification
      const responderKeyRes = await api.get(`/users/${cleanToUserId}/public-key`);
      const responderRSAKey = responderKeyRes.data.publicKey;

      // Complete the key exchange (ephemeral key pair will be retrieved from storage)
      // Use responseNonce for key derivation (this is the nonce from the response, not initiation)
      const responseNonce = exchange.responseNonce || exchange.nonce; // Fallback to nonce if responseNonce not available
      // Get response timestamp for signature verification (must match what was signed)
      const responseTimestamp = exchange.responseTimestamp || exchange.timestamp || Date.now();
      
      const sessionKey = await keyExchange.completeKeyExchange(
        exchangeId,
        cleanFromUserId,
        cleanToUserId,
        exchange.responderEphemeralPublicKey,
        exchange.keyConfirmation,
        responseNonce,
        exchange.responderSignature,
        responderRSAKey,
        responseTimestamp
      );

      setResult(prev => prev + '✅ Key exchange completed!\n✅ Session key stored for User 1.\n' +
        `Exchange ID: ${exchangeId}\n\nYou can now get the session key using button 7.`);
    } catch (error) {
      setResult(prev => prev + '❌ Error: ' + error.message + '\n\n' + error.stack);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto', background: '#ffffff', minHeight: '100vh' }}>
      <h2 style={{ color: '#333', marginBottom: '20px', fontSize: '28px', fontWeight: 'bold' }}>Key Exchange Protocol Test</h2>
      <div style={{ marginBottom: '20px', padding: '15px', background: '#e3f2fd', borderRadius: '8px', border: '2px solid #2196f3' }}>
        <strong style={{ color: '#1976d2', fontSize: '16px' }}>Current User:</strong> 
        <span style={{ color: '#333', fontSize: '16px', marginLeft: '10px' }}>
          {currentUsername || 'Not logged in'} 
        </span>
        <span style={{ color: '#666', fontSize: '14px', marginLeft: '10px' }}>
          (ID: {currentUserId || 'N/A'})
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
        <div>
          <label style={{ display: 'block', color: '#333', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
            From User ID (leave empty for current user):
          </label>
          <input
            type="text"
            placeholder={currentUserId || "User ID"}
            value={fromUserId}
            onChange={(e) => setFromUserId(e.target.value)}
            style={{ width: '100%', padding: '12px', marginTop: '5px', border: '2px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', color: '#333', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
            To User ID: <span style={{ color: '#d32f2f' }}>*</span>
          </label>
          <input
            type="text"
            placeholder="Target user ID"
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
            style={{ width: '100%', padding: '12px', marginTop: '5px', border: '2px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333' }}
            required
          />
        </div>

        <div>
          <label style={{ display: 'block', color: '#333', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
            Username (leave empty for current user):
          </label>
          <input
            type="text"
            placeholder={currentUsername || "Username"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: '100%', padding: '12px', marginTop: '5px', border: '2px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', color: '#333', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
            Exchange ID (for testing response/completion):
          </label>
          <input
            type="text"
            placeholder="Exchange ID"
            value={exchangeId}
            onChange={(e) => setExchangeId(e.target.value)}
            style={{ width: '100%', padding: '12px', marginTop: '5px', border: '2px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#333' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '25px' }}>
        <button
          onClick={testInitiate}
          disabled={loading || !toUserId}
          style={{ 
            padding: '12px 24px', 
            background: loading || !toUserId ? '#ccc' : '#667eea', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: loading || !toUserId ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: loading || !toUserId ? 'none' : '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'all 0.3s'
          }}
          onMouseOver={(e) => !loading && toUserId && (e.target.style.transform = 'translateY(-2px)')}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          {loading ? '⏳ Loading...' : '1️⃣ Initiate Key Exchange'}
        </button>

        <button
          onClick={testGetPending}
          disabled={loading}
          style={{ 
            padding: '12px 24px', 
            background: loading ? '#ccc' : '#764ba2', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: loading ? 'none' : '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'all 0.3s'
          }}
          onMouseOver={(e) => !loading && (e.target.style.transform = 'translateY(-2px)')}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          {loading ? '⏳ Loading...' : '2️⃣ Get Pending Exchanges'}
        </button>

        <button
          onClick={testGetExchange}
          disabled={loading || !exchangeId}
          style={{ 
            padding: '12px 24px', 
            background: loading || !exchangeId ? '#ccc' : '#48bb78', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: loading || !exchangeId ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: loading || !exchangeId ? 'none' : '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'all 0.3s'
          }}
          onMouseOver={(e) => !loading && exchangeId && (e.target.style.transform = 'translateY(-2px)')}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          {loading ? '⏳ Loading...' : '3️⃣ Get Exchange Details'}
        </button>

        <button
          onClick={testRespondToExchange}
          disabled={loading || !exchangeId}
          style={{ 
            padding: '12px 24px', 
            background: loading || !exchangeId ? '#ccc' : '#9c27b0', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: loading || !exchangeId ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: loading || !exchangeId ? 'none' : '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'all 0.3s'
          }}
          onMouseOver={(e) => !loading && exchangeId && (e.target.style.transform = 'translateY(-2px)')}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          {loading ? '⏳ Loading...' : '5️⃣ Respond to Exchange'}
        </button>

        <button
          onClick={testCompleteExchange}
          disabled={loading || !exchangeId}
          style={{ 
            padding: '12px 24px', 
            background: loading || !exchangeId ? '#ccc' : '#f57c00', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: loading || !exchangeId ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: loading || !exchangeId ? 'none' : '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'all 0.3s'
          }}
          onMouseOver={(e) => !loading && exchangeId && (e.target.style.transform = 'translateY(-2px)')}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          {loading ? '⏳ Loading...' : '6️⃣ Complete Exchange'}
        </button>

        <button
          onClick={testGetSessionKey}
          disabled={loading || !exchangeId}
          style={{ 
            padding: '12px 24px', 
            background: loading || !exchangeId ? '#ccc' : '#ed8936', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: loading || !exchangeId ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: loading || !exchangeId ? 'none' : '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'all 0.3s'
          }}
          onMouseOver={(e) => !loading && exchangeId && (e.target.style.transform = 'translateY(-2px)')}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          {loading ? '⏳ Loading...' : '7️⃣ Get Session Key'}
        </button>
      </div>

      <div style={{ background: '#f5f5f5', color: '#333', padding: '20px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '13px', overflow: 'auto', maxHeight: '400px', border: '2px solid #ddd', marginBottom: '20px' }}>
        <div style={{ color: '#666', marginBottom: '10px', fontWeight: '600' }}>Results:</div>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#333', lineHeight: '1.6' }}>{result || 'Results will appear here...'}</pre>
      </div>

      <div style={{ marginTop: '20px', padding: '20px', background: '#fff3e0', borderRadius: '8px', border: '2px solid #ff9800' }}>
        <h3 style={{ color: '#e65100', marginBottom: '15px', fontSize: '20px', fontWeight: 'bold' }}>📋 Testing Instructions:</h3>
        <ol style={{ color: '#333', fontSize: '15px', lineHeight: '1.8', paddingLeft: '20px', margin: 0 }}>
          <li style={{ marginBottom: '8px' }}><strong>Make sure you're logged in</strong> in both browser tabs</li>
          <li style={{ marginBottom: '8px' }}><strong>Tab 1 (User 1 - Initiator):</strong> Enter User 2's ID in "To User ID" field</li>
          <li style={{ marginBottom: '8px' }}><strong>Tab 1:</strong> Click <strong>"1. Initiate Key Exchange"</strong> button</li>
          <li style={{ marginBottom: '8px' }}><strong>Tab 2 (User 2 - Responder):</strong> Click <strong>"2. Get Pending Exchanges"</strong> to see the request</li>
          <li style={{ marginBottom: '8px' }}><strong>Tab 2:</strong> Copy the Exchange ID from results and paste it in the "Exchange ID" field</li>
          <li style={{ marginBottom: '8px' }}><strong>Tab 2:</strong> Click <strong>"5. Respond to Exchange"</strong> - This stores the session key for User 2</li>
          <li style={{ marginBottom: '8px' }}><strong>Tab 1:</strong> Click <strong>"3. Get Exchange Details"</strong> to see the response</li>
          <li style={{ marginBottom: '8px' }}><strong>Tab 1:</strong> Click <strong>"6. Complete Exchange"</strong> - This stores the session key for User 1</li>
          <li style={{ marginBottom: '8px' }}><strong>Both tabs:</strong> Click <strong>"7. Get Session Key"</strong> to verify the session key is stored</li>
        </ol>
        <div style={{ marginTop: '15px', padding: '12px', background: '#fff', borderRadius: '6px', border: '1px solid #ff9800' }}>
          <strong style={{ color: '#e65100' }}>💡 Important:</strong> 
          <span style={{ color: '#333' }}> The session key is only stored AFTER the key exchange is completed. You must:</span>
          <ul style={{ marginTop: '8px', paddingLeft: '20px', color: '#333' }}>
            <li>1. Initiate (User 1)</li>
            <li>2. Respond (User 2) - stores key for User 2</li>
            <li>3. Complete (User 1) - stores key for User 1</li>
            <li>4. Then you can retrieve the session key</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default KeyExchangeTest;

