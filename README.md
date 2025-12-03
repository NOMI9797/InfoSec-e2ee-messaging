# Secure End-to-End Encrypted Messaging & File-Sharing System

A secure communication system that provides true end-to-end encryption (E2EE) for text messaging and file sharing. Messages and files are encrypted on the client device and can only be decrypted by the intended recipient. The server cannot decrypt or view any user content.

## 🚀 Features

- **End-to-End Encryption**: AES-256-GCM encryption for messages and files
- **Secure Key Exchange**: ECDH-based key exchange with RSA digital signatures
- **Encrypted File Sharing**: Client-side file encryption with chunking support
- **Replay Attack Protection**: Nonces, timestamps, and sequence numbers
- **MITM Attack Prevention**: Digital signatures on key exchange messages
- **Security Logging**: Comprehensive audit trail of all security events
- **Client-Side Key Storage**: Private keys stored only in IndexedDB (never on server)

## 🛠️ Tech Stack

### Frontend
- **React.js** (Vite) - UI framework
- **Web Crypto API** - Cryptographic operations
- **IndexedDB** - Client-side key storage
- **Axios** - HTTP client
- **React Router** - Navigation

### Backend
- **Node.js** + **Express** - Server framework
- **MongoDB** + **Mongoose** - Database and ODM
- **bcrypt** - Password hashing
- **JWT** - Authentication tokens

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **MongoDB** (local installation or MongoDB Atlas account)

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd InfoSec
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file
touch .env
```

Add the following to `backend/.env`:

```env
MONGODB_URI=mongodb://localhost:27017/e2ee-messaging
PORT=3001
JWT_SECRET=your-secret-key-change-this-in-production
FRONTEND_URL=http://localhost:5173
```

**For MongoDB Atlas:**
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/e2ee-messaging?retryWrites=true&w=majority
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install

# Create .env file (optional)
touch .env
```

Add the following to `frontend/.env` (optional, defaults are used if not set):

```env
VITE_API_URL=http://localhost:3001/api
```

## 🚀 Running the Application

### Start MongoDB

**Local MongoDB:**
```bash
# macOS (using Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
net start MongoDB
```

**MongoDB Atlas:** No local setup needed, just use your connection string.

### Start Backend Server

```bash
cd backend
npm run dev
```

The backend server will run on `http://localhost:3001`

### Start Frontend Development Server

```bash
cd frontend
npm run dev
```

The frontend will run on `http://localhost:5173`

Open your browser and navigate to `http://localhost:5173`

## 📁 Project Structure

```
InfoSec/
├── backend/                 # Node.js backend
│   ├── config/             # Configuration files
│   │   └── database.js     # MongoDB connection
│   ├── controllers/        # Route controllers
│   │   ├── auth.controller.js
│   │   ├── keyExchange.controller.js
│   │   ├── message.controller.js
│   │   ├── securityLog.controller.js
│   │   └── user.controller.js
│   ├── middleware/         # Express middleware
│   │   ├── errorHandler.js
│   │   └── replayProtection.js
│   ├── models/            # MongoDB models
│   │   ├── User.model.js
│   │   ├── Message.model.js
│   │   ├── KeyExchange.model.js
│   │   ├── SecurityLog.model.js
│   │   └── MessageSequence.model.js
│   ├── routes/            # API routes
│   │   ├── auth.routes.js
│   │   ├── keyExchange.routes.js
│   │   ├── message.routes.js
│   │   ├── securityLog.routes.js
│   │   └── user.routes.js
│   ├── utils/             # Utility functions
│   │   └── securityLogger.js
│   ├── server.js          # Express server
│   └── package.json
│
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Chat.jsx
│   │   │   ├── SecurityLogs.jsx
│   │   │   └── AttackDemo.jsx
│   │   ├── services/      # API services
│   │   │   └── api.js
│   │   ├── utils/         # Utility functions
│   │   │   ├── crypto.js          # Encryption/decryption
│   │   │   ├── keyExchange.js     # Key exchange protocol
│   │   │   ├── keyStorage.js      # IndexedDB operations
│   │   │   ├── messageUtils.js    # Message handling
│   │   │   └── sequenceManager.js # Replay protection
│   │   ├── App.jsx        # Main app component
│   │   └── main.jsx       # Entry point
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

## 🔐 Security Features

### Encryption
- **AES-256-GCM** for message and file encryption
- **Random IV** (96 bits) per message/chunk
- **Authentication tags** (128 bits) for integrity verification

### Key Exchange
- **ECDH** (P-256) for ephemeral key pairs
- **RSA-PSS** digital signatures for authenticity
- **HKDF** (SHA-256) for session key derivation
- **HMAC** key confirmation

### Key Storage
- **Private keys**: Stored only in IndexedDB (client-side)
- **Session keys**: Stored in IndexedDB, indexed by exchangeId
- **Public keys**: Stored in MongoDB (server-side)

### Attack Prevention
- **MITM Protection**: RSA digital signatures on key exchange
- **Replay Protection**: Nonces, timestamps, sequence numbers
- **Message Tampering**: AES-GCM authentication tags

### Security Logging
- Authentication attempts
- Key exchange events
- Message operations
- Replay attack detection
- Decryption failures

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:userId` - Get user by ID

