import { useState, useEffect, useRef } from 'react';
import { sendEncryptedMessage, getAndDecryptMessages } from '../utils/messageUtils.js';
import { getSessionKey, getAllSessionKeyIds } from '../utils/keyStorage.js';
import api from '../services/api.js';
import './Chat.css';

const Chat = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [exchangeId, setExchangeId] = useState(null);
  const [completedExchanges, setCompletedExchanges] = useState({}); // Map of userId -> exchangeId
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // Get current user info
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    
    if (token && userId) {
      setCurrentUser({ id: userId, username });
    }
  }, []);

  // Load users list
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await api.get('/users');
        setUsers(response.data.users || []);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    loadUsers();
  }, []);

  // Load completed key exchanges when current user is available
  useEffect(() => {
    const loadCompletedExchanges = async () => {
      if (!currentUser?.id) return;
      
      try {
        // Get exchanges from server
        const response = await api.get(`/key-exchange/completed/${currentUser.id}`);
        const exchanges = response.data.exchanges || [];
        
        // Get all available session keys from IndexedDB
        const availableSessionKeys = await getAllSessionKeyIds();
        console.log('Available session keys in IndexedDB:', availableSessionKeys);
        
        // Create a map: otherUserId -> exchangeId
        const exchangeMap = {};
        const currentUserIdStr = String(currentUser.id);
        
        exchanges.forEach(exchange => {
          const fromUserIdStr = String(exchange.fromUserId?._id || exchange.fromUserId);
          const toUserIdStr = String(exchange.toUserId?._id || exchange.toUserId);
          
          // Skip self-exchanges (user chatting with themselves)
          if (fromUserIdStr === toUserIdStr) {
            console.log('Skipping self-exchange:', exchange.exchangeId);
            return;
          }
          
          // Determine the other user's ID
          const otherUserId = fromUserIdStr === currentUserIdStr 
            ? toUserIdStr 
            : fromUserIdStr;
          
          // Only include if session key exists in IndexedDB
          if (availableSessionKeys.includes(exchange.exchangeId)) {
            // Use the most recent exchange if multiple exist (prefer confirmed over responded)
            if (!exchangeMap[otherUserId]) {
              exchangeMap[otherUserId] = exchange.exchangeId;
            } else {
              // If multiple exchanges exist, prefer confirmed status
              const existingExchange = exchanges.find(e => {
                const eFromId = String(e.fromUserId?._id || e.fromUserId);
                const eToId = String(e.toUserId?._id || e.toUserId);
                const eOtherId = eFromId === currentUserIdStr ? eToId : eFromId;
                return eOtherId === otherUserId && e.exchangeId === exchangeMap[otherUserId];
              });
              
              if (exchange.status === 'confirmed' && existingExchange?.status !== 'confirmed') {
                exchangeMap[otherUserId] = exchange.exchangeId;
              }
            }
          }
        });
        
        console.log('Loaded completed exchanges with session keys:', exchangeMap);
        console.log('Current user ID:', currentUserIdStr);
        console.log('All exchanges:', exchanges.map(e => ({
          exchangeId: e.exchangeId,
          fromUserId: String(e.fromUserId?._id || e.fromUserId),
          toUserId: String(e.toUserId?._id || e.toUserId),
          status: e.status
        })));
        setCompletedExchanges(exchangeMap);
      } catch (error) {
        console.error('Error loading completed exchanges:', error);
      }
    };
    
    loadCompletedExchanges();
  }, [currentUser]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load messages when user is selected
  useEffect(() => {
    if (selectedUser && currentUser && exchangeId) {
      loadMessages();
    }
  }, [selectedUser, exchangeId]);

  const loadMessages = async () => {
    if (!selectedUser || !currentUser || !exchangeId) return;
    
    setLoading(true);
    setError(null);
    try {
      const currentUserId = String(currentUser.id || currentUser._id);
      const selectedUserId = String(selectedUser._id || selectedUser.id);
      
      console.log('Loading messages:', { currentUserId, selectedUserId, exchangeId });
      
      const decryptedMessages = await getAndDecryptMessages(
        currentUserId,
        selectedUserId,
        exchangeId,
        currentUserId
      );
      setMessages(decryptedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
      setError('Failed to load messages. Make sure you have completed key exchange with this user.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    setMessages([]);
    setError(null);
    
    const userId = String(user._id || user.id);
    const currentUserIdStr = String(currentUser?.id);
    
    // Check if trying to chat with self
    if (userId === currentUserIdStr) {
      setError('Cannot chat with yourself. Please select a different user.');
      setExchangeId(null);
      return;
    }
    
    console.log('Selecting user:', userId);
    console.log('Current user ID:', currentUserIdStr);
    console.log('Completed exchanges map:', completedExchanges);
    console.log('Available exchange IDs:', Object.keys(completedExchanges));
    
    // Try to find exchange ID automatically
    let userExchangeId = completedExchanges[userId];
    
    // If not found, try to find it by checking all available session keys
    if (!userExchangeId) {
      console.log('Exchange ID not in map, checking all session keys...');
      const availableSessionKeys = await getAllSessionKeyIds();
      
      // Try to find exchange by querying server for each session key
      for (const exchangeId of availableSessionKeys) {
        try {
          const exchangeRes = await api.get(`/key-exchange/${exchangeId}`);
          const exchange = exchangeRes.data.keyExchange;
          
          if (exchange) {
            const fromUserIdStr = String(exchange.fromUserId?._id || exchange.fromUserId);
            const toUserIdStr = String(exchange.toUserId?._id || exchange.toUserId);
            
            // Skip self-exchanges
            if (fromUserIdStr === toUserIdStr) {
              continue;
            }
            
            // Check if this exchange is with the selected user
            if ((fromUserIdStr === currentUserIdStr && toUserIdStr === userId) ||
                (toUserIdStr === currentUserIdStr && fromUserIdStr === userId)) {
              // Found a matching exchange!
              userExchangeId = exchangeId;
              console.log('✅ Found matching exchange:', exchangeId);
              // Update the map for future use
              setCompletedExchanges(prev => ({ ...prev, [userId]: exchangeId }));
              break;
            }
          }
        } catch (err) {
          // Exchange not found (might be expired) or error, continue to next
          console.log(`Exchange ${exchangeId} not found in database (might be expired)`);
          continue;
        }
      }
    }
    
    if (userExchangeId) {
      // Found exchange ID
      try {
        // Verify session key exists
        await getSessionKey(userExchangeId);
        setExchangeId(userExchangeId);
        // Store it for future use
        localStorage.setItem(`exchangeId_${userId}`, userExchangeId);
        console.log('✅ Exchange ID found and session key verified:', userExchangeId);
      } catch (error) {
        // Session key not found in IndexedDB
        console.error('Session key not found for exchange:', userExchangeId, error);
        setError('Session key not found. Please complete key exchange again with this user.');
        setExchangeId(null);
      }
    } else {
      // Check localStorage as fallback
      const storedExchangeId = localStorage.getItem(`exchangeId_${userId}`);
      if (storedExchangeId) {
        try {
          await getSessionKey(storedExchangeId);
          setExchangeId(storedExchangeId);
          console.log('✅ Exchange ID found in localStorage:', storedExchangeId);
        } catch (error) {
          // No exchange found - prompt user
          console.error('Session key not found in localStorage:', error);
          setError('No key exchange found. Please complete key exchange with this user first.');
          setExchangeId(null);
        }
      } else {
        // No exchange found at all
        console.log('❌ No exchange ID found for user:', userId);
        setError(`No key exchange found with ${user.username}. Please complete key exchange first using the "Test Key Exchange" page.`);
        setExchangeId(null);
      }
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedUser || !exchangeId || !currentUser) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const currentUserId = String(currentUser.id || currentUser._id);
      const selectedUserId = String(selectedUser._id || selectedUser.id);
      
      console.log('Sending message:', { currentUserId, selectedUserId, exchangeId });
      
      // Send encrypted message
      await sendEncryptedMessage(
        currentUserId,
        selectedUserId,
        messageInput,
        exchangeId
      );
      
      // Clear input
      setMessageInput('');
      
      // Reload messages to show the new one
      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    window.location.href = '/login';
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>🔒 Secure E2EE Messaging</h2>
        <div className="user-info">
          <span>User: {currentUser?.username || 'Loading...'}</span>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </div>
      
      <div className="chat-main">
        <div className="sidebar">
          <h3>Users</h3>
          <div className="user-list">
            {users.filter(user => String(user._id) !== String(currentUser?.id)).map(user => {
              const userId = String(user._id);
              const hasExchange = completedExchanges[userId];
              return (
                <div
                  key={user._id}
                  className={`user-item ${selectedUser?._id === user._id ? 'selected' : ''}`}
                  onClick={() => handleSelectUser(user)}
                >
                  <div className="user-avatar">{user.username[0].toUpperCase()}</div>
                  <div className="user-details">
                    <div className="user-name">
                      {user.username}
                      {hasExchange && <span className="encryption-indicator">🔒</span>}
                    </div>
                    <div className="user-status">
                      {hasExchange ? 'Ready to chat' : 'Complete key exchange first'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="chat-area">
          {selectedUser ? (
            <>
              <div className="chat-header-bar">
                <h3>Chat with {selectedUser.username}</h3>
                {exchangeId && <span className="encryption-badge">🔒 Encrypted</span>}
                {!exchangeId && <span className="warning-badge">⚠️ No session key</span>}
              </div>
              
              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}
              
              <div className="messages-container">
                {loading && messages.length === 0 ? (
                  <div className="loading">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="no-messages">No messages yet. Start the conversation!</div>
                ) : (
                  <div className="messages">
                    {messages.map((msg, index) => (
                      <div
                        key={msg._id || index}
                        className={`message ${msg.isOwn ? 'own' : 'other'}`}
                      >
                        <div className="message-header">
                          <span className="message-sender">
                            {msg.isOwn ? 'You' : msg.fromUserId?.username || 'Unknown'}
                          </span>
                          <span className="message-time">
                            {new Date(msg.timestamp || msg.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="message-content">
                          {msg.decryptionError ? (
                            <span className="error-text">{msg.plaintext}</span>
                          ) : (
                            <span>{msg.plaintext}</span>
                          )}
                        </div>
                        {!msg.decryptionError && (
                          <div className="message-meta">
                            <small>🔒 Encrypted with AES-256-GCM</small>
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
              
              <form className="message-input-form" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  className="message-input"
                  placeholder={exchangeId ? "Type a message..." : "Complete key exchange first"}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  disabled={!exchangeId || loading}
                />
                <button 
                  type="submit" 
                  className="btn-send"
                  disabled={!exchangeId || loading || !messageInput.trim()}
                >
                  {loading ? 'Sending...' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            <div className="no-selection">
              <p>Select a user from the sidebar to start chatting</p>
              <p className="hint">💡 Make sure you've completed key exchange with the user first!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
