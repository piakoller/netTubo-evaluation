const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  // Note: evaluationId is indexed below with a partial filter so documents
  // that don't have this field (e.g., UserEvaluationSession documents)
  // won't violate the unique constraint.
  evaluationId: { type: String, required: true },
  userId: { type: String, required: true, ref: 'User', index: true },
  patientId: { type: String, required: true, index: true },

  // Determines if this is a main evaluation or an expert one
  evaluation_type: { type: String, enum: ['main', 'expert_recommendation'], default: 'main' },
  
  // For main evaluations
  recommendation_type: { type: String, enum: ['agentic', 'baseline'] }, // Which AI was evaluated
  overallRating: { type: Number, min: 1, max: 10 },
  implementationWillingness: { type: String, enum: ['yes', 'maybe', 'no'] },
  comments: { type: String, default: '' },


  // Category 1: Evidence Retrieval
  guideline_found: { type: String, enum: ['yes', 'no'] }, // Has the chatbot found and included at least one relevant guideline?
  cites_primary_study: { type: String, enum: ['yes', 'no'] }, // Does the answer cite at least one peer-reviewed primary study?
  acknowledges_new_data: { type: String, enum: ['yes', 'no'] }, // If newer data exist, does the answer acknowledge them?
  citations_real: { type: String, enum: ['yes', 'no'] }, // Do all citations correspond to real, retrievable sources?

  // Category 2: Clinical Soundness and Safety
  clinical_appropriateness: { type: String, enum: ['yes', 'no'] }, // Is the primary recommended therapy suitable for the patient?
  contraindication_awareness: { type: String, enum: ['yes', 'no'] }, // Does the recommendation avoid contraindicated treatments?
  treatment_completeness: { type: String, enum: ['yes', 'no'] }, // Does the recommendation address all necessary modalities?
  notes_guideline_evidence_conflict: { type: String, enum: ['yes', 'no'] }, // If guidelines conflict with new evidence, does the answer note it?

  // Category 3: Actionability and Patient-Centeredness
  actionable_next_steps: { type: String, enum: ['yes', 'no'] }, // Does the recommendation define clear next steps?
  personalization: { type: String, enum: ['yes', 'no'] }, // Is the plan tailored to patient-specific factors?
  quality_of_life: { type: String, enum: ['yes', 'no'] }, // Does the recommendation address quality of life?

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
// Create a unique index on evaluationId but only for documents where it exists
evaluationSchema.index(
  { evaluationId: 1 },
  { unique: true, partialFilterExpression: { evaluationId: { $type: 'string' } } }
);

module.exports = mongoose.model('Evaluation', evaluationSchema);