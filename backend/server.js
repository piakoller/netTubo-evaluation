const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const ExcelJS = require('exceljs');

const app = express();
const PORT = 5001; // Different port from the other backend

// Middleware
app.use(cors());
app.use(express.json());

// Data paths
const PATIENT_DATA_PATH = path.join('C:', 'Users', 'pia', 'OneDrive - Universitaet Bern', 'Projects', 'NetTubo', 'netTubo', 'data', 'ExpertCases.xlsx');
const BATCH_RESULTS_PATH = path.join('C:', 'Users', 'pia', 'OneDrive - Universitaet Bern', 'Projects', 'NetTubo', 'netTubo', 'agentic_assessment', 'batch_results', 'run_20250922_094323', 'batch_run_20250922_094323');

// Cache
let patientDataCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
    
    if (!await fs.pathExists(recommendationFile)) {
      console.warn(`Recommendation file not found for patient ${patientId}: ${recommendationFile}`);
      return null;
    }
    
    // Load JSON recommendation
    const recommendation = await fs.readJson(recommendationFile);
    
    // Load raw response if available
    let rawResponseText = '';
    if (await fs.pathExists(rawResponseFile)) {
      try {
        rawResponseText = await fs.readFile(rawResponseFile, 'utf8');
      } catch (error) {
        console.warn(`Could not read raw response file for patient ${patientId}:`, error.message);
        rawResponseText = 'Raw response file not available';
      }
    }
    
    // Normalize shape similar to workflow file
    recommendation.raw_response = recommendation.raw_response || rawResponseText || 'No recommendation available';
    recommendation.source = 'legacy_therapy_recommendation_json';
    
    return recommendation;
  } catch (error) {
    console.error(`Error loading LLM recommendation for patient ${patientId}:`, error);
    return null;
  }
}

// Helper: Load complete workflow JSON for a given patient
async function loadWorkflowForPatient(patientId) {
  try {
    const patientDir = path.join(BATCH_RESULTS_PATH, `patient_${patientId}`);
    const workflowFile = path.join(patientDir, `patient_${patientId}_complete_workflow.json`);
    if (!await fs.pathExists(workflowFile)) {
      console.warn(`Complete workflow file not found for patient ${patientId}: ${workflowFile}`);
      return null;
    }
    const workflow = await fs.readJson(workflowFile);
    return workflow;
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
    const patientDirs = entries.filter(e => e.isDirectory() && e.name.startsWith('patient_'));

    const patientData = {};

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
        const raw = workflow.recommendation_result.raw_response || workflow.recommendation_result["raw_response"];
        recommendation = {
          raw_response: raw || 'No recommendation available',
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
  res.json({ 
    status: 'OK', 
    message: 'NetTubo Evaluation Backend is running',
    timestamp: new Date().toISOString(),
    paths: {
      patientData: PATIENT_DATA_PATH,
      batchResults: BATCH_RESULTS_PATH
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`NetTubo Evaluation Backend running on port ${PORT}`);
  console.log(`Patient data path: ${PATIENT_DATA_PATH}`);
  console.log(`Batch results path: ${BATCH_RESULTS_PATH}`);
  
  // Check if paths exist
  fs.pathExists(PATIENT_DATA_PATH).then(exists => {
    console.log(`Patient data file exists: ${exists}`);
  });
  
  fs.pathExists(BATCH_RESULTS_PATH).then(exists => {
    console.log(`Batch results directory exists: ${exists}`);
  });
});