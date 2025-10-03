const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

// Database
const dbConnection = require('./database/connection');

// Routes
const userRoutes = require('./routes/users');
const evaluationRoutes = require('./routes/evaluations');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Study access code verification
const parseAccessCodes = (raw) => {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
};

const ACCESS_CODES = parseAccessCodes(process.env.STUDY_ACCESS_CODES || process.env.ACCESS_CODES);

app.post('/api/access/verify', (req, res) => {
  try {
    const code = (req.body && String(req.body.code || '').trim()) || '';
    if (!ACCESS_CODES.length) {
      return res.status(503).json({ error: 'Access code not configured on server' });
    }
    if (!code) {
      return res.status(400).json({ error: 'Access code is required' });
    }
    const ok = ACCESS_CODES.some((c) => c.toLowerCase() === code.toLowerCase());
    if (!ok) {
      return res.status(401).json({ error: 'Invalid access code' });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Access code verification error:', err);
    return res.status(500).json({ error: 'Failed to verify access code' });
  }
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/evaluations', evaluationRoutes);

// Data paths - MongoDB is primary, files are fallback only

let BATCH_RESULTS_PATH;
if (process.env.BATCH_RESULTS_PATH && fs.existsSync(process.env.BATCH_RESULTS_PATH)) {
  BATCH_RESULTS_PATH = process.env.BATCH_RESULTS_PATH;
} else if (process.env.BATCH_RESULTS_SECRET && fs.existsSync(`/etc/secrets/${process.env.BATCH_RESULTS_SECRET}`)) {
  BATCH_RESULTS_PATH = `/etc/secrets/${process.env.BATCH_RESULTS_SECRET}`;
} else {
  BATCH_RESULTS_PATH = path.join('C:', 'Users', 'pia', 'OneDrive - Universitaet Bern', 'Projects', 'NetTubo', 'netTubo', 'agentic_assessment', 'batch_results', 'run_20250929_175936', 'batch_run_20250929_175936');
}

// Cache
let patientDataCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// MongoDB connection for patient workflow data
let mongoWorkflowDb = null;
let mongoWorkflowConnection = null;
const MONGODB_WORKFLOW_URI = process.env.MONGODB_WORKFLOW_URI || process.env.MONGODB_URI;
const WORKFLOW_DB_NAME = 'nettubo-data';

// MongoDB connection for baseline therapy recommendations
let mongoBaselineDb = null;
let mongoBaselineConnection = null;
const MONGODB_BASELINE_URI = process.env.MONGODB_BASELINE_URI;
const BASELINE_DB_NAME = 'nettubo-baseline';

async function connectToWorkflowDb() {
  if (!MONGODB_WORKFLOW_URI) {
    console.log('🔄 No MongoDB URI configured, using file-only workflow loading');
    return null;
  }
  
  try {
    mongoWorkflowConnection = await mongoose.createConnection(MONGODB_WORKFLOW_URI);
    mongoWorkflowDb = mongoWorkflowConnection.useDb(WORKFLOW_DB_NAME);
    console.log('🚀 Connected to MongoDB workflow database:', WORKFLOW_DB_NAME);
    return mongoWorkflowDb;
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB workflow database:', error.message);
    return null;
  }
}

async function connectToBaselineDb() {
  if (!MONGODB_BASELINE_URI) {
    console.log('🔄 No MongoDB baseline URI configured, baseline recommendations will not be available');
    return null;
  }
  
  try {
    mongoBaselineConnection = await mongoose.createConnection(MONGODB_BASELINE_URI);
    mongoBaselineDb = mongoBaselineConnection.useDb(BASELINE_DB_NAME);
    console.log('🚀 Connected to MongoDB baseline database:', BASELINE_DB_NAME);
    return mongoBaselineDb;
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB baseline database:', error.message);
    return null;
  }
}

async function loadBaselineFromMongo(patientId) {
  if (!mongoBaselineDb) {
    console.log('⚠️ Baseline database not connected');
    return null;
  }

  try {
    const collectionName = `patient-${patientId}`;
    const collection = mongoBaselineDb.collection(collectionName);
    
    // Find document with Gemini 2.5 Pro model
    const doc = await collection.findOne({
      "metadata.model": "google/gemini-2.5-pro"
    });
    
    if (!doc || !doc.output || !doc.output.response) {
      console.log(`⚠️ No baseline recommendation found for patient ${patientId}`);
      return null;
    }
    
    // Clean XML tags and format the response
    let baselineResponse = doc.output.response;
    baselineResponse = baselineResponse.replace(/<[^>]*>/g, ''); // Remove XML tags
    baselineResponse = baselineResponse.trim(); // Remove extra whitespace
    
    console.log(`✅ Loaded baseline recommendation for patient ${patientId}`);
    return baselineResponse;
  } catch (error) {
    console.error(`❌ Error loading baseline for patient ${patientId}:`, error.message);
    return null;
  }
}

// Normalize LLM markdown text: unescape literal \n to real newlines, fix CRLF, replace nbsp
function normalizeMarkdownText(text) {
  if (text == null) return '';
  let s = String(text);
  // Replace literal "\\n" sequences with actual newlines
  s = s.replace(/\\n/g, '\n');
  // Normalize CRLF/CR to LF
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Replace non-breaking spaces
  s = s.replace(/\u00A0/g, ' ');
  return s;
}

// Helper function to load patient data from Excel (REMOVED - using MongoDB only)
// This function is kept as reference but not used in production
async function loadPatientDataFromExcel_LEGACY() {
  console.warn('⚠️ loadPatientDataFromExcel_LEGACY called - this function is deprecated, using MongoDB instead');
  throw new Error('Excel patient data loading is deprecated. Use MongoDB collections instead.');
}

// Helper: load therapy recommendation from legacy single-step files as a fallback
async function loadLegacyRecommendation(patientId) {
  try {
    const patientDir = path.join(BATCH_RESULTS_PATH, `patient_${patientId}`);
    const recommendationFile = path.join(patientDir, `patient_${patientId}_therapy_recommendation.json`);
    const rawResponseFile = path.join(patientDir, `patient_${patientId}_therapy_recommendation_raw_response.txt`);

    console.log('Looking for recommendation file:', recommendationFile);
    
    // If the recommendation JSON isn't in the patient directory, try the batch root
    let recommendationFileToLoad = recommendationFile;
    let rawResponseFileToLoad = rawResponseFile;

    if (!await fs.pathExists(recommendationFileToLoad)) {
      const recommendationAtRoot = path.join(BATCH_RESULTS_PATH, `patient_${patientId}_therapy_recommendation.json`);
      const rawResponseAtRoot = path.join(BATCH_RESULTS_PATH, `patient_${patientId}_therapy_recommendation_raw_response.txt`);
      if (await fs.pathExists(recommendationAtRoot)) {
        console.warn(`Recommendation file not found in patient dir; using root file for patient ${patientId}: ${recommendationAtRoot}`);
        recommendationFileToLoad = recommendationAtRoot;
      } else {
        console.warn(`Recommendation file not found for patient ${patientId} in dir or root: checked ${recommendationFile} and ${recommendationAtRoot}`);
        return null;
      }
      if (await fs.pathExists(rawResponseAtRoot)) {
        rawResponseFileToLoad = rawResponseAtRoot;
      }
    }

    // Load JSON recommendation
    const recJson = await fs.readJson(recommendationFileToLoad);
    
    // Load raw response if available
    let rawResponseText = '';
    if (await fs.pathExists(rawResponseFileToLoad)) {
      try {
        rawResponseText = await fs.readFile(rawResponseFileToLoad, 'utf8');
      } catch (error) {
        console.warn(`Could not read raw response file for patient ${patientId}:`, error.message);
        rawResponseText = 'Raw response file not available';
      }
    }
    
    // Prefer explicit markdown field if present
    const candidate = recJson.markdown || recJson.md || recJson.raw_response || recJson.text || '';
    const normalized = normalizeMarkdownText(candidate || rawResponseText);

    const recommendation = {
      ...recJson,
      raw_response: normalized || 'No recommendation available',
      source: 'legacy_therapy_recommendation_json'
    };

    return recommendation;
  } catch (error) {
    console.error(`Error loading LLM recommendation for patient ${patientId}:`, error);
    return null;
  }
}

// Helper: Load complete workflow from MongoDB first, then file fallback
async function loadWorkflowFromMongo(patientId) {
  if (!mongoWorkflowDb) {
    return null;
  }
  
  try {
    const collectionName = `patient-${patientId}`;
    const collection = mongoWorkflowDb.collection(collectionName);
    
    // Get the most recent workflow document (there should typically be only one)
    const workflow = await collection.findOne({}, { sort: { _id: -1 } });
    
    if (workflow) {
      console.log(`✅ Loaded workflow for patient ${patientId} from MongoDB collection ${collectionName}`);
      // Remove MongoDB _id field before returning
      const { _id, ...workflowData } = workflow;
      return workflowData;
    }
    
    console.log(`📄 No workflow found in MongoDB for patient ${patientId}, will try file fallback`);
    return null;
  } catch (error) {
    console.error(`❌ Error loading workflow from MongoDB for patient ${patientId}:`, error.message);
    return null;
  }
}

// Helper: Load complete workflow JSON for a given patient
async function loadWorkflowForPatient(patientId) {
  try {
    // First try MongoDB
    const mongoWorkflow = await loadWorkflowFromMongo(patientId);
    if (mongoWorkflow) {
      return mongoWorkflow;
    }

    // Fallback: try patient directory
    const patientDir = path.join(BATCH_RESULTS_PATH, `patient_${patientId}`);
    const workflowFileInDir = path.join(patientDir, `patient_${patientId}_complete_workflow.json`);

    if (await fs.pathExists(workflowFileInDir)) {
      console.log(`📁 Loading workflow for patient ${patientId} from directory: ${workflowFileInDir}`);
      return await fs.readJson(workflowFileInDir);
    }

    // Fallback: individual file uploaded to BATCH_RESULTS_PATH root
    const workflowFileAtRoot = path.join(BATCH_RESULTS_PATH, `patient_${patientId}_complete_workflow.json`);
    if (await fs.pathExists(workflowFileAtRoot)) {
      console.log(`📁 Loading workflow for patient ${patientId} from root file: ${workflowFileAtRoot}`);
      return await fs.readJson(workflowFileAtRoot);
    }

    console.warn(`⚠️ Complete workflow file not found for patient ${patientId} in MongoDB, dir, or root`);
    return null;
  } catch (error) {
    console.error(`❌ Error loading workflow for patient ${patientId}:`, error);
    return null;
  }
}

// Build patient dataset by scanning workflow result folders
async function loadAllPatientData() {
  try {
    // Check cache
    if (patientDataCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
      console.log('Returning cached patient data');
      return patientDataCache;
    }
    
    console.log('Loading fresh patient data from MongoDB and workflow JSONs...');
    
    const patientData = {};

    // First, discover patients from MongoDB collections
    if (mongoWorkflowDb) {
      try {
        // Try known patient collections: patient-1, patient-2, patient-3
        const knownPatientIds = ['1', '2', '3'];
        
        for (const patientId of knownPatientIds) {
          if (patientData[patientId]) continue; // Skip if already processed
          
          const workflow = await loadWorkflowForPatient(patientId);
          if (workflow) {
            const processedPatient = await processWorkflowIntoPatientData(patientId, workflow);
            if (processedPatient) {
              patientData[patientId] = processedPatient;
              console.log(`✅ Processed patient ${patientId} from MongoDB`);
            }
          }
        }
        
        console.log(`📊 Attempted to load ${knownPatientIds.length} known patient collections from MongoDB`);
      } catch (mongoError) {
        console.error('❌ Error loading patients from MongoDB:', mongoError.message);
        console.log('🔄 Continuing with file-based discovery...');
      }
    }

    // File-based discovery (existing logic) - check if BATCH_RESULTS_PATH exists
    let fileBasedDiscovery = false;
    if (await fs.pathExists(BATCH_RESULTS_PATH)) {
      fileBasedDiscovery = true;
    } else {
      console.log('📁 Batch results directory not found, skipping file-based discovery:', BATCH_RESULTS_PATH);
    }

    if (fileBasedDiscovery) {
      const entries = await fs.readdir(BATCH_RESULTS_PATH, { withFileTypes: true });

      // First, find patient directories like patient_<id>/
      const patientDirs = entries.filter(e => e.isDirectory() && e.name.startsWith('patient_'));
      for (const dirent of patientDirs) {
        const idPart = dirent.name.replace('patient_', '').trim();
        const patientId = idPart;
        if (!patientId || patientData[patientId]) continue; // Skip if already processed from MongoDB

        const workflow = await loadWorkflowForPatient(patientId);
        if (workflow) {
          const processedPatient = await processWorkflowIntoPatientData(patientId, workflow);
          if (processedPatient) {
            patientData[patientId] = processedPatient;
            console.log(`📁 Processed patient ${patientId} from directory`);
          }
        }
      }

      // Next, look for standalone workflow JSON files at the BATCH_RESULTS_PATH root
      const workflowFileRegex = /^patient_(\d+)_complete_workflow\.json$/i;
      for (const dirent of entries) {
        if (!dirent.isFile()) continue;
        const m = dirent.name.match(workflowFileRegex);
        if (!m) continue;
        const patientId = m[1];
        // Skip if already processed via directory or MongoDB
        if (patientData[patientId]) continue;

        const workflow = await loadWorkflowForPatient(patientId);
        if (workflow) {
          const processedPatient = await processWorkflowIntoPatientData(patientId, workflow);
          if (processedPatient) {
            patientData[patientId] = processedPatient;
            console.log(`📁 Processed patient ${patientId} from root file`);
          }
        }
      }
    }
    
    // Cache the result
    patientDataCache = patientData;
    cacheTimestamp = Date.now();
    
    console.log(`✅ Successfully loaded data for ${Object.keys(patientData).length} patients`);
    return patientData;
    
  } catch (error) {
    console.error('❌ Error in loadAllPatientData:', error);
    throw error;
  }
}

// Helper function to process workflow data into patient data structure
async function processWorkflowIntoPatientData(patientId, workflow) {
  try {
    console.log(`🔍 Processing workflow for patient ${patientId}, workflow exists: ${!!workflow}`);
    
    let clinicalInfo = undefined;
    let clinicalQuestion = undefined;
    let expertRecommendation = undefined;
    let originalPatientData = undefined;

    if (workflow && workflow.guidelines_result && workflow.guidelines_result.patient_data) {
      const pd = workflow.guidelines_result.patient_data;
      clinicalInfo = pd.clinical_information || pd.ClinicalInformation || pd["clinical_information"];
      clinicalQuestion = pd.question_for_tumorboard || pd['question_for_tumorboard'] || pd.ClinicalQuestion || pd['Clinical Question'];
      expertRecommendation = pd.expert_recommendation || pd['expert_recommendation'];
      originalPatientData = pd;
      console.log(`📋 Found patient data in guidelines_result for patient ${patientId}`);
    }

    // Load recommendation raw text from workflow
    let recommendation = null;
    let trialData = null;
    if (workflow && workflow.recommendation_result) {
      console.log(`🎯 Found recommendation_result for patient ${patientId}`);
      const rr = workflow.recommendation_result;
      const candidate = rr.markdown || rr.md || rr.raw_response || rr["raw_response"] || rr.text || '';
      const normalized = normalizeMarkdownText(candidate);
      recommendation = {
        raw_response: normalized || 'No recommendation available',
        source: 'complete_workflow'
      };
      console.log(`📝 Recommendation loaded for patient ${patientId}, length: ${normalized?.length || 0}`);
      
      // Extract trial matching data for NCT linking
      if (workflow.trial_matching_result && workflow.trial_matching_result.relevant_trials) {
        trialData = workflow.trial_matching_result.relevant_trials;
        console.log(`🧪 Found ${trialData.length} trials for patient ${patientId}`);
      }
    } else {
      console.log(`⚠️ No recommendation_result found for patient ${patientId}, trying legacy files`);
      // Fallback to legacy files
      recommendation = await loadLegacyRecommendation(patientId);
    }

    // Load baseline recommendation from MongoDB
    const baselineRecommendation = await loadBaselineFromMongo(patientId);

    return {
      id: patientId.toString(),
      name: `Patient ${patientId}`,
      clinical_information: clinicalInfo || 'No clinical information available',
      clinical_question: clinicalQuestion || 'No clinical question provided',
      expert_recommendation: expertRecommendation,
      original_patient_data: originalPatientData,
      recommendation,
      baseline_recommendation: baselineRecommendation,
      trial_data: trialData  // Add trial data for NCT linking
    };
  } catch (error) {
    console.error(`❌ Error processing workflow for patient ${patientId}:`, error);
    return null;
  }
}

// API Routes

// Get all patients
app.get('/api/patients', async (req, res) => {
  try {
    const patientData = await loadAllPatientData();
    res.json(patientData);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to load patient data', details: error.message });
  }
});

// Get specific patient
app.get('/api/patients/:id', async (req, res) => {
  try {
    const patientData = await loadAllPatientData();
    const patient = patientData[req.params.id];
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    res.json(patient);
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ error: 'Failed to load patient data', details: error.message });
  }
});

// Get patient recommendation
app.get('/api/patients/:id/recommendation', async (req, res) => {
  try {
    const patientData = await loadAllPatientData();
    const patient = patientData[req.params.id];
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    res.json(patient.recommendation);
  } catch (error) {
    console.error('Error fetching recommendation:', error);
    res.status(500).json({ error: 'Failed to load recommendation', details: error.message });
  }
});

// Reload data (clear cache)
app.post('/api/reload', async (req, res) => {
  try {
    patientDataCache = null;
    cacheTimestamp = null;
    const patientData = await loadAllPatientData();
    res.json({ 
      message: 'Data reloaded successfully', 
      patientCount: Object.keys(patientData).length 
    });
  } catch (error) {
    console.error('Error reloading data:', error);
    res.status(500).json({ error: 'Failed to reload data', details: error.message });
  }
});

// Debug endpoint to see Excel structure (DISABLED - using MongoDB only)
app.get('/api/debug/excel', async (req, res) => {
  res.status(410).json({ 
    error: 'Excel debug endpoint disabled', 
    message: 'Patient data is now loaded from MongoDB collections only. Use /api/health to check database status.',
    suggestion: 'Query MongoDB collections patient-1, patient-2, patient-3 in nettubo-data database'
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = dbConnection.getConnectionStatus();
  
  res.json({ 
    status: 'OK', 
    message: 'NetTubo Evaluation Backend is running',
    timestamp: new Date().toISOString(),
    database: {
      connected: dbStatus.isConnected,
      name: dbStatus.name,
      host: dbStatus.host,
      port: dbStatus.port
    },
    workflowDatabase: {
      connected: !!mongoWorkflowDb,
      name: WORKFLOW_DB_NAME,
      uri: MONGODB_WORKFLOW_URI ? '[CONFIGURED]' : '[NOT CONFIGURED]'
    },
    paths: {
      batchResults: BATCH_RESULTS_PATH,
      note: 'Patient data is loaded from MongoDB collections only'
    }
  });
});

// Initialize database connection and start server
async function startServer() {
  try {
    // Connect to MongoDB (for evaluations)
    await dbConnection.connect();
    
    // Connect to MongoDB workflow database (for patient data)
    await connectToWorkflowDb();
    
    // Connect to MongoDB baseline database (for baseline recommendations)
    await connectToBaselineDb();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 NetTubo Evaluation Backend running on port ${PORT}`);
      console.log(`📊 MongoDB (evaluations): ${dbConnection.isConnected ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`📊 MongoDB (workflows): ${mongoWorkflowDb ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`📊 MongoDB (baseline): ${mongoBaselineDb ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`📁 Batch results path: ${BATCH_RESULTS_PATH}`);
      console.log(`📊 Patient data: MongoDB collections only (patient-1, patient-2, patient-3)`);
      
      // Check if batch results path exists
      fs.pathExists(BATCH_RESULTS_PATH).then(exists => {
        console.log(`📊 Batch results directory exists: ${exists ? '✅' : '❌'}`);
      });
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();