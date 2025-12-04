// Data service for loading LLM therapy recommendatijs
class DataService {
  constructor() {
    // Allow deploying frontend and backend to different hosts. Configure backend via REACT_APP_API_BASE.
    // If REACT_APP_API_BASE is not set, use relative '/api' so same-origin requests work.
    const RAW_API_BASE = process.env.REACT_APP_API_BASE || '';
    const API_HOST = RAW_API_BASE.replace(/\/$/, '');
    this.baseURL = API_HOST ? `${API_HOST}/api` : '/api';
    console.log('DataService using API base URL:', this.baseURL);
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  // Load patient recommendations from backend API
  async loadPatientRecommendations() {
    const cacheKey = 'patient_recommendations';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    try {
      console.log('Fetching patient data from backend...');
      const response = await fetch(`${this.baseURL}/patients`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
      }
      
      const patientData = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: patientData,
        timestamp: Date.now()
      });

      console.log(`Loaded ${Object.keys(patientData).length} patients from backend`);
      return patientData;
    } catch (error) {
      console.error('Error loading patient recommendations:', error);
      
      // If backend is not available, show helpful error message
      if (error instanceof TypeError || (error.message && error.message.toLowerCase().includes('failed to fetch'))) {
        throw new Error(`Backend server is not reachable at ${this.baseURL}. Please ensure the backend is running and accessible (CORS, network).`);
      }
      
      throw error;
    }
  }

  async getPatientRecommendation(patientId) {
    try {
      const response = await fetch(`${this.baseURL}/patients/${patientId}/recommendation`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching patient recommendation:', error);
      throw error;
    }
  }

  async getAllPatientIds() {
    const allPatients = await this.loadPatientRecommendations();
    return Object.keys(allPatients);
  }

  // Reload data from backend (clears cache)
  async reloadData() {
    try {
      this.cache.clear();
      const response = await fetch(`${this.baseURL}/reload`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Data reloaded:', result.message);
      return result;
    } catch (error) {
      console.error('Error reloading data:', error);
      throw error;
    }
  }

  // Check backend health
  async checkBackendHealth() {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Backend health check failed:', error);
      throw error;
    }
  }

  // Save evaluation to database
  async saveEvaluation(evaluation) {
    console.log('Saving evaluation to database:', evaluation);
    
    try {
      // Add evaluation start time if not present
      const evaluationData = {
        ...evaluation,
        evaluationStartTime: evaluation.evaluationStartTime || new Date().toISOString()
      };

      // Prepare the payload with correct field mapping
      const payload = {
        userId: evaluationData.user_data?.userId,
        patientId: evaluationData.patient_id,
        evaluation_type: evaluationData.evaluation_type || 'main',
        userData: evaluationData.user_data,
        evaluationStartTime: evaluationData.evaluationStartTime,
        
        // Main evaluation fields
        recommendation_type: evaluationData.recommendation_type,
        overallRating: evaluationData.overall_rating,
        implementationWillingness: evaluationData.implementation_willingness,
        comments: evaluationData.comments || '',
        
        // Detailed Yes/No questions
        guideline_adherence: evaluationData.guideline_adherence,
        clinical_trial_integration: evaluationData.clinical_trial_integration,
        diagnostic_soundness: evaluationData.diagnostic_soundness,
        clinical_appropriateness: evaluationData.clinical_appropriateness,
        contraindication_awareness: evaluationData.contraindication_awareness,
        treatment_completeness: evaluationData.treatment_completeness,
        rationale_clarity: evaluationData.rationale_clarity,
        risk_benefit_transparency: evaluationData.risk_benefit_transparency,
        consideration_alternatives: evaluationData.consideration_alternatives,
        actionable_next_steps: evaluationData.actionable_next_steps,
        personalization: evaluationData.personalization,
        quality_of_life: evaluationData.quality_of_life,
        
        // Expert evaluation fields (if applicable)
        expert_agreement: evaluationData.expert_agreement,
        expert_comments: evaluationData.expert_comments
      };

      // Send to database
      const response = await fetch(`${this.baseURL}/evaluations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save evaluation');
      }

      const result = await response.json();
      console.log('Evaluation saved to database:', result);
      
      // Also store in localStorage as backup
      const evaluations = JSON.parse(localStorage.getItem('evaluations') || '[]');
      const localEvaluation = {
        ...evaluation,
        id: result.evaluation?.evaluationId || Date.now().toString(),
        timestamp: new Date().toISOString()
      };
      evaluations.push(localEvaluation);
      localStorage.setItem('evaluations', JSON.stringify(evaluations));
      
      return result.evaluation;
      
    } catch (error) {
      console.error('Error saving to database:', error);
      
      // Fallback to localStorage
      console.log('Falling back to localStorage...');
      const evaluations = JSON.parse(localStorage.getItem('evaluations') || '[]');
      evaluation.id = Date.now().toString();
      evaluation.timestamp = new Date().toISOString();
      evaluations.push(evaluation);
      localStorage.setItem('evaluations', JSON.stringify(evaluations));
      
      // Show warning but don't fail
      console.warn('Evaluation saved to localStorage as fallback');
      return evaluation;
    }
  }

  async loadEvaluations() {
    try {
      // Try to load from database first
      const response = await fetch(`${this.baseURL}/evaluations`);
      
      if (response.ok) {
        const result = await response.json();
        console.log(`Loaded ${result.evaluations?.length || 0} evaluations from database`);
        return result.evaluations || [];
      } else {
        throw new Error('Database not available');
      }
      
    } catch (error) {
      console.warn('Could not load from database, using localStorage:', error.message);
      
      // Fallback to localStorage
      try {
        const evaluations = JSON.parse(localStorage.getItem('evaluations') || '[]');
        return evaluations;
      } catch (error) {
        console.error('Error loading evaluations:', error);
        return [];
      }
    }
  }

  async getEvaluationForPatientAndType(userId, patientId, recommendationType) {
    try {
      const response = await fetch(`${this.baseURL}/evaluations/user/${userId}/patient/${patientId}/type/${recommendationType}`);
      
      if (response.ok) {
        const result = await response.json();
        return result.evaluation || null;
      } else if (response.status === 404) {
        return null; // No evaluation found
      } else {
        throw new Error('Database query failed');
      }
    } catch (error) {
      console.warn('Could not load evaluation from database, checking localStorage:', error.message);
      
      // Fallback to localStorage
      try {
        const evaluations = JSON.parse(localStorage.getItem('evaluations') || '[]');
        const evaluation = evaluations.find(e => 
          e.user_data?.userId === userId && 
          e.patient_id === patientId && 
          e.recommendation_type === recommendationType
        );
        return evaluation || null;
      } catch (error) {
        console.error('Error loading evaluation:', error);
        return null;
      }
    }
  }

  async getEvaluationStats() {
    const evaluations = await this.loadEvaluations();
    
    if (evaluations.length === 0) {
      return {
        totalEvaluations: 0,
        averageRatings: {},
        trustDistribution: {},
        implementationDistribution: {}
      };
    }

    // Calculate statistics
    const totalEvaluations = evaluations.length;
    
    // Average ratings
    const ratingCategories = [
      'clinical_accuracy', 'evidence_quality', 'completeness', 
      'safety_considerations', 'clinical_applicability', 'clarity', 
      'guideline_adherence', 'overall_quality'
    ];
    
    const averageRatings = {};
    ratingCategories.forEach(category => {
      const ratings = evaluations.map(e => e.ratings[category]).filter(r => r !== undefined);
      averageRatings[category] = ratings.length > 0 
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
        : 0;
    });

    // Trust distribution
    const trustDistribution = {};
    evaluations.forEach(e => {
      const trust = e.trust_level;
      trustDistribution[trust] = (trustDistribution[trust] || 0) + 1;
    });

    // Implementation distribution
    const implementationDistribution = {};
    evaluations.forEach(e => {
      const impl = e.implementation_willingness;
      implementationDistribution[impl] = (implementationDistribution[impl] || 0) + 1;
    });

    return {
      totalEvaluations,
      averageRatings,
      trustDistribution,
      implementationDistribution,
      evaluations
    };
  }
}

export default new DataService();