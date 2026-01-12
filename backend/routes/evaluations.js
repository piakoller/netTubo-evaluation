const express = require('express');
const Evaluation = require('../models/Evaluation'); // Keep for backward compatibility
const UserEvaluationSession = require('../models/UserEvaluationSession');
const User = require('../models/User');
const router = express.Router();

// Submit a new evaluation (handles both main and expert evaluations)
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      patientId,
      evaluation_type = 'main', // Default to main evaluation
      userData,
      evaluationStartTime,
      // Main evaluation fields
      recommendation_type,
      overallRating,
      implementationWillingness,
      comments,
      // Detailed questions - Category 1: Evidence Retrieval
      guideline_found,
      cites_primary_study,
      acknowledges_new_data,
      citations_real,
      // Category 2: Clinical Soundness and Safety
      clinical_appropriateness,
      contraindication_awareness,
      treatment_completeness,
      notes_guideline_evidence_conflict,
      // Category 3: Actionability and Patient-Centeredness
      actionable_next_steps,
      personalization,
      quality_of_life,
      // Expert evaluation fields
      expert_agreement,
      expert_comments
    } = req.body;

    // --- Validation ---
    if (!userId || !patientId) {
      return res.status(400).json({ error: 'Missing required fields: userId, patientId' });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found', userId });
    }

    // --- Find or create user evaluation session ---
    let session = await UserEvaluationSession.findOne({ userId });
    
    if (!session) {
      // Create new session for this user (first evaluation)
      session = new UserEvaluationSession({
        userId,
        userData: userData || {
          userId: user.userId,
          profession: user.profession,
          yearsExperience: user.yearsExperience
        },
        sessionStart: new Date(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: req.sessionID || null,
        patientEvaluations: []
      });
      // Save the new session to the database
      await session.save();
      console.log(`📝 Created new evaluation session for user ${userId}`);
    } else {
      console.log(`📝 Found existing evaluation session for user ${userId} (currently has ${session.patientEvaluations.length} patient evaluations)`);
    }

    // --- Handle based on evaluation type ---
    const evaluationId = `EVAL_${evaluation_type === 'expert_recommendation' ? 'EXPERT_' : ''}${Date.now()}_${userId}_${patientId}`;
    
    let evaluationData;

    if (evaluation_type === 'expert_recommendation') {
      // This is an expert evaluation - package it for the nested structure
      evaluationData = {
        patientId,
        evaluation_type,
        expertData: {
          evaluationId,
          expert_agreement,
          expert_comments: expert_comments || '',
          evaluationStartTime: evaluationStartTime ? new Date(evaluationStartTime) : null,
          evaluationEndTime: new Date()
        }
      };
    } else {
      // This is a main evaluation
      evaluationData = {
        patientId,
        evaluationId,
        evaluation_type: 'main',
        recommendation_type,
        overallRating,
        implementationWillingness,
        comments,
        guideline_found,
        cites_primary_study,
        acknowledges_new_data,
        citations_real,
        clinical_appropriateness,
        contraindication_awareness,
        treatment_completeness,
        notes_guideline_evidence_conflict,
        actionable_next_steps,
        personalization,
        quality_of_life,
        evaluationStartTime: evaluationStartTime ? new Date(evaluationStartTime) : null,
        evaluationEndTime: new Date(),
        submittedAt: new Date()
      };
    }

    // --- Add or Update evaluation in session ---
    try {
      await session.addOrUpdatePatientEvaluation(evaluationData);
      console.log(`✅ Evaluation processed: ${evaluationId} (type: ${evaluation_type}) by ${userId} for patient ${patientId}`);
      console.log(`📊 User ${userId} now has ${session.patientEvaluations.length} total patient evaluations in their session`);
      console.log(`🔑 Session document ID: ${session._id}`);
    } catch (evalError) {
      console.error('❌ Error in addOrUpdatePatientEvaluation:', evalError);
      throw evalError;
    }

    // Update user's completed evaluations (only for main evals)
    if (evaluation_type === 'main' && !user.completedEvaluations.includes(patientId)) {
      user.completedEvaluations.push(patientId);
      await user.save();
    }

    res.status(201).json({
      message: 'Evaluation submitted successfully',
      evaluation: evaluationData,
      sessionId: session._id,
      totalEvaluationsInSession: session.patientEvaluations.length
    });

  } catch (error) {
    console.error('Error submitting evaluation:', error);
    // Provide more detailed validation error messages if available
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.message
      });
    }
    res.status(500).json({
      error: 'Failed to submit evaluation',
      details: error.message
    });
  }
});

