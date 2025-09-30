const express = require('express');
const User = require('../models/User');
const router = express.Router();

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { userId, profession, yearsExperience } = req.body;

    // Validate required fields
    if (!userId || !profession || yearsExperience === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: userId, profession, yearsExperience'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ userId });
    if (existingUser) {
      return res.status(409).json({
        error: 'User with this ID already exists',
        userId: userId
      });
    }

    // Create new user
    const newUser = new User({
      userId,
      profession,
      yearsExperience: parseInt(yearsExperience),
      sessionStart: new Date(),
      completedEvaluations: []
    });

    const savedUser = await newUser.save();
    
    console.log(`✅ New user registered: ${userId} (${profession}, ${yearsExperience} years)`);
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        userId: savedUser.userId,
        profession: savedUser.profession,
        yearsExperience: savedUser.yearsExperience,
        sessionStart: savedUser.sessionStart,
        createdAt: savedUser.createdAt
      }
    });

  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({
      error: 'Failed to register user',
      details: error.message
    });
  }
});

// Get user by ID
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        userId: userId
      });
    }

    res.json({
      user: {
        userId: user.userId,
        profession: user.profession,
        yearsExperience: user.yearsExperience,
        sessionStart: user.sessionStart,
        completedEvaluations: user.completedEvaluations,
        lastActivity: user.lastActivity,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      error: 'Failed to fetch user',
      details: error.message
    });
  }
});

// Update user's completed evaluations
router.put('/:userId/completed', async (req, res) => {
  try {
    const { userId } = req.params;
    const { patientId } = req.body;

    if (!patientId) {
      return res.status(400).json({
        error: 'Missing required field: patientId'
      });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        userId: userId
      });
    }

    // Add patient ID to completed evaluations if not already present
    if (!user.completedEvaluations.includes(patientId)) {
      user.completedEvaluations.push(patientId);
      await user.save();
    }

    res.json({
      message: 'Completed evaluations updated',
      completedEvaluations: user.completedEvaluations
    });

  } catch (error) {
    console.error('Error updating completed evaluations:', error);
    res.status(500).json({
      error: 'Failed to update completed evaluations',
      details: error.message
    });
  }
});

// Get all users (for admin/research purposes)
router.get('/', async (req, res) => {
  try {
    const users = await User.find({}, {
      userId: 1,
      profession: 1,
      yearsExperience: 1,
      sessionStart: 1,
      completedEvaluations: 1,
      lastActivity: 1,
      createdAt: 1
    }).sort({ createdAt: -1 });

    res.json({
      users,
      totalUsers: users.length
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      details: error.message
    });
  }
});

module.exports = router;