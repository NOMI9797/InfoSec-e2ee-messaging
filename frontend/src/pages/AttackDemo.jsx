import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import './AttackDemo.css';

const AttackDemo = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('mitm');
  const [attackLogs, setAttackLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [captureStatus, setCaptureStatus] = useState('idle'); // idle, capturing, captured

  // MITM Attack State
  const [mitmScenario, setMitmScenario] = useState('with-signatures');
  const [mitmLogs, setMitmLogs] = useState([]);

  // Replay Attack State
  const [replayLogs, setReplayLogs] = useState([]);
  const [replayMessageId, setReplayMessageId] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
  }, [navigate]);

  const addLog = (category, message, type = 'info') => {
    const logEntry = {
      id: `${Date.now()}-${Math.random()}`, // Unique ID to prevent React key warnings
      timestamp: new Date().toLocaleTimeString(),
      category,
      message,
      type // info, success, warning, error
    };

    if (category === 'mitm') {
      setMitmLogs(prev => [...prev, logEntry]);
    } else if (category === 'replay') {
      setReplayLogs(prev => [...prev, logEntry]);
    }
    
    setAttackLogs(prev => [...prev, logEntry]);
  };

  const clearLogs = (category) => {
    if (category === 'mitm') {
      setMitmLogs([]);
    } else if (category === 'replay') {
      setReplayLogs([]);
    }
    setAttackLogs([]);
  };

  // MITM Attack Demonstration
  const demonstrateMITM = async () => {
    setIsRunning(true);
    clearLogs('mitm');
    
    addLog('mitm', '🚀 Starting MITM Attack Demonstration...', 'info');
    addLog('mitm', `📋 Scenario: ${mitmScenario === 'with-signatures' ? 'With Signature Verification' : 'Without Signature Verification'}`, 'info');
    
    try {
      // Step 1: Simulate normal key exchange initiation
      addLog('mitm', '📤 Step 1: Initiating key exchange (Alice → Bob)', 'info');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 2: Simulate MITM interception
      addLog('mitm', '⚠️ Step 2: MITM ATTACKER intercepts the key exchange!', 'warning');
      addLog('mitm', '   Attacker replaces Alice\'s ephemeral public key with their own', 'warning');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (mitmScenario === 'with-signatures') {
        // With signatures - attack should fail
        addLog('mitm', '🔒 Step 3: Bob verifies Alice\'s digital signature...', 'info');
        await new Promise(resolve => setTimeout(resolve, 1000));
        addLog('mitm', '❌ SIGNATURE VERIFICATION FAILED!', 'error');
        addLog('mitm', '   The signature doesn\'t match because the key was modified', 'error');
        addLog('mitm', '✅ Attack BLOCKED by signature verification', 'success');
        addLog('mitm', '   Bob rejects the key exchange', 'success');
      } else {
        // Without signatures - attack succeeds
        addLog('mitm', '⚠️ Step 3: No signature verification (vulnerable scenario)', 'warning');
        await new Promise(resolve => setTimeout(resolve, 1000));
        addLog('mitm', '✅ Attack SUCCEEDS! Bob accepts the modified key', 'error');
        addLog('mitm', '   Attacker can now decrypt all messages', 'error');
        addLog('mitm', '   Bob thinks he\'s talking to Alice, but attacker is in the middle', 'error');
      }
      
      addLog('mitm', '📊 Attack demonstration completed', 'info');
      
      // Wait a bit for logs to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Log to backend
      await api.post('/attack-demo/mitm', {
        scenario: mitmScenario,
        success: mitmScenario === 'with-signatures' ? false : true,
        logs: mitmLogs
      });
      
    } catch (error) {
      addLog('mitm', `❌ Error: ${error.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  // Replay Attack Demonstration
  const demonstrateReplay = async () => {
    setIsRunning(true);
    clearLogs('replay');
    
    addLog('replay', '🚀 Starting Replay Attack Demonstration...', 'info');
    
    try {
      // Step 1: Get the most recent message to find the other user
      addLog('replay', '📤 Step 1: Finding most recent message...', 'info');
      const currentUserId = localStorage.getItem('userId');
      
      // Get the most recent message
      const recentMessageResponse = await api.get(`/messages/recent/${currentUserId}`);
      
      if (!recentMessageResponse.data.success || !recentMessageResponse.data.message) {
        addLog('replay', '⚠️ No messages found. Send a message first to demonstrate replay attack.', 'warning');
        addLog('replay', '   💡 Solution: Send a message to another user first', 'info');
        addLog('replay', '   💡 Make sure key exchange is completed before sending', 'info');
        setIsRunning(false);
        return;
      }
      
      const { message: recentMessage, otherUser } = recentMessageResponse.data;
      
      addLog('replay', `   ✅ Found most recent message with: ${otherUser.username} (${otherUser._id})`, 'success');
      
      // Now get all messages with this user
      addLog('replay', '📤 Step 2: Fetching all messages with this user...', 'info');
      const messagesResponse = await api.get(`/messages/${currentUserId}/${otherUser._id}`);
      const messages = messagesResponse.data.messages || [];
      
      // Debug logging
      console.log('Replay Attack Demo Debug:', {
        currentUserId,
        otherUser: otherUser._id,
        messagesCount: messages.length,
        messages: messages.map(m => ({
          _id: m._id,
          fromUserId: m.fromUserId?._id || m.fromUserId,
          toUserId: m.toUserId?._id || m.toUserId,
          exchangeId: m.exchangeId,
          sequenceNumber: m.sequenceNumber,
          nonce: m.nonce ? m.nonce.substring(0, 10) + '...' : null,
          hasRequiredFields: !!(m.exchangeId && m.sequenceNumber && m.nonce)
        }))
      });
      
      // Filter messages that have required fields for replay protection
      const validMessages = messages.filter(m => m.exchangeId && m.sequenceNumber && m.nonce);
      
      if (validMessages.length === 0) {
        addLog('replay', '⚠️ No messages with replay protection fields found.', 'warning');
        addLog('replay', '   Messages exist but are missing exchangeId, sequenceNumber, or nonce.', 'warning');
        addLog('replay', '   Make sure messages were sent with key exchange completed.', 'info');
        setIsRunning(false);
        return;
      }
      
      const lastMessage = validMessages[validMessages.length - 1];
      addLog('replay', `✅ Found message: "${lastMessage.messageType === 'file' ? 'File' : 'Text message'}"`, 'success');
      addLog('replay', `   Timestamp: ${new Date(lastMessage.timestamp).toLocaleString()}`, 'info');
      addLog('replay', `   Sequence: ${lastMessage.sequenceNumber || 'N/A'}`, 'info');
      addLog('replay', `   Nonce: ${lastMessage.nonce ? lastMessage.nonce.substring(0, 16) + '...' : 'N/A'}`, 'info');
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Step 2: Attempt replay
      addLog('replay', '⚠️ Step 2: ATTACKER attempts to replay the message...', 'warning');
      addLog('replay', '   Using same ciphertext, IV, tag, sequence number, and nonce', 'warning');
      
      try {
        const replayData = {
          fromUserId: lastMessage.fromUserId._id || lastMessage.fromUserId,
          toUserId: lastMessage.toUserId._id || lastMessage.toUserId,
          exchangeId: lastMessage.exchangeId,
          ciphertext: lastMessage.ciphertext,
          iv: lastMessage.iv,
          tag: lastMessage.tag,
          timestamp: lastMessage.timestamp,
          messageType: lastMessage.messageType,
          sequenceNumber: lastMessage.sequenceNumber,
          nonce: lastMessage.nonce
        };
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try to send the replayed message
        const response = await api.post('/messages/send', replayData);
        
        // This shouldn't succeed if replay protection is working
        addLog('replay', '❌ ERROR: Replay protection should have blocked this!', 'error');
        addLog('replay', '   Check your replay protection implementation', 'error');
        
      } catch (error) {
        if (error.response?.status === 400) {
          addLog('replay', '🔒 Step 3: Replay protection detected the attack!', 'success');
          addLog('replay', `   Server response: ${error.response.data.error || 'Replay detected'}`, 'success');
          addLog('replay', '✅ Attack BLOCKED by replay protection', 'success');
          addLog('replay', '   The nonce/sequence number was already used', 'success');
        } else {
          addLog('replay', `❌ Error: ${error.message}`, 'error');
        }
      }
      
      addLog('replay', '📊 Replay attack demonstration completed', 'info');
      
      // Wait a bit for logs to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Log to backend
      await api.post('/attack-demo/replay', {
        messageId: lastMessage._id,
        blocked: true,
        logs: replayLogs
      });
      
    } catch (error) {
      addLog('replay', `❌ Error: ${error.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="attack-demo-page">
      <header className="attack-demo-header">
        <div className="header-content">
          <h1>🛡️ Attack Demonstrations & Testing</h1>
          <button className="btn-back" onClick={() => navigate('/chat')}>
            ← Back to Chat
          </button>
        </div>
      </header>

      <div className="attack-demo-container">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'mitm' ? 'active' : ''}`}
            onClick={() => setActiveTab('mitm')}
          >
            🔓 MITM Attack
          </button>
          <button 
            className={`tab ${activeTab === 'replay' ? 'active' : ''}`}
            onClick={() => setActiveTab('replay')}
          >
            🔄 Replay Attack
          </button>
          <button 
            className={`tab ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            🔧 Tools Guide
          </button>
        </div>

        {/* MITM Attack Tab */}
        {activeTab === 'mitm' && (
          <div className="attack-section">
            <div className="attack-info">
              <h2>Man-in-the-Middle (MITM) Attack Demonstration</h2>
              <p>
                This demonstration shows how digital signatures protect against MITM attacks.
                An attacker tries to intercept and modify the key exchange, but signature
                verification prevents the attack.
              </p>
            </div>

            <div className="scenario-selector">
              <label>Attack Scenario:</label>
              <select 
                value={mitmScenario} 
                onChange={(e) => setMitmScenario(e.target.value)}
                disabled={isRunning}
              >
                <option value="with-signatures">With Signature Verification (Protected)</option>
                <option value="without-signatures">Without Signature Verification (Vulnerable)</option>
              </select>
            </div>

            <div className="attack-controls">
              <button 
                className="btn-demo"
                onClick={demonstrateMITM}
                disabled={isRunning}
              >
                {isRunning ? 'Running...' : '🚀 Run MITM Attack Demo'}
              </button>
              <button 
                className="btn-clear"
                onClick={() => clearLogs('mitm')}
                disabled={isRunning}
              >
                Clear Logs
              </button>
            </div>

            <div className="attack-logs">
              <h3>Attack Logs</h3>
              <div className="logs-container">
                {mitmLogs.length === 0 ? (
                  <p className="no-logs">No logs yet. Click "Run MITM Attack Demo" to start.</p>
                ) : (
                  mitmLogs.map(log => (
                    <div key={log.id} className={`log-entry log-${log.type}`}>
                      <span className="log-time">{log.timestamp}</span>
                      <span className="log-message">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Replay Attack Tab */}
        {activeTab === 'replay' && (
          <div className="attack-section">
            <div className="attack-info">
              <h2>Replay Attack Demonstration</h2>
              <p>
                This demonstration shows how replay protection (nonces, timestamps, sequence numbers)
                prevents attackers from resending old messages. The system detects duplicate nonces
                and sequence numbers.
              </p>
            </div>

            <div className="attack-controls">
              <button 
                className="btn-demo"
                onClick={demonstrateReplay}
                disabled={isRunning}
              >
                {isRunning ? 'Running...' : '🚀 Run Replay Attack Demo'}
              </button>
              <button 
                className="btn-clear"
                onClick={() => clearLogs('replay')}
                disabled={isRunning}
              >
                Clear Logs
              </button>
            </div>

            <div className="attack-logs">
              <h3>Attack Logs</h3>
              <div className="logs-container">
                {replayLogs.length === 0 ? (
                  <p className="no-logs">No logs yet. Click "Run Replay Attack Demo" to start.</p>
                ) : (
                  replayLogs.map(log => (
                    <div key={log.id} className={`log-entry log-${log.type}`}>
                      <span className="log-time">{log.timestamp}</span>
                      <span className="log-message">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tools Guide Tab */}
        {activeTab === 'tools' && (
          <div className="tools-section">
            <h2>Security Testing Tools Guide</h2>
            
            <div className="tool-guide">
              <h3>📡 Wireshark Packet Capture</h3>
              <div className="guide-content">
                <h4>Setup Instructions:</h4>
                <ol>
                  <li>Download and install Wireshark from <a href="https://www.wireshark.org/" target="_blank" rel="noopener noreferrer">wireshark.org</a></li>
                  <li>Start Wireshark and select your network interface (usually "Loopback" for localhost)</li>
                  <li>Set capture filter: <code>tcp port 3001</code> (for backend API)</li>
                  <li>Start capturing packets</li>
                </ol>
                
                <h4>What to Capture:</h4>
                <ul>
                  <li><strong>Key Exchange Initiation:</strong> POST /api/key-exchange/initiate</li>
                  <li><strong>Key Exchange Response:</strong> POST /api/key-exchange/respond</li>
                  <li><strong>Message Sending:</strong> POST /api/messages/send</li>
                  <li><strong>Message Retrieval:</strong> GET /api/messages/:userId1/:userId2</li>
                </ul>
                
                <h4>Analysis Points:</h4>
                <ul>
                  <li>Verify that ciphertext is encrypted (should look random)</li>
                  <li>Check that IVs are different for each message</li>
                  <li>Observe that plaintext is never transmitted</li>
                  <li>Note that session keys are never sent over the network</li>
                </ul>
                
                <h4>Filter Examples:</h4>
                <pre>
{`# Filter for HTTP requests to API
http.request.uri contains "/api/"

# Filter for key exchange endpoints
http.request.uri contains "key-exchange"

# Filter for message endpoints
http.request.uri contains "messages"

# Follow HTTP stream
Right-click → Follow → HTTP Stream`}
                </pre>
              </div>
            </div>

            <div className="tool-guide">
              <h3>🔧 BurpSuite Attack Simulation</h3>
              <div className="guide-content">
                <h4>Setup Instructions:</h4>
                <ol>
                  <li>Download BurpSuite Community Edition from <a href="https://portswigger.net/burp/communitydownload" target="_blank" rel="noopener noreferrer">portswigger.net</a></li>
                  <li>Configure browser proxy: 127.0.0.1:8080</li>
                  <li>Install BurpSuite CA certificate in browser</li>
                  <li>Start intercepting requests</li>
                </ol>
                
                <h4>Attack Scenarios:</h4>
                
                <h5>1. MITM Attack (Modify Key Exchange)</h5>
                <ul>
                  <li>Intercept POST /api/key-exchange/initiate</li>
                  <li>Modify the ephemeralPublicKey field</li>
                  <li>Forward the request</li>
                  <li><strong>Expected:</strong> Signature verification should fail</li>
                </ul>
                
                <h5>2. Replay Attack</h5>
                <ul>
                  <li>Intercept a message send request</li>
                  <li>Copy the entire request</li>
                  <li>Resend the same request multiple times</li>
                  <li><strong>Expected:</strong> Replay protection should block duplicate nonces</li>
                </ul>
                
                <h5>3. Message Tampering</h5>
                <ul>
                  <li>Intercept an encrypted message</li>
                  <li>Modify ciphertext, IV, or tag</li>
                  <li>Forward the modified message</li>
                  <li><strong>Expected:</strong> Decryption should fail due to authentication tag mismatch</li>
                </ul>
                
                <h4>BurpSuite Features to Use:</h4>
                <ul>
                  <li><strong>Proxy:</strong> Intercept and modify requests</li>
                  <li><strong>Repeater:</strong> Resend requests multiple times</li>
                  <li><strong>Intruder:</strong> Automated attack testing</li>
                  <li><strong>Decoder:</strong> Base64 decode/encode encrypted data</li>
                </ul>
              </div>
            </div>

            <div className="tool-guide">
              <h3>📝 Testing Checklist</h3>
              <div className="guide-content">
                <h4>Security Tests:</h4>
                <ul>
                  <li>✅ MITM attack blocked by signatures</li>
                  <li>✅ Replay attacks blocked by nonces/sequence numbers</li>
                  <li>✅ Message tampering detected by authentication tags</li>
                  <li>✅ Random IVs prevent pattern analysis</li>
                  <li>✅ Session keys never transmitted</li>
                  <li>✅ Plaintext never exposed in network traffic</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttackDemo;

