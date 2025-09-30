const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const ExcelJS = require('exceljs');
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

// Data paths
// const PATIENT_DATA_PATH = path.join('C:', 'Users', 'pia', 'OneDrive - Universitaet Bern', 'Projects', 'NetTubo', 'netTubo', 'data', 'ExpertCases.xlsx');
// const BATCH_RESULTS_PATH = path.join('C:', 'Users', 'pia', 'OneDrive - Universitaet Bern', 'Projects', 'NetTubo', 'netTubo', 'agentic_assessment', 'batch_results', 'run_20250929_175936', 'batch_run_20250929_175936');

let PATIENT_DATA_PATH;
if (process.env.PATIENT_DATA_PATH && fs.existsSync(process.env.PATIENT_DATA_PATH)) {
  PATIENT_DATA_PATH = process.env.PATIENT_DATA_PATH;
} else if (process.env.PATIENT_DATA_SECRET && fs.existsSync(`/etc/secrets/${process.env.PATIENT_DATA_SECRET}`)) {
  PATIENT_DATA_PATH = `/etc/secrets/${process.env.PATIENT_DATA_SECRET}`;
} else {
  PATIENT_DATA_PATH = path.join('C:', 'Users', 'pia', 'OneDrive - Universitaet Bern', 'Projects', 'NetTubo', 'netTubo', 'data', 'ExpertCases.xlsx');
}

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

// Helper function to load patient data from Excel (legacy; kept for debugging)
async function loadPatientDataFromExcel() {
  try {
    if (!await fs.pathExists(PATIENT_DATA_PATH)) {
      throw new Error(`Patient data file not found: ${PATIENT_DATA_PATH}`);
    }

    console.log('Loading patient data from:', PATIENT_DATA_PATH);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(PATIENT_DATA_PATH);
    
    // Get first worksheet
    const worksheet = workbook.worksheets[0];
    
    // Convert worksheet to JSON
    const jsonData = [];
    const headerRow = worksheet.getRow(1);
    const headers = [];
    
    // Get headers
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = cell.value;
    });
    
    console.log('Excel headers:', headers);
    
    // Process data rows
    let firstRowLogged = false;
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header row
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          if (headers[colNumber]) {
            rowData[headers[colNumber]] = cell.value;
          }
        });
        if (Object.keys(rowData).length > 0) {
          jsonData.push(rowData);
          
          // Log first row for debugging
          if (!firstRowLogged) {
            console.log('First patient record from Excel:', rowData);
            firstRowLogged = true;
          }
        }
      }
    });
    
    console.log(`Loaded ${jsonData.length} patient records from Excel`);
    return jsonData;
  } catch (error) {
    console.error('Error loading patient data from Excel:', error);
    throw error;
  }
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

