const express = require('express');
const Evaluation = require('../models/Evaluation');
const User = require('../models/User');
const router = express.Router();

// Submit a new evaluation
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      patientId,
      overallRating,
      implementationWillingness,
      comments,
      userData,
      evaluationStartTime
    } = req.body;

    // Validate required fields
    if (!userId || !patientId || !overallRating || !implementationWillingness) {
      return res.status(400).json({
        error: 'Missing required fields: userId, patientId, overallRating, implementationWillingness'
      });
    }

    // Validate rating range
    if (overallRating < 1 || overallRating > 10) {
      return res.status(400).json({
        error: 'overallRating must be between 1 and 10'
      });
    }

    // Validate implementation willingness
    const validOptions = ['yes', 'maybe', 'no'];
    if (!validOptions.includes(implementationWillingness)) {
      return res.status(400).json({
        error: 'implementationWillingness must be one of: yes, maybe, no'
      });
    }

    // Check if user exists
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        userId: userId
      });
    }

    // Generate unique evaluation ID
    const evaluationId = `EVAL_${Date.now()}_${userId}_${patientId}`;

    // Create new evaluation
    const newEvaluation = new Evaluation({
      evaluationId,
      userId,
      patientId,
      overallRating: parseInt(overallRating),
      implementationWillingness,
      comments: comments || '',
      userData: userData || {
        userId: user.userId,
        profession: user.profession,
        yearsExperience: user.yearsExperience
      },
      evaluationStartTime: evaluationStartTime ? new Date(evaluationStartTime) : null,
      evaluationEndTime: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID || null
    });

    const savedEvaluation = await newEvaluation.save();

    // Update user's completed evaluations
    if (!user.completedEvaluations.includes(patientId)) {
      user.completedEvaluations.push(patientId);
      await user.save();
    }

    console.log(`✅ New evaluation submitted: ${evaluationId} by ${userId} for patient ${patientId}`);

    res.status(201).json({
      message: 'Evaluation submitted successfully',
      evaluation: {
        evaluationId: savedEvaluation.evaluationId,
        userId: savedEvaluation.userId,
        patientId: savedEvaluation.patientId,
        overallRating: savedEvaluation.overallRating,
        implementationWillingness: savedEvaluation.implementationWillingness,
        timeSpentSeconds: savedEvaluation.timeSpentSeconds,
        createdAt: savedEvaluation.createdAt
      }
    });

  } catch (error) {
    console.error('Error submitting evaluation:', error);
    res.status(500).json({
      error: 'Failed to submit evaluation',
      details: error.message
    });
  }
});

// Get evaluations for a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const evaluations = await Evaluation.find({ userId })
      .sort({ createdAt: -1 })
      .select('-userAgent -ipAddress'); // Exclude sensitive data

    res.json({
      evaluations,
      totalEvaluations: evaluations.length
    });

  } catch (error) {
    console.error('Error fetching user evaluations:', error);
    res.status(500).json({
      error: 'Failed to fetch evaluations',
      details: error.message
    });
  }
});

// Get evaluations for a specific patient with detailed organization
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const evaluations = await Evaluation.find({ patientId })
      .sort({ createdAt: -1 })
      .select('-userAgent -ipAddress'); // Exclude sensitive data

    // Organize evaluations by profession and experience for easier analysis
    const organizationByProfession = {};
    const organizationByExperience = {};
    const summary = {
      totalEvaluations: evaluations.length,
      averageRating: 0,
      implementationDistribution: { yes: 0, maybe: 0, no: 0 },
      professions: new Set(),
      experienceRanges: new Set()
    };

    let totalRating = 0;
    
    evaluations.forEach(evaluation => {
      const profession = evaluation.userData?.profession || 'Unknown';
      const experience = evaluation.userData?.yearsExperience || 0;
      
      // Organize by profession
      if (!organizationByProfession[profession]) {
        organizationByProfession[profession] = [];
      }
      organizationByProfession[profession].push(evaluation);
      
      // Organize by experience ranges
      const expRange = experience < 5 ? '0-4 years' : 
                      experience < 10 ? '5-9 years' : 
                      experience < 20 ? '10-19 years' : '20+ years';
      
      if (!organizationByExperience[expRange]) {
        organizationByExperience[expRange] = [];
      }
      organizationByExperience[expRange].push(evaluation);
      
      // Update summary stats
      totalRating += evaluation.overallRating;
      summary.implementationDistribution[evaluation.implementationWillingness]++;
      summary.professions.add(profession);
      summary.experienceRanges.add(expRange);
    });

    if (evaluations.length > 0) {
      summary.averageRating = (totalRating / evaluations.length).toFixed(2);
    }

    // Convert Sets to Arrays for JSON response
    summary.professions = Array.from(summary.professions);
    summary.experienceRanges = Array.from(summary.experienceRanges);

    res.json({
      patientId,
      summary,
      organizationByProfession,
      organizationByExperience,
      allEvaluations: evaluations,
      totalEvaluations: evaluations.length
    });

  } catch (error) {
    console.error('Error fetching patient evaluations:', error);
    res.status(500).json({
      error: 'Failed to fetch evaluations',
      details: error.message
    });
  }
});

