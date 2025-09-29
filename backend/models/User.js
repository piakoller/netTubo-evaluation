const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  profession: {
    type: String,
    required: true
  },
  yearsExperience: {
    type: Number,
    required: true
  },
  sessionStart: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  completedEvaluations: [{
    type: String // Array of patient IDs
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Update lastActivity on every save
userSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  next();
});

module.exports = mongoose.model('User', userSchema);