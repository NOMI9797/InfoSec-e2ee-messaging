import mongoose from 'mongoose';

/**
 * Tracks sequence numbers and nonces for replay protection
 * One document per user pair (exchangeId)
 */
const messageSequenceSchema = new mongoose.Schema({
  exchangeId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
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
  // Sequence numbers for each direction
  sequenceFromTo: {
    type: Number,
    default: 0
  },
  sequenceToFrom: {
    type: Number,
    default: 0
  },
  // Track used nonces to prevent replay attacks
  usedNonces: [{
    nonce: String,
    timestamp: Date,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Track used timestamps (within a time window)
  recentTimestamps: [{
    timestamp: Number,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient lookup
messageSequenceSchema.index({ exchangeId: 1 });
messageSequenceSchema.index({ fromUserId: 1, toUserId: 1 });

// Cleanup old nonces and timestamps (older than 1 hour)
messageSequenceSchema.methods.cleanupOldEntries = async function() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  this.usedNonces = this.usedNonces.filter(
    entry => entry.createdAt > oneHourAgo
  );
  
  this.recentTimestamps = this.recentTimestamps.filter(
    entry => entry.createdAt > oneHourAgo
  );
  
  await this.save();
};

export default mongoose.model('MessageSequence', messageSequenceSchema);