// Get all evaluation sessions (optional: add admin protection)
router.get('/', async (req, res) => {
  try {
    const sessions = await UserEvaluationSession.find().sort({ createdAt: -1 });
    res.json({
      sessions,
      totalSessions: sessions.length,
      totalEvaluations: sessions.reduce((sum, s) => sum + s.patientEvaluations.length, 0)
    });
  } catch (error) {
    console.error('Error fetching evaluation sessions:', error);
    res.status(500).json({
      error: 'Failed to fetch evaluation sessions',
      details: error.message
    });
  }
});

// Get evaluation session for a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const session = await UserEvaluationSession.findOne({ userId });
    
    if (!session) {
      // User hasn't started any evaluations yet - this is normal, not an error
      return res.status(200).json({ 
        session: null,
        evaluationCount: 0
      });
    }
    
    res.json({
      session,
      evaluationCount: session.patientEvaluations.length
    });
  } catch (error) {
    console.error(`Error fetching evaluation session for user ${req.params.userId}:`, error);
    res.status(500).json({
      error: 'Failed to fetch user evaluation session',
      details: error.message
    });
  }
});

// Get evaluations for a specific patient across all users
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const sessions = await UserEvaluationSession.find({
      'patientEvaluations.patientId': patientId
    });
    
    // Extract just the evaluations for this patient from all sessions
    const evaluations = sessions.map(session => {
      const patientEval = session.patientEvaluations.find(e => e.patientId === patientId);
      return {
        ...patientEval.toObject(),
        userId: session.userId,
        userData: session.userData
      };
    }).filter(e => e);
    
    res.json({
      patientId,
      evaluations,
      evaluationCount: evaluations.length
    });
  } catch (error) {
    console.error(`Error fetching evaluations for patient ${req.params.patientId}:`, error);
    res.status(500).json({
      error: 'Failed to fetch patient evaluations',
      details: error.message
    });
  }
});

// Get specific evaluation for a user, patient, and recommendation type
router.get('/user/:userId/patient/:patientId/type/:recommendationType', async (req, res) => {
  try {
    const { userId, patientId, recommendationType } = req.params;
    
    const session = await UserEvaluationSession.findOne({ userId });
    
    if (!session) {
      // User hasn't created any evaluations yet - this is normal for new users
      // Only log once per user to avoid spam
      return res.status(200).json({ 
        evaluation: null 
      });
    }
    
    // Find the patient evaluation in the session
    const patientEval = session.patientEvaluations.find(
      e => e.patientId === patientId && e.recommendation_type === recommendationType
    );
    
    if (!patientEval) {
      // User has a session but hasn't evaluated this patient/type yet
      return res.status(200).json({ 
        evaluation: null 
      });
    }
    
    // Found an evaluation - return it without logging (to avoid spam from repeated requests)
    res.json({
      evaluation: {
        ...patientEval.toObject(),
        userId: session.userId,
        userData: session.userData
      }
    });
    
  } catch (error) {
    console.error(`❌ Error fetching evaluation for user ${req.params.userId}, patient ${req.params.patientId}:`, error);
    res.status(500).json({
      error: 'Failed to fetch evaluation',
      details: error.message
    });
  }
});

module.exports = router;