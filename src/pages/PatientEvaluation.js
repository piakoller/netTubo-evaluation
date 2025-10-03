import React, { useState, useEffect, useCallback } from 'react';
import { Card, Select, Typography, Row, Col, Button, message, Progress, Alert } from 'antd';
import { UserOutlined, MedicineBoxOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import PatientInfo from '../components/PatientInfo';
import TherapyRecommendation from '../components/TherapyRecommendation';
import EvaluationForm from '../components/EvaluationForm';
import dataService from '../services/dataService';

const { Title, Text } = Typography;
const { Option } = Select;

const PatientEvaluation = ({ userData }) => {
  const [patients, setPatients] = useState({});
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completedEvaluations, setCompletedEvaluations] = useState(new Set());
  const [studyCompleted, setStudyCompleted] = useState(false);

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

  const handleRestartStudy = () => {
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
  };

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

  

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
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

      <Card>
        <Title level={2}>
          <MedicineBoxOutlined style={{ marginRight: '8px' }} />
          Recommendation
        </Title>
        
        {completedCount === totalPatients ? (
          <Alert
            message="Study Completed!"
            description="Thank you for completing all patient evaluations. Your responses have been recorded for research purposes."
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            style={{ marginTop: '24px' }}
          />
        ) : (
          <div style={{ marginBottom: '24px' }}>
            <Title level={4}>Select Patient Case:</Title>
            <Select
              style={{ width: '400px' }}
              placeholder="Choose a patient case to evaluate"
              value={selectedPatientId}
              onChange={handlePatientSelect}
            >
              {Object.keys(patients).map(patientId => {
                const isCompleted = completedEvaluations.has(patientId);
                const label = `Patient ${patientId}`;
                return (
                  <Option key={patientId} value={patientId} disabled={isCompleted}>
                    {label} {isCompleted && ' ✓ Completed'}
                  </Option>
                );
              })}
            </Select>
          </div>
        )}
      </Card>

      {selectedPatient && (
        <>
          <Row gutter={[24, 24]} style={{ marginTop: '24px' }}>
            <Col xs={24} lg={24}>
              <PatientInfo 
                patient={selectedPatient}
                showExpertRecommendation={completedEvaluations.has(selectedPatientId)}
              />
            </Col>
            <Col xs={24} lg={24}>
              <TherapyRecommendation 
                recommendation={selectedPatient.recommendation} 
                baselineRecommendation={selectedPatient.baseline_recommendation}
                patientId={selectedPatientId}
                trialData={selectedPatient.trial_data}
              />
            </Col>
          </Row>

          <Card style={{ marginTop: '24px' }}>
            <Title level={3}>Evaluation Form</Title>
            <EvaluationForm 
              onSubmit={handleEvaluationSubmit}
              onExpertSubmit={handleExpertEvaluationSubmit}
              loading={submitting}
              expertRecommendation={selectedPatient.expert_recommendation}
            />
          </Card>
        </>
      )}

      {!selectedPatient && Object.keys(patients).length > 0 && !studyCompleted && (
        <Card style={{ marginTop: '24px', textAlign: 'center', padding: '48px' }}>
          <UserOutlined style={{ fontSize: '48px', color: '#ccc', marginBottom: '16px' }} />
          <Title level={3} style={{ color: '#ccc' }}>
            Select a patient to begin evaluation
          </Title>
        </Card>
      )}

      {!selectedPatient && studyCompleted && (
        <Card style={{ 
          marginTop: '24px', 
          textAlign: 'center', 
          padding: '48px',
          border: '2px solid #52c41a',
          backgroundColor: '#f6ffed'
        }}>
          <CheckCircleOutlined style={{ 
            fontSize: '64px', 
            color: '#52c41a', 
            marginBottom: '24px' 
          }} />
          <Title level={2} style={{ color: '#52c41a', marginBottom: '16px' }}>
            🎉 Study Completed!
          </Title>
          <Typography.Paragraph style={{ 
            fontSize: '16px', 
            color: '#389e0d', 
            marginBottom: '32px',
            maxWidth: '600px',
            margin: '0 auto 32px auto'
          }}>
            Thank you for your participation in the NetTubo evaluation study! 
            Your evaluations have been successfully submitted and will contribute to 
            advancing AI-assisted clinical decision making in oncology.
          </Typography.Paragraph>
          <Button 
            type="primary" 
            size="large"
            icon={<ReloadOutlined />}
            onClick={handleRestartStudy}
            style={{ minWidth: '200px' }}
          >
            Restart Study
          </Button>
        </Card>
      )}
    </div>
  );
};

export default PatientEvaluation;