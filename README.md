# Secure End-to-End Encrypted Messaging & File-Sharing System

## Project Overview
A secure communication system that provides end-to-end encryption (E2EE) for text messaging and file sharing, ensuring that messages and files never exist in plaintext outside the sender or receiver device.

## Tech Stack

### Frontend
- React.js (Vite)
- Web Crypto API (SubtleCrypto)
- IndexedDB for key storage
- Axios for HTTP requests
- Socket.io-client for real-time communication

### Backend
- Node.js + Express
- MongoDB
- Socket.io (optional)
- bcrypt for password hashing

## Project Structure

```
InfoSec/
├── frontend/          # React frontend application
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components (Login, Register, Chat)
│   │   ├── services/     # API services
│   │   ├── utils/        # Utility functions
│   │   ├── crypto/       # Cryptographic functions (Phase 2+)
│   │   └── hooks/        # Custom React hooks
│   └── package.json
│
├── backend/           # Node.js backend server
│   ├── routes/        # API routes
│   ├── models/        # MongoDB models
│   ├── controllers/   # Route controllers
│   ├── middleware/    # Express middleware
│   ├── utils/         # Utility functions
│   ├── config/        # Configuration files
│   └── package.json
│
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Update `.env` with your MongoDB connection string:
```
MONGODB_URI=mongodb://localhost:27017/e2ee-messaging
PORT=5000
FRONTEND_URL=http://localhost:5173
```

5. Start the server:
```bash
npm run dev
```

The server will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (optional):
```
VITE_API_URL=http://localhost:5000/api
```

4. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## Development Status

### Phase 1: Project Setup & Infrastructure ✅
- [x] React frontend initialized
- [x] Node.js backend initialized
- [x] MongoDB connection setup
- [x] Basic folder structure
- [x] UI components (Login, Register, Chat layout)
- [x] Git repository structure

### Phase 2: User Authentication & Key Management (Next)
- [ ] User registration with password hashing
- [ ] User login
- [ ] Client-side key generation (RSA/ECC)
- [ ] Secure key storage (IndexedDB)

### Phase 3-9: To be implemented
See project documentation for full phase breakdown.

## Important Notes

- **Private keys are NEVER stored on the server** - only on client devices
- **No plaintext storage** - all messages/files are encrypted before storage
- **Web Crypto API only** - no third-party E2EE libraries
- **HTTPS required** - all communication must use HTTPS

## Security Features (To be implemented)

- End-to-end encryption (AES-256-GCM)
- Secure key exchange protocol (DH/ECDH)
- Replay attack protection
- MITM attack prevention
- Comprehensive security logging

## License

This project is for educational purposes as part of Information Security course.