### Key Exchange
- `POST /api/key-exchange/initiate` - Initiate key exchange
- `GET /api/key-exchange/pending/:userId` - Get pending exchanges
- `POST /api/key-exchange/respond` - Respond to key exchange
- `POST /api/key-exchange/confirm` - Confirm key exchange
- `GET /api/key-exchange/:exchangeId` - Get exchange details

### Messages
- `POST /api/messages/send` - Send encrypted message
- `GET /api/messages/:userId1/:userId2` - Get messages between users

### Security Logs
- `GET /api/security-logs` - Get security logs (with filters)
- `GET /api/security-logs/stats` - Get log statistics
- `GET /api/security-logs/:logId` - Get specific log
- `POST /api/security-logs/client-log` - Client-side logging

## 🔑 Key Exchange Protocol

1. **Initiation**: User A generates ephemeral ECDH key pair and sends public key with RSA signature
2. **Response**: User B verifies signature, generates own ECDH key pair, derives shared secret, creates key confirmation
3. **Confirmation**: User A verifies signature, derives shared secret, verifies key confirmation
4. **Session Key**: Both users derive same 256-bit AES-GCM session key using HKDF

See `KEY_EXCHANGE_PROTOCOL.txt` for detailed protocol flow.

## 🧪 Testing Security Features

### Attack Demonstrations

1. **MITM Attack Demo**: Navigate to `/attack-demo` and select "MITM Attack" tab
2. **Replay Attack Demo**: Navigate to `/attack-demo` and select "Replay Attack" tab
3. **Security Logs**: Navigate to `/security-logs` to view all security events

### Using BurpSuite

1. Configure browser proxy: `127.0.0.1:8080`
2. Install BurpSuite CA certificate
3. Intercept requests and modify to test security features

## 🐛 Troubleshooting

### MongoDB Connection Issues

**Error**: `MongoDB connection failed`

**Solutions**:
- Verify MongoDB is running: `mongosh` or check service status
- Check connection string in `.env` file
- For MongoDB Atlas: Verify network access and credentials
- Ensure firewall allows MongoDB port (27017)

### Port Already in Use

**Error**: `Port 3001 already in use`

**Solutions**:
- Change `PORT` in `backend/.env`
- Kill process using the port:
  ```bash
  # macOS/Linux
  lsof -ti:3001 | xargs kill -9
  
  # Windows
  netstat -ano | findstr :3001
  taskkill /PID <PID> /F
  ```

### Frontend Can't Connect to Backend

**Error**: `Network Error` or `CORS Error`

**Solutions**:
- Verify backend is running on correct port
- Check `VITE_API_URL` in `frontend/.env`
- Verify CORS settings in `backend/server.js`
- Check browser console for specific error

### IndexedDB Issues

**Error**: `Failed to open IndexedDB`

**Solutions**:
- Clear browser cache and IndexedDB
- Check browser console for specific errors
- Ensure browser supports IndexedDB
- Try in incognito/private mode

## 📝 Important Notes

- **Private keys are NEVER stored on the server** - only in IndexedDB (client-side)
- **No plaintext storage** - all messages/files encrypted before storage
- **Web Crypto API only** - no third-party E2EE libraries
- **HTTPS recommended** - for production deployment
- **Session keys expire** - after 24 hours (configurable)

## 👥 Team

[Add your team members and contributions here]

## 📄 License

This project is for educational purposes as part of Information Security course (BSSE - 7th Semester).

## 📚 Documentation

- `KEY_EXCHANGE_PROTOCOL.txt` - Detailed key exchange protocol
- `PROTOCOL_FLOW_DIAGRAM.txt` - Complete protocol flow diagram
- `SECURITY_VERIFICATION_GUIDE.txt` - Security feature verification

## 🤝 Contributing

This is an academic project. For questions or issues, contact the development team.

---

**Built with ❤️ for Information Security Course**
