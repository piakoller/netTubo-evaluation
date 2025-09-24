import React, { useState, useEffect } from 'react';
import { Layout, Typography, message } from 'antd';
import UserRegistration from './components/UserRegistration';
import StudyInstructions from './components/StudyInstructions';
import PatientEvaluation from './pages/PatientEvaluation';
import './App.css';

const { Header, Content } = Layout;
const { Title } = Typography;

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const [currentStep, setCurrentStep] = useState('registration'); // registration, instructions, evaluation
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    // Check if user is already registered in this session
    const existingUserData = localStorage.getItem('userStudyData');
    if (existingUserData) {
      const parsedData = JSON.parse(existingUserData);
      setUserData(parsedData);
      setCurrentStep('evaluation'); // Skip to evaluation if already registered
    }
  }, []);

  const handleRegistrationComplete = (userData) => {
    setUserData(userData);
    setCurrentStep('instructions');
    messageApi.success('Registration successful! Please read the instructions.');
  };

  const handleStartEvaluation = () => {
    setCurrentStep('evaluation');
    messageApi.info('Starting patient case evaluations. Good luck!');
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'registration':
        return <UserRegistration onRegistrationComplete={handleRegistrationComplete} />;
      case 'instructions':
        return <StudyInstructions onStartEvaluation={handleStartEvaluation} userData={userData} />;
      case 'evaluation':
        return <PatientEvaluation userData={userData} />;
      default:
        return <UserRegistration onRegistrationComplete={handleRegistrationComplete} />;
    }
  };

  return (
    <>
      {contextHolder}
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Title level={3} style={{ color: 'white', margin: 0 }}>
            AI Therapy Evaluation Study
          </Title>
        </Header>
        
        <Content style={{ padding: '24px', background: '#f0f2f5' }}>
          {renderCurrentStep()}
        </Content>
      </Layout>
    </>
  );
}

export default App;
