import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';
import { logAuthAttempt, logSecurityEvent, extractRequestInfo } from '../utils/securityLogger.js';

// Register new user
export const register = async (req, res) => {
  try {
    const { username, password, publicKey } = req.body;

    // Validation
    if (!username || !password || !publicKey) {
      return res.status(400).json({ 
        success: false,
        error: 'Username, password, and public key are required' 
      });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ 
        success: false,
        error: 'Username must be between 3 and 30 characters' 
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ 
        success: false,
        error: 'Password must be at least 8 characters long' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ 
        success: false,
        error: 'Username already exists' 
      });
    }

    // Hash password with bcrypt (salt rounds: 10)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create new user
    const user = new User({
      username,
      passwordHash,
      // salt not needed - bcrypt handles it internally
      publicKey: publicKey // Store the public key in SPKI format
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key-change-this',
      { expiresIn: '7d' }
    );

    // Log successful registration
    await logSecurityEvent({
      eventType: 'AUTH_ATTEMPT',
      severity: 'INFO',
      userId: user._id,
      username: user.username,
      ...extractRequestInfo(req),
      success: true,
      details: { action: 'register' }
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        publicKey: user.publicKey
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Registration failed. Please try again.' 
    });
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Username and password are required' 
      });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      // Log failed login attempt
      await logAuthAttempt(req, username, false, 'User not found');
      return res.status(401).json({ 
        success: false,
        error: 'Invalid username or password' 
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      // Log failed login attempt
      await logAuthAttempt(req, username, false, 'Invalid password');
      return res.status(401).json({ 
        success: false,
        error: 'Invalid username or password' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key-change-this',
      { expiresIn: '7d' }
    );

    // Log successful login
    await logAuthAttempt(req, username, true);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        publicKey: user.publicKey
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Login failed. Please try again.' 
    });
  }
};
