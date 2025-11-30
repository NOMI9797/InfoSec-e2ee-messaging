import { useState } from 'react';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');

  // Placeholder - will be implemented in Phase 4
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    
    // Will be implemented in Phase 4
    console.log('Sending message:', messageInput);
    alert('Message sending will be implemented in Phase 4');
    setMessageInput('');
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Secure E2EE Messaging</h2>
        <div className="user-info">
          <span>User: [Username]</span>
          <button className="btn-logout">Logout</button>
        </div>
      </div>
      
      <div className="chat-main">
        <div className="sidebar">
          <h3>Conversations</h3>
          <div className="conversation-list">
            <p className="placeholder-text">Conversations will appear here</p>
          </div>
        </div>
        
        <div className="chat-area">
          <div className="messages-container">
            <div className="messages">
              <p className="placeholder-text">
                Messages will appear here. End-to-end encryption will be implemented in Phase 4.
              </p>
            </div>
          </div>
          
          <form className="message-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              className="message-input"
              placeholder="Type a message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
            />
            <button type="submit" className="btn-send">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;

