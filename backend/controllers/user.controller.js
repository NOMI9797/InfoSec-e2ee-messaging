import User from '../models/User.model.js';

// Get all users (for chat user list)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('username _id createdAt')
      .sort({ username: 1 });

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve users'
    });
  }
};

// Get user's public key
export const getPublicKey = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('username publicKey publicKeyFormat');
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      publicKey: user.publicKey,
      publicKeyFormat: user.publicKeyFormat,
      username: user.username
    });
  } catch (error) {
    console.error('Get public key error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve public key' 
    });
  }
};

// Get public key by username
export const getPublicKeyByUsername = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username }).select('username publicKey publicKeyFormat');
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      publicKey: user.publicKey,
      publicKeyFormat: user.publicKeyFormat,
      username: user.username
    });
  } catch (error) {
    console.error('Get public key by username error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve public key' 
    });
  }
};

