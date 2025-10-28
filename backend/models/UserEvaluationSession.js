const mongoose = require('mongoose');

// Schema for individual patient evaluation
const patientEvaluationSchema = new mongoose.Schema({
  patientId: { type: String, required: true },
  evaluationId: { type: String, required: true },
  
  // Main evaluation fields
  recommendation_type: { type: String, enum: ['agentic', 'baseline'] },
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

  // Expert recommendation evaluation (part of the same entry)
  expertEvaluation: {
    evaluationId: { type: String },
    expert_agreement: { type: String, enum: ['strongly_agree', 'agree', 'neutral', 'disagree', 'strongly_disagree'] },
    expert_comments: { type: String, default: '' },
    evaluationStartTime: { type: Date },
    evaluationEndTime: { type: Date },
    timeSpentSeconds: { type: Number },
    submittedAt: { type: Date }
  },

  // Time tracking for main evaluation
  evaluationStartTime: { type: Date },
  evaluationEndTime: { type: Date },
  timeSpentSeconds: { type: Number },
  
  // Submission timestamp for main evaluation
  submittedAt: { type: Date, default: Date.now }
}, { _id: false }); // Don't create separate _id for subdocuments

// Main schema for user evaluation session
const userEvaluationSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  
  // User information
  userData: {
    userId: String,
    profession: String,
    yearsExperience: Number
  },
  
  // Array of all patient evaluations for this user
  patientEvaluations: [patientEvaluationSchema],
  
  // Session metadata
  sessionStart: { type: Date, default: Date.now },
  sessionEnd: { type: Date },
  
  // System metadata
  ipAddress: String,
  userAgent: String,
  sessionId: String
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Method to add or update a patient evaluation
userEvaluationSessionSchema.methods.addOrUpdatePatientEvaluation = function(evaluationData) {
  const { patientId, evaluation_type } = evaluationData;
  
  // Find existing evaluation for this patient
  const existingEvalIndex = this.patientEvaluations.findIndex(
    evaluation => evaluation.patientId === patientId
  );

  if (evaluation_type === 'expert_recommendation') {
    // This is an expert evaluation
    if (existingEvalIndex === -1) {
      throw new Error(`Cannot add expert evaluation: No main evaluation found for patient ${patientId}`);
    }
    
    // Update the existing patient evaluation with expert data
    const expertData = evaluationData.expertData;
    if (expertData.evaluationStartTime && expertData.evaluationEndTime) {
      expertData.timeSpentSeconds = Math.round(
        (new Date(expertData.evaluationEndTime) - new Date(expertData.evaluationStartTime)) / 1000
      );
    }
    expertData.submittedAt = new Date();
    
    this.patientEvaluations[existingEvalIndex].expertEvaluation = expertData;
    console.log(`🔄 Updated patient ${patientId} evaluation with expert feedback`);
    
  } else {
    // This is a main evaluation
    if (existingEvalIndex !== -1) {
      // Patient evaluation already exists - this shouldn't normally happen
      console.warn(`⚠️ Main evaluation for patient ${patientId} already exists, updating...`);
      
      // Calculate time spent
      if (evaluationData.evaluationStartTime && evaluationData.evaluationEndTime) {
        evaluationData.timeSpentSeconds = Math.round(
          (new Date(evaluationData.evaluationEndTime) - new Date(evaluationData.evaluationStartTime)) / 1000
        );
      }
      
      // Update existing evaluation (preserve expertEvaluation if it exists)
      const existingExpertEval = this.patientEvaluations[existingEvalIndex].expertEvaluation;
      this.patientEvaluations[existingEvalIndex] = {
        ...evaluationData,
        expertEvaluation: existingExpertEval
      };
    } else {
      // Add new patient evaluation
      if (evaluationData.evaluationStartTime && evaluationData.evaluationEndTime) {
        evaluationData.timeSpentSeconds = Math.round(
          (new Date(evaluationData.evaluationEndTime) - new Date(evaluationData.evaluationStartTime)) / 1000
        );
      }
      
      this.patientEvaluations.push(evaluationData);
      console.log(`➕ Added new evaluation for patient ${patientId}`);
    }
  }
  
  this.sessionEnd = new Date();
  return this.save();
};

// Method to get evaluation for a specific patient
userEvaluationSessionSchema.methods.getPatientEvaluation = function(patientId) {
  return this.patientEvaluations.find(evaluation => evaluation.patientId === patientId);
};

// Method to get all main evaluations (that have been completed)
userEvaluationSessionSchema.methods.getMainEvaluations = function() {
  return this.patientEvaluations;
};

// Method to get all expert evaluations (that have been completed)
userEvaluationSessionSchema.methods.getExpertEvaluations = function() {
  return this.patientEvaluations
    .filter(evaluation => evaluation.expertEvaluation && evaluation.expertEvaluation.expert_agreement)
    .map(evaluation => ({
      patientId: evaluation.patientId,
      ...evaluation.expertEvaluation
    }));
};

// Indexes for efficient querying
userEvaluationSessionSchema.index({ 'patientEvaluations.patientId': 1 });
userEvaluationSessionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('UserEvaluationSession', userEvaluationSessionSchema, 'evaluations');
