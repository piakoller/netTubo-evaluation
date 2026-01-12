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

  // Detailed Yes/No Questions - Category 1: Evidence Retrieval
  guideline_found: { type: String, enum: ['yes', 'no'] },
  cites_primary_study: { type: String, enum: ['yes', 'no'] },
  acknowledges_new_data: { type: String, enum: ['yes', 'no', 'not_relevant'] },
  citations_real: { type: String, enum: ['yes', 'no'] },
  
  // Category 2: Clinical Soundness and Safety
  clinical_appropriateness: { type: String, enum: ['yes', 'no'] },
  contraindication_awareness: { type: String, enum: ['yes', 'no'] },
  treatment_completeness: { type: String, enum: ['yes', 'no'] },
  notes_guideline_evidence_conflict: { type: String, enum: ['yes', 'no'] },
  
  // Category 3: Actionability and Patient-Centeredness
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
  const { patientId, evaluation_type, recommendation_type } = evaluationData;
  
  // Find existing evaluation for this patient AND recommendation type
  const existingEvalIndex = this.patientEvaluations.findIndex(
    evaluation => evaluation.patientId === patientId && evaluation.recommendation_type === recommendation_type
  );

  if (evaluation_type === 'expert_recommendation') {
    // This is an expert evaluation - find the main evaluation first
    const mainEvalIndex = this.patientEvaluations.findIndex(
      evaluation => evaluation.patientId === patientId && evaluation.recommendation_type === recommendation_type
    );
    
    if (mainEvalIndex === -1) {
      throw new Error(`Cannot add expert evaluation: No main evaluation found for patient ${patientId} with type ${recommendation_type}`);
    }
    
    // Update the existing patient evaluation with expert data
    const expertData = evaluationData.expertData;
    if (expertData.evaluationStartTime && expertData.evaluationEndTime) {
      expertData.timeSpentSeconds = Math.round(
        (new Date(expertData.evaluationEndTime) - new Date(expertData.evaluationStartTime)) / 1000
      );
    }
    expertData.submittedAt = new Date();
    
    this.patientEvaluations[mainEvalIndex].expertEvaluation = expertData;
    console.log(`🔄 Updated patient ${patientId} (${recommendation_type}) evaluation with expert feedback`);
    
  } else {
    // This is a main evaluation
    if (existingEvalIndex !== -1) {
      // Patient evaluation already exists - user is updating their evaluation
      console.log(`🔄 Updating evaluation for patient ${patientId} (${recommendation_type})`);
      
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
      console.log(`➕ Added new evaluation for patient ${patientId} (${recommendation_type})`);
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
