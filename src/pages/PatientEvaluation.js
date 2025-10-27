import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Row, Col, message, Progress, Button } from 'antd';
import { MedicineBoxOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import PatientInfo from '../components/PatientInfo';
import EvaluationForm from '../components/EvaluationForm';
import dataService from '../services/dataService';
import TherapyRecommendation from '../components/TherapyRecommendation';

const { Title, Text } = Typography;

const PatientEvaluation = ({ userData }) => {
  const [patients, setPatients] = useState({});
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completedEvaluations, setCompletedEvaluations] = useState(new Set());
  const [studyCompleted, setStudyCompleted] = useState(false);
  const [shuffledRecommendations, setShuffledRecommendations] = useState({});

  // Helper: Shuffle recommendations for a patient and store the order
  const getShuffledRecommendation = useCallback((patient) => {
    if (!patient) return null;

    // Check if we have already shuffled for this patient
    if (shuffledRecommendations[patient.patient_id]) {
      return shuffledRecommendations[patient.patient_id];
    }

    const recommendations = [
      { type: 'agentic', data: patient.recommendation },
      { type: 'baseline', data: patient.baseline_recommendation }
    ].filter(rec => rec.data); // Filter out any null/undefined recommendations

    // Shuffle the array
    const shuffled = recommendations.sort(() => 0.5 - Math.random());
    
    // Store the shuffled order
    const newShuffled = { ...shuffledRecommendations, [patient.patient_id]: shuffled[0] };
    setShuffledRecommendations(newShuffled);

    return shuffled[0];
  }, [shuffledRecommendations]);

  // When a new patient is selected, get a shuffled recommendation
  useEffect(() => {
    if (selectedPatient) {
      getShuffledRecommendation(selectedPatient);
    }
  }, [selectedPatient, getShuffledRecommendation]);

  const currentRecommendation = selectedPatient ? getShuffledRecommendation(selectedPatient) : null;


  // Helper: normalize and sort patient IDs numerically when possible
  const getSortedIds = (obj) => {
    const ids = Object.keys(obj || {});
    const allNumeric = ids.every((id) => /^\d+$/.test(String(id)));
    if (allNumeric) {
      return ids.sort((a, b) => Number(a) - Number(b));
    }
    return ids.sort();
  };

  // Helper: pick next patient id
  // Always start with Patient 1 and proceed sequentially: 1 → 2 → 3
  // Skip completed patients and always pick the lowest numbered incomplete patient
  const pickNextPatientId = useCallback((patientsMap, completedSet, currentId = null) => {
    const sorted = getSortedIds(patientsMap);
    const notCompleted = sorted.filter((id) => !completedSet.has(id));
    if (notCompleted.length === 0) return null;

    // Always return the smallest (first) available patient ID
    // This ensures we go: 1 → 2 → 3 in order
    return notCompleted[0];
  }, []);

  const loadCompletedEvaluations = useCallback(async () => {
    try {
      // Try to load from database first
      if (userData?.userId) {
        const response = await fetch(`http://localhost:5001/api/users/${userData.userId}`);
        if (response.ok) {
          const result = await response.json();
          const completedSet = new Set(result.user?.completedEvaluations || []);
          setCompletedEvaluations(completedSet);
          console.log('Loaded completed evaluations from database:', completedSet.size);
          return;
        }
      }
    } catch (error) {
      console.warn('Could not load completed evaluations from database:', error.message);
    }
    
    // Fallback to localStorage
    const completed = localStorage.getItem(`completedEvaluations_${userData?.userId}`);
    if (completed) {
      setCompletedEvaluations(new Set(JSON.parse(completed)));
    }
  }, [userData?.userId]);

  useEffect(() => {
    // Load completed evaluations first, then patients
    // This ensures proper auto-selection on page load
    const loadData = async () => {
      await loadCompletedEvaluations();
      await loadPatients();
    };
    loadData();
  }, [loadCompletedEvaluations]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const patientData = await dataService.loadPatientRecommendations();
      setPatients(patientData);

      // Auto-selection will be handled by the useEffect that watches for changes
      // in patients and completedEvaluations
    } catch (error) {
      message.error('Failed to load patient data');
      console.error('Error loading patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveCompletedEvaluation = async (patientId) => {
    const newCompleted = new Set([...completedEvaluations, patientId]);
    setCompletedEvaluations(newCompleted);
    
    // Save to localStorage as backup
    localStorage.setItem(`completedEvaluations_${userData?.userId}`, JSON.stringify([...newCompleted]));
    
    // Update in database
    try {
      if (userData?.userId) {
        const response = await fetch(`http://localhost:5001/api/users/${userData.userId}/completed`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ patientId })
        });
        
        if (response.ok) {
          console.log('Updated completed evaluations in database');
        } else {
          console.warn('Could not update completed evaluations in database');
        }
      }
    } catch (error) {
      console.warn('Error updating completed evaluations in database:', error.message);
    }
  };

  const handlePatientSelect = useCallback((patientId) => {
    setSelectedPatientId(patientId);
    setSelectedPatient(patients[patientId]);
    
    // Scroll to top when selecting a new patient
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [patients]);

  // Auto-select if selection becomes empty or invalid due to data refresh
  // Always ensures Patient 1 is selected first (if not completed), then Patient 2, etc.
  useEffect(() => {
    const current = selectedPatientId;
    const currentExists = current && patients[current];
    
    // If no patient is selected, or current selection doesn't exist, or both patients and completedEvaluations are loaded
    if (!selectedPatient || !currentExists || (Object.keys(patients).length > 0 && !selectedPatientId)) {
      const nextId = pickNextPatientId(patients, completedEvaluations, currentExists ? current : null);
      if (nextId && nextId !== current) {
        console.log(`Auto-selecting next patient: ${nextId}`);
        handlePatientSelect(nextId);
      }
    }
  }, [patients, selectedPatient, selectedPatientId, completedEvaluations, pickNextPatientId, handlePatientSelect]);

  const handleEvaluationSubmit = async (evaluationData) => {
    try {
      setSubmitting(true);
      
      const evaluation = {
        patient_id: selectedPatientId,
        user_data: userData,
        recommendation_type: currentRecommendation?.type, // Store whether 'agentic' or 'baseline' was shown
        timestamp: new Date().toISOString(),
        evaluationStartTime: new Date().toISOString(), // You might want to track actual start time
        ...evaluationData
      };

      // Save evaluation to database
      await dataService.saveEvaluation(evaluation);
      
      // Mark this patient as completed
      await saveCompletedEvaluation(selectedPatientId);
      
      message.success('Evaluation submitted successfully!');
      
      // Check if there are more patients available
      const nextPatient = pickNextPatientId(patients, new Set([...completedEvaluations, selectedPatientId]), selectedPatientId);

      // If there's no expert recommendation, handle progression immediately
      if (!selectedPatient.expert_recommendation) {
        if (nextPatient) {
          // There are more patients - proceed to next one
          setTimeout(() => {
            handlePatientSelect(nextPatient);
            message.info('Loading next patient case...');
          }, 1500);
        } else {
          // This is the last patient - show completion
          setTimeout(() => {
            setSelectedPatientId(null);
            setSelectedPatient(null);
            setStudyCompleted(true);
            message.success('All evaluations completed! Thank you for your participation.');
          }, 1500);
        }
      } else {
        // There is an expert recommendation - the expert evaluation modal will handle progression
        console.log('Expert recommendation exists - waiting for expert evaluation');
      }
      
    } catch (error) {
      message.error('Failed to submit evaluation');
      console.error('Error submitting evaluation:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExpertEvaluationSubmit = async (expertEvaluationData) => {
    try {
      const expertEvaluation = {
        patient_id: selectedPatientId,
        user_data: userData,
        timestamp: new Date().toISOString(),
        evaluation_type: 'expert_recommendation',
        ...expertEvaluationData
      };

      // Save expert evaluation to database
      await dataService.saveEvaluation(expertEvaluation);
      
      message.success('Expert evaluation submitted successfully!');
      
      // Now handle next patient or completion
      const nextPatient = pickNextPatientId(patients, new Set([...completedEvaluations, selectedPatientId]), selectedPatientId);

      if (nextPatient) {
        // There are more patients - proceed to next one
        setTimeout(() => {
          handlePatientSelect(nextPatient);
          message.info('Loading next patient case...');
        }, 1500);
      } else {
        // All patients completed - show completion screen
        setTimeout(() => {
          setSelectedPatientId(null);
          setSelectedPatient(null);
          setStudyCompleted(true);
          message.success('All evaluations completed! Thank you for your participation.');
        }, 1500);
      }
      
    } catch (error) {
      console.error('Error submitting expert evaluation:', error);
      message.error('Failed to submit expert evaluation. Please try again.');
    }
  };

  const handleRestartStudy = useCallback(() => {
    // Clear all completed evaluations
    setCompletedEvaluations(new Set());
    setStudyCompleted(false);
    
    // Clear localStorage
    if (userData?.userId) {
      localStorage.removeItem(`completedEvaluations_${userData.userId}`);
    }
    
    // Reset to first patient
    const firstPatientId = pickNextPatientId(patients, new Set(), null);
    if (firstPatientId) {
      handlePatientSelect(firstPatientId);
      message.info('Study restarted. Starting with Patient 1...');
    }
  }, [handlePatientSelect, patients, pickNextPatientId, userData?.userId]);

  if (loading) {
    return (
      <Card loading={true} style={{ minHeight: '400px' }}>
        <div>Loading patient data...</div>
      </Card>
    );
  }

  const totalPatients = Object.keys(patients).length;
  const completedCount = completedEvaluations.size;
  const progressPercent = totalPatients > 0 ? (completedCount / totalPatients) * 100 : 0;

  if (studyCompleted) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', textAlign: 'center' }}>
        <Card>
          <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '24px' }} />
          <Title level={2}>Study Completed</Title>
          <Text style={{ fontSize: '16px', display: 'block', marginBottom: '32px' }}>
            Thank you for completing all the evaluations. Your participation is greatly appreciated!
          </Text>
          <Button type="primary" icon={<ReloadOutlined />} onClick={handleRestartStudy}>
            Restart Study
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
      {/* User Info Header */}
      <Card style={{ marginBottom: '16px' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Text strong>Participant: </Text>
            <Text>{userData?.userId}</Text>
            <Text style={{ marginLeft: '16px' }}>
              {userData?.profession} | {userData?.yearsExperience} years experience
            </Text>
          </Col>
          <Col>
            <Text strong>Progress: </Text>
            <Text>{completedCount}/{totalPatients} cases completed</Text>
            <Progress 
              percent={progressPercent.toFixed(1)} 
              size="small" 
              style={{ width: '200px', marginLeft: '16px' }}
            />
          </Col>
        </Row>
      </Card>

      {/* Patient Information */}
      {selectedPatient && (
        <Card style={{ marginBottom: 16 }}>
          <PatientInfo patient={selectedPatient} />
        </Card>
      )}

      <Card>
        <Row gutter={[16, 16]}>
          {/* Left column: Recommendation */}
          <Col xs={24} lg={12}>
            <Title level={2}>
              <MedicineBoxOutlined style={{ marginRight: '8px' }} />
              Recommendation
            </Title>
            {selectedPatient && currentRecommendation ? (
              <TherapyRecommendation
                recommendation={currentRecommendation.data}
                trialData={selectedPatient.trial_data || []}
                recommendationType={currentRecommendation.type}
              />
            ) : (
              <Card>
                <p>No recommendation to display.</p>
              </Card>
            )}
          </Col>

          {/* Right column: Evaluation */}
          <Col xs={24} lg={12}>
            <Title level={2}>
              <CheckCircleOutlined style={{ marginRight: '8px' }} />
              Evaluation
            </Title>
            {selectedPatient ? (
              <EvaluationForm
                key={selectedPatientId} // Force re-render on patient change
                onSubmit={handleEvaluationSubmit}
                onExpertSubmit={handleExpertEvaluationSubmit}
                loading={submitting}
                expertRecommendation={selectedPatient.expert_recommendation}
              />
            ) : (
              <Card>
                <p>Select a patient to begin evaluation.</p>
              </Card>
            )}
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default PatientEvaluation;