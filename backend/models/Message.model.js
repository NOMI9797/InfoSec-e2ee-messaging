import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  toUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  exchangeId: {
    type: String,
    required: false,
    index: true // Index for faster lookup by exchange
  },
  // Replay protection fields
  sequenceNumber: {
    type: Number,
    required: false,
    index: true
  },
  nonce: {
    type: String,
    required: false,
    index: true
  },
  // Encrypted message components (server cannot decrypt)
  ciphertext: {
    type: String,
    required: true
  },
  iv: {
    type: String,
    required: true // Initialization vector (random per message)
  },
  tag: {
    type: String,
    required: true // Authentication tag (AES-GCM)
  },
  // Metadata only (not encrypted, but useful for UI)
  messageType: {
    type: String,
    enum: ['text', 'file'],
    default: 'text'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Optional: File metadata (if messageType is 'file')
  fileName: {
    type: String,
    required: false
  },
  fileSize: {
    type: Number,
    required: false
  },
  fileType: {
    type: String,
    required: false
  },
  totalChunks: {
    type: Number,
    required: false // Number of chunks for file messages
  },
  // Status tracking
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  readAt: {
    type: Date,
    required: false
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Index for efficient querying
messageSchema.index({ fromUserId: 1, toUserId: 1, timestamp: -1 });
messageSchema.index({ toUserId: 1, status: 1 });

export default mongoose.model('Message', messageSchema);

