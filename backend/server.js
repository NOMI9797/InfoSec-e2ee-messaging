import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import keyExchangeRoutes from './routes/keyExchange.routes.js';
import messageRoutes from './routes/message.routes.js';
import errorHandler from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001; // Changed from 5000 to avoid AirPlay conflict

// CORS Configuration - Allow all origins in development
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  optionsSuccessStatus: 204
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/key-exchange', keyExchangeRoutes);
app.use('/api/messages', messageRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use(errorHandler);

// Start server (MongoDB connection will be attempted but won't block server start)
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  
  // Attempt to connect to MongoDB
  connectDB()
    .then(() => {
      console.log('✅ MongoDB connection successful');
    })
    .catch((error) => {
      console.error('⚠️  MongoDB connection failed:', error.message);
      console.error('⚠️  Server is running but database features will not work');
      console.error('💡 To fix: Start MongoDB or update MONGODB_URI in .env file');
    });
});

export default app;

