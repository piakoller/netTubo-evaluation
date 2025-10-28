const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  evaluationId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, ref: 'User', index: true },
  patientId: { type: String, required: true, index: true },

  // Determines if this is a main evaluation or an expert one
  evaluation_type: { type: String, enum: ['main', 'expert_recommendation'], default: 'main' },
  
  // For main evaluations
  recommendation_type: { type: String, enum: ['agentic', 'baseline'] }, // Which AI was evaluated
  overallRating: { type: Number, min: 1, max: 10 },
  implementationWillingness: { type: String, enum: ['yes', 'maybe', 'no'] },
  comments: { type: String, default: '' },

  // Detailed Yes/No Questions
  guideline_adherence: { type: String, enum: ['yes', 'no'] },
  clinical_trial_integration: { type: String, enum: ['yes', 'no'] },
  diagnostic_soundness: { type: String, enum: ['yes', 'no'] },
  clinical_appropriateness: { type: String, enum: ['yes', 'no'] },
  contraindication_awareness: { type: String, enum: ['yes', 'no'] },
  treatment_completeness: { type: String, enum: ['yes', 'no'] },
  rationale_clarity: { type: String, enum: ['yes', 'no'] },
  risk_benefit_transparency: { type: String, enum: ['yes', 'no'] },
  consideration_alternatives: { type: String, enum: ['yes', 'no'] },
  actionable_next_steps: { type: String, enum: ['yes', 'no'] },
  personalization: { type: String, enum: ['yes', 'no'] },
  quality_of_life: { type: String, enum: ['yes', 'no'] },

  // For expert recommendation evaluations
  expert_agreement: { type: String, enum: ['strongly_agree', 'agree', 'neutral', 'disagree', 'strongly_disagree'] },
  expert_comments: { type: String, default: '' },

  // Additional metadata
  userData: { userId: String, profession: String, yearsExperience: Number },
  
  // Time tracking
  evaluationStartTime: Date,
  evaluationEndTime: { type: Date, default: Date.now },
  timeSpentSeconds: Number,
  
  // System metadata
  ipAddress: String,
  userAgent: String,
  sessionId: String
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Make certain fields required only for 'main' evaluation type
evaluationSchema.path('overallRating').required(function() { return this.evaluation_type === 'main'; }, 'Overall rating is required.');
evaluationSchema.path('implementationWillingness').required(function() { return this.evaluation_type === 'main'; }, 'Implementation willingness is required.');

// Make certain fields required only for 'expert_recommendation' evaluation type
evaluationSchema.path('expert_agreement').required(function() { return this.evaluation_type === 'expert_recommendation'; }, 'Expert agreement is required.');


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