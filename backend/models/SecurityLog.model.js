import mongoose from 'mongoose';

const securityLogSchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: [
      'AUTH_ATTEMPT',
      'AUTH_SUCCESS',
      'AUTH_FAILURE',
      'KEY_EXCHANGE_INITIATE',
      'KEY_EXCHANGE_RESPOND',
      'KEY_EXCHANGE_COMPLETE',
      'KEY_EXCHANGE_FAILED',
      'DECRYPTION_SUCCESS',
      'DECRYPTION_FAILURE',
      'REPLAY_ATTACK_DETECTED',
      'MESSAGE_SENT',
      'MESSAGE_RECEIVED',
      'INVALID_NONCE',
      'INVALID_TIMESTAMP',
      'INVALID_SEQUENCE',
      'ATTACK_DEMO_MITM',
      'ATTACK_DEMO_REPLAY'
    ],
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'],
    default: 'INFO',
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
  },
  username: {
    type: String,
    required: false,
    index: true
  },
  ipAddress: {
    type: String,
    required: false
  },
  userAgent: {
    type: String,
    required: false
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    required: false // Store additional context (exchangeId, messageId, error messages, etc.)
  },
  success: {
    type: Boolean,
    default: true,
    index: true
  },
  errorMessage: {
    type: String,
    required: false
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
securityLogSchema.index({ eventType: 1, timestamp: -1 });
securityLogSchema.index({ userId: 1, timestamp: -1 });
securityLogSchema.index({ severity: 1, timestamp: -1 });
securityLogSchema.index({ success: 1, timestamp: -1 });

export default mongoose.model('SecurityLog', securityLogSchema);


