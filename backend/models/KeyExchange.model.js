import mongoose from 'mongoose';

const keyExchangeSchema = new mongoose.Schema({
  exchangeId: {
    type: String,
    required: true,
    unique: true
  },
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  initiatorEphemeralPublicKey: {
    type: String,
    required: true
  },
  responderEphemeralPublicKey: {
    type: String,
    required: false
  },
  initiatorSignature: {
    type: String,
    required: true
  },
  responderSignature: {
    type: String,
    required: false
  },
  keyConfirmation: {
    type: String,
    required: false
  },
  nonce: {
    type: String,
    required: true
  },
  responseNonce: {
    type: String,
    required: false
  },
  timestamp: {
    type: Number,
    required: true
  },
  responseTimestamp: {
    type: Number,
    required: false
  },
  status: {
    type: String,
    enum: ['pending', 'responded', 'confirmed', 'completed', 'expired'],
    default: 'pending'
  },
  confirmed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600 // Expire after 1 hour
  },
  completedAt: {
    type: Date,
    required: false
  }
});

export default mongoose.model('KeyExchange', keyExchangeSchema);

