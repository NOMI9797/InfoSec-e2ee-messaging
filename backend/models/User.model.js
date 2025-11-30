import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  passwordHash: {
    type: String,
    required: true
  },
  salt: {
    type: String,
    required: false // bcrypt handles salt internally, not needed
  },
  publicKey: {
    type: String,
    required: true // Public key is required for E2EE
  },
  publicKeyFormat: {
    type: String,
    enum: ['spki', 'jwk'],
    default: 'spki'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('User', userSchema);