// Helper: Load complete workflow JSON for a given patient
async function loadWorkflowForPatient(patientId) {
  try {
    // First try patient directory
    const patientDir = path.join(BATCH_RESULTS_PATH, `patient_${patientId}`);
    const workflowFileInDir = path.join(patientDir, `patient_${patientId}_complete_workflow.json`);

    if (await fs.pathExists(workflowFileInDir)) {
      return await fs.readJson(workflowFileInDir);
    }

    // Fallback: individual file uploaded to BATCH_RESULTS_PATH root
    const workflowFileAtRoot = path.join(BATCH_RESULTS_PATH, `patient_${patientId}_complete_workflow.json`);
    if (await fs.pathExists(workflowFileAtRoot)) {
      return await fs.readJson(workflowFileAtRoot);
    }

    console.warn(`Complete workflow file not found for patient ${patientId} in dir or root`);
    return null;
  } catch (error) {
    console.error(`Error loading workflow for patient ${patientId}:`, error);
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
    
    console.log('Loading fresh patient data from workflow JSONs...');
    if (!await fs.pathExists(BATCH_RESULTS_PATH)) {
      throw new Error(`Batch results directory not found: ${BATCH_RESULTS_PATH}`);
    }

    const entries = await fs.readdir(BATCH_RESULTS_PATH, { withFileTypes: true });

    const patientData = {};

    // First, find patient directories like patient_<id>/
    const patientDirs = entries.filter(e => e.isDirectory() && e.name.startsWith('patient_'));
    for (const dirent of patientDirs) {
      const idPart = dirent.name.replace('patient_', '').trim();
      const patientId = idPart;
      if (!patientId) continue;

      const workflow = await loadWorkflowForPatient(patientId);
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
      }

      // Load recommendation raw text from workflow
      let recommendation = null;
      let trialData = null;
      if (workflow && workflow.recommendation_result) {
        const rr = workflow.recommendation_result;
        const candidate = rr.markdown || rr.md || rr.raw_response || rr["raw_response"] || rr.text || '';
        const normalized = normalizeMarkdownText(candidate);
        recommendation = {
          raw_response: normalized || 'No recommendation available',
          source: 'complete_workflow'
        };
        
        // Extract trial matching data for NCT linking
        if (workflow.trial_matching_result && workflow.trial_matching_result.relevant_trials) {
          trialData = workflow.trial_matching_result.relevant_trials;
        }
      } else {
        // Fallback to legacy files
        recommendation = await loadLegacyRecommendation(patientId);
      }

      patientData[patientId] = {
        id: patientId.toString(),
        name: `Patient ${patientId}`,
        clinical_information: clinicalInfo || 'No clinical information available',
        clinical_question: clinicalQuestion || 'No clinical question provided',
        expert_recommendation: expertRecommendation,
        original_patient_data: originalPatientData,
        recommendation,
        trial_data: trialData  // Add trial data for NCT linking
      };

      console.log(`Processed patient ${patientId} (workflow=${!!workflow}, rec=${!!recommendation})`);
    }

    // Next, look for standalone workflow JSON files at the BATCH_RESULTS_PATH root
    const workflowFileRegex = /^patient_(\d+)_complete_workflow\.json$/i;
    for (const dirent of entries) {
      if (!dirent.isFile()) continue;
      const m = dirent.name.match(workflowFileRegex);
      if (!m) continue;
      const patientId = m[1];
      // Skip if already processed via directory
      if (patientData[patientId]) continue;

      // Load workflow and build the patient record (similar to above)
      const workflow = await loadWorkflowForPatient(patientId);
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
      }

      // Load recommendation raw text from workflow or legacy
      let recommendation = null;
      let trialData = null;
      if (workflow && workflow.recommendation_result) {
        const rr = workflow.recommendation_result;
        const candidate = rr.markdown || rr.md || rr.raw_response || rr["raw_response"] || rr.text || '';
        const normalized = normalizeMarkdownText(candidate);
        recommendation = {
          raw_response: normalized || 'No recommendation available',
          source: 'complete_workflow'
        };
        if (workflow.trial_matching_result && workflow.trial_matching_result.relevant_trials) {
          trialData = workflow.trial_matching_result.relevant_trials;
        }
      } else {
        recommendation = await loadLegacyRecommendation(patientId);
      }

      patientData[patientId] = {
        id: patientId.toString(),
        name: `Patient ${patientId}`,
        clinical_information: clinicalInfo || 'No clinical information available',
        clinical_question: clinicalQuestion || 'No clinical question provided',
        expert_recommendation: expertRecommendation,
        original_patient_data: originalPatientData,
        recommendation,
        trial_data: trialData
      };

      console.log(`Processed patient ${patientId} (root file, workflow=${!!workflow}, rec=${!!recommendation})`);
    }
    
    // Cache the result
    patientDataCache = patientData;
    cacheTimestamp = Date.now();
    
    console.log(`Successfully loaded data for ${Object.keys(patientData).length} patients`);
    return patientData;
    
  } catch (error) {
    console.error('Error in loadAllPatientData:', error);
    throw error;
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

// Debug endpoint to see Excel structure
app.get('/api/debug/excel', async (req, res) => {
  try {
    const excelData = await loadPatientDataFromExcel();
    res.json({
      totalRecords: excelData.length,
      sampleRecord: excelData[0] || {},
      allFields: excelData.length > 0 ? Object.keys(excelData[0]) : []
    });
  } catch (error) {
    console.error('Error in debug Excel endpoint:', error);
    res.status(500).json({ error: 'Failed to load Excel debug info', details: error.message });
  }
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
    paths: {
      patientData: PATIENT_DATA_PATH,
      batchResults: BATCH_RESULTS_PATH
    }
  });
});

// Initialize database connection and start server
async function startServer() {
  try {
    // Connect to MongoDB
    await dbConnection.connect();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 NetTubo Evaluation Backend running on port ${PORT}`);
      console.log(`📊 MongoDB: ${dbConnection.isConnected ? '✅ Connected' : '❌ Disconnected'}`);
      console.log(`📂 Patient data path: ${PATIENT_DATA_PATH}`);
      console.log(`📁 Batch results path: ${BATCH_RESULTS_PATH}`);
      
      // Check if paths exist
      fs.pathExists(PATIENT_DATA_PATH).then(exists => {
        console.log(`📋 Patient data file exists: ${exists ? '✅' : '❌'}`);
      });
      
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