// Get all patients with their evaluation summaries
router.get('/patients/summary', async (req, res) => {
  try {
    const patientSummaries = await Evaluation.aggregate([
      {
        $group: {
          _id: '$patientId',
          totalEvaluations: { $sum: 1 },
          averageRating: { $avg: '$overallRating' },
          professions: { $addToSet: '$userData.profession' },
          implementationYes: {
            $sum: { $cond: [{ $eq: ['$implementationWillingness', 'yes'] }, 1, 0] }
          },
          implementationMaybe: {
            $sum: { $cond: [{ $eq: ['$implementationWillingness', 'maybe'] }, 1, 0] }
          },
          implementationNo: {
            $sum: { $cond: [{ $eq: ['$implementationWillingness', 'no'] }, 1, 0] }
          },
          lastEvaluation: { $max: '$createdAt' },
          firstEvaluation: { $min: '$createdAt' }
        }
      },
      {
        $sort: { '_id': 1 } // Sort by patient ID
      }
    ]);

    const totalUniquePatients = patientSummaries.length;
    const totalEvaluationsAcrossAllPatients = patientSummaries.reduce((sum, p) => sum + p.totalEvaluations, 0);

    res.json({
      totalUniquePatients,
      totalEvaluationsAcrossAllPatients,
      patientSummaries: patientSummaries.map(p => ({
        patientId: p._id,
        totalEvaluations: p.totalEvaluations,
        averageRating: Math.round(p.averageRating * 100) / 100,
        professions: p.professions,
        implementationDistribution: {
          yes: p.implementationYes,
          maybe: p.implementationMaybe,
          no: p.implementationNo
        },
        evaluationPeriod: {
          first: p.firstEvaluation,
          last: p.lastEvaluation
        }
      }))
    });

  } catch (error) {
    console.error('Error fetching patient summaries:', error);
    res.status(500).json({
      error: 'Failed to fetch patient summaries',
      details: error.message
    });
  }
});

// Export data for a specific patient (research-friendly format)
router.get('/patient/:patientId/export', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { format = 'json' } = req.query;
    
    const evaluations = await Evaluation.find({ patientId })
      .sort({ createdAt: 1 }) // Sort chronologically for export
      .select('-userAgent -ipAddress -__v'); // Clean up for export

    if (evaluations.length === 0) {
      return res.status(404).json({
        error: 'No evaluations found for this patient',
        patientId
      });
    }

    // Create research-friendly export format
    const exportData = {
      patientId,
      exportTimestamp: new Date().toISOString(),
      totalEvaluations: evaluations.length,
      evaluations: evaluations.map(evaluation => ({
        evaluationId: evaluation.evaluationId,
        evaluatorId: evaluation.userId,
        profession: evaluation.userData?.profession,
        yearsExperience: evaluation.userData?.yearsExperience,
        overallRating: evaluation.overallRating,
        implementationWillingness: evaluation.implementationWillingness,
        comments: evaluation.comments,
        timeSpentSeconds: evaluation.timeSpentSeconds,
        evaluationDate: evaluation.createdAt,
        evaluationStartTime: evaluation.evaluationStartTime,
        evaluationEndTime: evaluation.evaluationEndTime
      }))
    };

    // Set appropriate headers for download
    res.setHeader('Content-Disposition', `attachment; filename="patient_${patientId}_evaluations.json"`);
    res.setHeader('Content-Type', 'application/json');
    
    res.json(exportData);

  } catch (error) {
    console.error('Error exporting patient evaluations:', error);
    res.status(500).json({
      error: 'Failed to export evaluations',
      details: error.message
    });
  }
});

// Get all evaluations (for research/admin purposes)
router.get('/', async (req, res) => {
  try {
    const { limit = 100, skip = 0, patientId, userId } = req.query;
    
    const filter = {};
    if (patientId) filter.patientId = patientId;
    if (userId) filter.userId = userId;

    const evaluations = await Evaluation.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select('-userAgent -ipAddress'); // Exclude sensitive data

    const totalEvaluations = await Evaluation.countDocuments(filter);

    res.json({
      evaluations,
      totalEvaluations,
      currentPage: Math.floor(skip / limit) + 1,
      totalPages: Math.ceil(totalEvaluations / limit)
    });

  } catch (error) {
    console.error('Error fetching evaluations:', error);
    res.status(500).json({
      error: 'Failed to fetch evaluations',
      details: error.message
    });
  }
});

// Get evaluation statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const totalEvaluations = await Evaluation.countDocuments();
    const uniqueUsers = await Evaluation.distinct('userId').then(users => users.length);
    const uniquePatients = await Evaluation.distinct('patientId').then(patients => patients.length);

    // Average ratings
    const ratingStats = await Evaluation.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$overallRating' },
          minRating: { $min: '$overallRating' },
          maxRating: { $max: '$overallRating' }
        }
      }
    ]);

    // Implementation willingness distribution
    const implementationStats = await Evaluation.aggregate([
      {
        $group: {
          _id: '$implementationWillingness',
          count: { $sum: 1 }
        }
      }
    ]);

    // Profession distribution
    const professionStats = await Evaluation.aggregate([
      {
        $group: {
          _id: '$userData.profession',
          count: { $sum: 1 },
          averageRating: { $avg: '$overallRating' }
        }
      }
    ]);

    res.json({
      totalEvaluations,
      uniqueUsers,
      uniquePatients,
      ratingStatistics: ratingStats[0] || {},
      implementationWillingness: implementationStats,
      professionDistribution: professionStats
    });

  } catch (error) {
    console.error('Error generating evaluation statistics:', error);
    res.status(500).json({
      error: 'Failed to generate statistics',
      details: error.message
    });
  }
});

module.exports = router;