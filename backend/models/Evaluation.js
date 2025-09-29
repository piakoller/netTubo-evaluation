const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  evaluationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    ref: 'User',
    index: true
  },
  patientId: {
    type: String,
    required: true,
    index: true
  },
  // User's evaluation responses
  overallRating: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  implementationWillingness: {
    type: String,
    required: true,
    enum: ['yes', 'maybe', 'no']
  },
  comments: {
    type: String,
    default: ''
  },
  // Additional metadata
  userData: {
    userId: String,
    profession: String,
    yearsExperience: Number
  },
  // Time tracking
  evaluationStartTime: Date,
  evaluationEndTime: {
    type: Date,
    default: Date.now
  },
  timeSpentSeconds: Number,
  
  // System metadata
  ipAddress: String,
  userAgent: String,
  sessionId: String
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Calculate time spent before saving
evaluationSchema.pre('save', function(next) {
  if (this.evaluationStartTime && this.evaluationEndTime) {
    this.timeSpentSeconds = Math.round((this.evaluationEndTime - this.evaluationStartTime) / 1000);
  }
  next();
});

// Indexes for efficient querying
evaluationSchema.index({ userId: 1, patientId: 1 });
evaluationSchema.index({ createdAt: -1 });
evaluationSchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model('Evaluation', evaluationSchema);