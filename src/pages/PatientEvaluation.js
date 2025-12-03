import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Row, Col, message, Progress, Button } from 'antd';
import { MedicineBoxOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import PatientInfo from '../components/PatientInfo';
import EvaluationForm from '../components/EvaluationForm';
import { useRef } from 'react';
import dataService from '../services/dataService';
import TherapyRecommendation from '../components/TherapyRecommendation';

const { Title, Text } = Typography;

// Helper function (assuming sorting by case_id or similar)
// Moved outside the component to avoid being part of its definition
const getSortedIds = (patients) => {
  if (!patients) return [];
  // Example sorting logic, adjust as needed
  return Object.keys(patients).sort((a, b) => (patients[a]?.case_id || 0) - (patients[b]?.case_id || 0));
};

const PatientEvaluation = ({ userData }) => {
  // --- State Definitions ---
  // Merged from the top of the broken file
  const [patients, setPatients] = useState({});
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  
  // Inferred from usage in the broken file
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [recommendationQueues, setRecommendationQueues] = useState({});
  const [completedEvaluations, setCompletedEvaluations] = useState(new Set());
  const [studyCompleted, setStudyCompleted] = useState(false);
  // Track a patient that is awaiting expert-evaluation so we keep the form mounted
  const [pendingExpertPatientId, setPendingExpertPatientId] = useState(null);
  // Ref to trigger expert modal in EvaluationForm
  const expertModalTriggerRef = useRef(null);

  // --- Data Loading Effect ---
  // Load patients from dataService and build recommendation queues (baseline then agentic)
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const fetchedPatients = await dataService.loadPatientRecommendations();
        const patientsMap = fetchedPatients || {};
        setPatients(patientsMap);

        // DEBUG: Log patient data structure
        console.log('=== PATIENT DATA DEBUG ===');
        console.log('Total patients loaded:', Object.keys(patientsMap).length);
        console.log('Patient IDs:', Object.keys(patientsMap));
        
        // Log each patient's data
        Object.entries(patientsMap).forEach(([id, patient]) => {
          console.log(`\nPatient ${id}:`, {
            case_id: patient?.case_id,
            has_baseline: !!patient?.baseline_recommendation,
            has_agentic: !!patient?.recommendation,
            has_expert: !!patient?.expert_recommendation,
            baseline_source: patient?.baseline_recommendation?.source,
            agentic_source: patient?.recommendation?.source
          });
        });
        console.log('========================\n');

        // build queues: randomize order of baseline and agentic per patient
        // using patient index as seed for consistent ordering across sessions
        const queues = {};
        const sortedPatientIds = getSortedIds(patientsMap);
        
        sortedPatientIds.forEach((pid, index) => {
          const p = patientsMap[pid];
          const q = [];
          
          // Check if both recommendations exist
          const hasBaseline = !!p?.baseline_recommendation;
          const hasAgentic = !!p?.recommendation;
          
          if (hasBaseline && hasAgentic) {
            // Randomize order based on patient index (even/odd)
            // Even index: baseline first, Odd index: agentic first
            if (index % 2 === 0) {
              q.push('baseline');
              q.push('agentic');
            } else {
              q.push('agentic');
              q.push('baseline');
            }
          } else {
            // If only one exists, add it
            if (hasBaseline) q.push('baseline');
            if (hasAgentic) q.push('agentic');
          }
          
          queues[pid] = q;
        });
        
        // DEBUG: Log the randomized queue order for each patient
        console.log('=== RECOMMENDATION ORDER DEBUG ===');
        sortedPatientIds.forEach((pid, index) => {
          console.log(`Patient ${pid} (index ${index}):`, queues[pid].join(' → '));
        });
        console.log('==================================\n');
        
        setRecommendationQueues(queues);

        // Load completed status from localStorage as fallback
        const savedCompleted = localStorage.getItem(`completedEvaluations_${userData?.userId}`);
        if (savedCompleted) setCompletedEvaluations(new Set(JSON.parse(savedCompleted)));
      } catch (err) {
        console.error('Failed to load data', err);
        message.error('Failed to load patient data');
      } finally {
        setLoading(false);
      }
    };

    if (userData?.userId) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [userData]);

  // --- Auto-select Next Patient Effect ---
  // This logic was floating in the original file
  useEffect(() => {
    if (loading || Object.keys(patients).length === 0) return; // Don't run until loaded
    // If an expert evaluation is pending for a patient, keep that patient selected
    if (pendingExpertPatientId) {
      if (pendingExpertPatientId !== selectedPatientId) {
        setSelectedPatientId(pendingExpertPatientId);
        setSelectedPatient(patients[pendingExpertPatientId]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const sorted = getSortedIds(patients);
    const next = sorted.find((id) => (recommendationQueues[id] || []).length > 0 && !completedEvaluations.has(id));

    if (next && next !== selectedPatientId) {
      setSelectedPatientId(next);
      setSelectedPatient(patients[next]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Check if study is complete
    const anyRemaining = Object.keys(recommendationQueues).some((id) => (recommendationQueues[id] || []).length > 0 && !completedEvaluations.has(id));
    if (!anyRemaining && Object.keys(patients).length > 0) {
      setStudyCompleted(true);
    }
  }, [patients, recommendationQueues, completedEvaluations, selectedPatientId, loading]);

  // --- Derived State ---
  // Get the current recommendation object (type + data) for the selected patient
  const getCurrentRecommendation = useCallback(() => {
    if (!selectedPatientId || !selectedPatient) return null;
    const q = recommendationQueues[selectedPatientId] || [];
    const t = q.length > 0 ? q[0] : null;
    if (!t) return null;
    return t === 'baseline' ? { type: 'baseline', data: selectedPatient.baseline_recommendation } : { type: 'agentic', data: selectedPatient.recommendation };
  }, [recommendationQueues, selectedPatient, selectedPatientId]);

  const currentRecommendation = getCurrentRecommendation();

  // --- Effect: Auto-open expert modal when needed ---
  useEffect(() => {
    if (
      selectedPatient &&
      recommendationQueues[selectedPatientId]?.length === 0 &&
      selectedPatient.expert_recommendation &&
      pendingExpertPatientId === selectedPatientId &&
      expertModalTriggerRef.current
    ) {
      // Call the trigger function in EvaluationForm
      expertModalTriggerRef.current();
    }
  }, [selectedPatient, selectedPatientId, recommendationQueues, pendingExpertPatientId]);
  
  const saveCompletedEvaluation = useCallback(async (patientId) => {
    const newCompleted = new Set([...completedEvaluations, patientId]);
    setCompletedEvaluations(newCompleted);
    localStorage.setItem(`completedEvaluations_${userData?.userId}`, JSON.stringify([...newCompleted]));
    try {
      if (userData?.userId) {
        await fetch(`http://localhost:5001/api/users/${userData.userId}/completed`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientId })
        });
      }
    } catch (err) {
      console.warn('Error updating completed evaluations in DB', err.message);
    }
  }, [completedEvaluations, userData?.userId]);

  const handlePatientSelect = useCallback((patientId) => {
    setSelectedPatientId(patientId);
    setSelectedPatient(patients[patientId]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [patients]);

  // Merged the two duplicate functions from the original file
  const handleEvaluationSubmit = useCallback(async (evaluationData) => {
    if (!selectedPatientId) return;
    setSubmitting(true);
    try {
      const evaluation = {
        patient_id: selectedPatientId,
        user_data: userData,
        recommendation_type: currentRecommendation?.type,
        timestamp: new Date().toISOString(),
        ...evaluationData
      };
      await dataService.saveEvaluation(evaluation);
      message.success('Evaluation submitted');

      // compute updated queue synchronously
      const newQueues = { ...recommendationQueues };
      const q = Array.isArray(newQueues[selectedPatientId]) ? [...newQueues[selectedPatientId]] : [];
      q.shift(); // Remove the item that was just evaluated
      newQueues[selectedPatientId] = q;
      setRecommendationQueues(newQueues);

      // if queue now empty, persist completed flag
      if (!q || q.length === 0) {
        // If there is an expert recommendation, defer marking completed
        // until the expert evaluation has been submitted. This avoids
        // unmounting the EvaluationForm (which holds the expert modal)
        // before the modal can be shown.
        if (selectedPatient?.expert_recommendation) {
          // mark this patient as pending expert evaluation so we keep it selected
          setPendingExpertPatientId(selectedPatientId);
          // ensure the selectedPatient stays in state (no-op if already set)
          setSelectedPatient(patients[selectedPatientId]);
        } else {
          await saveCompletedEvaluation(selectedPatientId);
        }
        // Otherwise: leave the patient selected and wait for expert evaluation
      } else {
        // keep same patient selected so that evaluationType changes and form re-renders
        // (key uses recommendation type)
        setSelectedPatient(patients[selectedPatientId]);
      }
    } catch (err) {
      console.error('Error saving evaluation', err);
      message.error('Failed to save evaluation');
    } finally {
      setSubmitting(false);
    }
  }, [selectedPatientId, userData, currentRecommendation, recommendationQueues, patients, saveCompletedEvaluation]);

  const handleExpertEvaluationSubmit = useCallback(async (expertEvaluationData) => {
    if (!selectedPatientId) return;
    try {
      const payload = { 
        patient_id: selectedPatientId, 
        user_data: userData, 
        timestamp: new Date().toISOString(), 
        evaluation_type: 'expert_recommendation', 
        ...expertEvaluationData 
      };
      await dataService.saveEvaluation(payload);
      message.success('Expert evaluation submitted');

      // If current patient still has remaining items, continue; otherwise auto-select will pick next
      const q = recommendationQueues[selectedPatientId] || [];
      if (q.length > 0) {
        setSelectedPatient(patients[selectedPatientId]);
      }
      // If queue is empty and this patient was pending expert evaluation, mark it completed
      if ((q.length === 0) && pendingExpertPatientId === selectedPatientId) {
        // clear pending flag and persist completed
        setPendingExpertPatientId(null);
        await saveCompletedEvaluation(selectedPatientId);
      }
    } catch (err) {
      console.error('Error saving expert evaluation', err);
      message.error('Failed to save expert evaluation');
    }
  }, [selectedPatientId, userData, recommendationQueues, patients, pendingExpertPatientId, saveCompletedEvaluation, setPendingExpertPatientId]);

  const handleRestartStudy = useCallback(() => {
    setCompletedEvaluations(new Set());
    setStudyCompleted(false);
    if (userData?.userId) {
      localStorage.removeItem(`completedEvaluations_${userData.userId}`);
    }
    // Let the auto-select useEffect find the first patient
    // Resetting selected patient id to trigger the effect
    setSelectedPatientId(null);
    setSelectedPatient(null);
  }, [userData?.userId]);

  // --- Render Logic ---

  if (loading) {
    return <Card loading style={{ minHeight: 400 }}>Loading patient data...</Card>;
  }

  const totalPatients = Object.keys(patients).length;
  const completedCount = completedEvaluations.size;
  const progressPercent = totalPatients > 0 ? (completedCount / totalPatients) * 100 : 0;

  if (studyCompleted) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', textAlign: 'center' }}>
        <Card>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 24 }} />
          <Title level={2}>Study Completed</Title>
          <Text style={{ fontSize: 16, display: 'block', marginBottom: 32 }}>Thank you for completing all the evaluations. Your participation is greatly appreciated!</Text>
          <Button type="primary" icon={<ReloadOutlined />} onClick={handleRestartStudy}>Restart Study</Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Text strong>Participant: </Text>
            <Text>{userData?.userId}</Text>
            <Text style={{ marginLeft: 16 }}>{userData?.profession} | {userData?.yearsExperience} years experience</Text>
          </Col>
          <Col>
            <Text strong>Progress: </Text>
            <Text>{completedCount}/{totalPatients} cases completed</Text>
            <Progress percent={progressPercent.toFixed(1)} size="small" style={{ width: 200, marginLeft: 16 }} />
          </Col>
        </Row>
      </Card>

      {selectedPatient && (
        <Card style={{ marginBottom: 16 }}>
          <PatientInfo patient={selectedPatient} />
        </Card>
      )}

      <Card>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Title level={2}><MedicineBoxOutlined style={{ marginRight: 8 }} />Recommendation</Title>
            {selectedPatient && currentRecommendation ? (
              <TherapyRecommendation 
                recommendation={currentRecommendation.data} 
                trialData={selectedPatient.trial_data || []} 
                recommendationType={currentRecommendation.type} 
              />
            ) : (
              <Card><p>{selectedPatient ? "This patient's queue is complete." : "No recommendation to display."}</p></Card>
            )}
          </Col>

          <Col xs={24} lg={12}>
            <Title level={2}><CheckCircleOutlined style={{ marginRight: 8 }} />Evaluation</Title>
            {selectedPatient ? (
              <EvaluationForm
                key={`${selectedPatientId}-${pendingExpertPatientId === selectedPatientId ? 'expert' : (currentRecommendation?.type || 'none')}`}
                onSubmit={handleEvaluationSubmit}
                onExpertSubmit={handleExpertEvaluationSubmit}
                loading={submitting}
                expertRecommendation={selectedPatient.expert_recommendation}
                recommendationType={currentRecommendation?.type}
                expertModalTriggerRef={expertModalTriggerRef}
              />
            ) : (
              <Card><p>Select a patient to begin evaluation.</p></Card>
            )}
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default PatientEvaluation;