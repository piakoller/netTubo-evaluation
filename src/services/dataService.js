// Data service for loading LLM therapy recommendatijs
class DataService {
  constructor() {
    this.baseURL = 'http://localhost:5001/api';
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
      if (error.message.includes('fetch')) {
        throw new Error('Backend server is not running. Please start the backend server on port 5001.');
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

  // Mock evaluation storage (in real app, would save to file system or database)
  async saveEvaluation(evaluation) {
    console.log('Saving evaluation:', evaluation);
    
    // Store in localStorage for demo purposes
    const evaluations = JSON.parse(localStorage.getItem('evaluations') || '[]');
    evaluation.id = Date.now().toString();
    evaluation.timestamp = new Date().toISOString();
    evaluations.push(evaluation);
    localStorage.setItem('evaluations', JSON.stringify(evaluations));
    
    return evaluation;
  }

  async loadEvaluations() {
    try {
      const evaluations = JSON.parse(localStorage.getItem('evaluations') || '[]');
      return evaluations;
    } catch (error) {
      console.error('Error loading evaluations:', error);
      return [];
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