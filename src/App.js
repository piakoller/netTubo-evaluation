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
    const verifyUser = async () => {
      const storedUserData = localStorage.getItem('userStudyData');
      if (storedUserData) {
        const parsedData = JSON.parse(storedUserData);
        if (parsedData.userId) {
          try {
            const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:3001';
            const response = await fetch(`${apiBase}/api/users/verify/${parsedData.userId}`);

            if (response.ok) {
              const verifiedUser = await response.json();
              setUserData(verifiedUser);
              setCurrentStep('evaluation'); // Proceed to evaluation
            } else {
              // User not found in DB, clear local storage and reset
              localStorage.removeItem('userStudyData');
              setUserData(null);
              setCurrentStep('registration');
              messageApi.error('Your session has expired or is invalid. Please register again.');
            }
          } catch (error) {
            console.error('Failed to verify user session:', error);
            localStorage.removeItem('userStudyData');
            setUserData(null);
            setCurrentStep('registration');
            messageApi.error('Could not connect to the server to verify your session. Please try again later.');
          }
        }
      }
    };

    verifyUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
