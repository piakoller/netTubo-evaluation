import React, { useState, useEffect } from 'react';
import { Card, Select, Typography, Row, Col, Button, message, Progress, Alert } from 'antd';
import { UserOutlined, MedicineBoxOutlined, CheckCircleOutlined } from '@ant-design/icons';
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
  // Preference order:
  // 1) Next higher ID than current among NOT completed
  // 2) Smallest ID among NOT completed
  // 3) null if all completed or none
  const pickNextPatientId = (patientsMap, completedSet, currentId = null) => {
    const sorted = getSortedIds(patientsMap);
    const notCompleted = sorted.filter((id) => !completedSet.has(id));
    if (notCompleted.length === 0) return null;

    if (currentId != null) {
      const numeric = /^\d+$/.test(String(currentId));
      if (numeric) {
        const cur = Number(currentId);
        const nextHigher = notCompleted.find((id) => Number(id) > cur);
        if (nextHigher) return nextHigher;
      } else {
        const idx = notCompleted.findIndex((id) => id === currentId);
        if (idx >= 0 && idx + 1 < notCompleted.length) return notCompleted[idx + 1];
      }
    }
    // Fallback to smallest available
    return notCompleted[0];
  };

  useEffect(() => {
    loadPatients();
    loadCompletedEvaluations();
  }, []);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const patientData = await dataService.loadPatientRecommendations();
      setPatients(patientData);

      // Auto-select a patient if none selected or current selection is invalid
      const nextId = pickNextPatientId(patientData, completedEvaluations, selectedPatientId);
      if (!selectedPatientId || !patientData[selectedPatientId]) {
        if (nextId) handlePatientSelect(nextId);
      }
    } catch (error) {
      message.error('Failed to load patient data');
      console.error('Error loading patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompletedEvaluations = () => {
    const completed = localStorage.getItem(`completedEvaluations_${userData?.userId}`);
    if (completed) {
      setCompletedEvaluations(new Set(JSON.parse(completed)));
    }
  };

  const saveCompletedEvaluation = (patientId) => {
    const newCompleted = new Set([...completedEvaluations, patientId]);
    setCompletedEvaluations(newCompleted);
    localStorage.setItem(`completedEvaluations_${userData?.userId}`, JSON.stringify([...newCompleted]));
  };

  const handlePatientSelect = (patientId) => {
    setSelectedPatientId(patientId);
    setSelectedPatient(patients[patientId]);
  };

  // Auto-select if selection becomes empty or invalid due to data refresh
  useEffect(() => {
    const current = selectedPatientId;
    const currentExists = current && patients[current];
    if (!selectedPatient || !currentExists) {
      const nextId = pickNextPatientId(patients, completedEvaluations, currentExists ? current : null);
      if (nextId && nextId !== current) {
        handlePatientSelect(nextId);
      }
    }
  }, [patients, selectedPatient, selectedPatientId, completedEvaluations]);

  const handleEvaluationSubmit = async (evaluationData) => {
    try {
      setSubmitting(true);
      
      const evaluation = {
        patient_id: selectedPatientId,
        user_data: userData,
        timestamp: new Date().toISOString(),
        ...evaluationData
      };

      // Save evaluation to database (API call would go here)
      console.log('Evaluation submitted:', evaluation);
      
      // Mark this patient as completed
      const updatedCompleted = new Set([...completedEvaluations, selectedPatientId]);
      setCompletedEvaluations(updatedCompleted);
      localStorage.setItem(`completedEvaluations_${userData?.userId}`, JSON.stringify([...updatedCompleted]));
      
      message.success('Evaluation submitted successfully!');
      
      // Auto-select next patient if available
      const nextPatient = pickNextPatientId(patients, updatedCompleted, selectedPatientId);

      if (nextPatient) {
        setTimeout(() => {
          handlePatientSelect(nextPatient);
          message.info('Loading next patient case...');
        }, 1500);
      } else {
        // All patients completed
        setSelectedPatientId(null);
        setSelectedPatient(null);
        message.success('All evaluations completed! Thank you for your participation.');
      }
      
    } catch (error) {
      message.error('Failed to submit evaluation');
      console.error('Error submitting evaluation:', error);
    } finally {
      setSubmitting(false);
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
          Patient Case Evaluation
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
                const p = patients[patientId] || {};
                const q = (p.clinical_question || '').toString().trim();
                const shortQ = q ? (q.length > 80 ? q.slice(0, 77) + '…' : q) : '';
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
                patientId={selectedPatientId}
              />
            </Col>
          </Row>

          <Card style={{ marginTop: '24px' }}>
            <Title level={3}>Evaluation Form</Title>
            <EvaluationForm 
              onSubmit={handleEvaluationSubmit}
              loading={submitting}
            />
          </Card>
        </>
      )}

      {!selectedPatient && Object.keys(patients).length > 0 && (
        <Card style={{ marginTop: '24px', textAlign: 'center', padding: '48px' }}>
          <UserOutlined style={{ fontSize: '48px', color: '#ccc', marginBottom: '16px' }} />
          <Title level={3} style={{ color: '#ccc' }}>
            Select a patient to begin evaluation
          </Title>
        </Card>
      )}
    </div>
  );
};

export default PatientEvaluation;