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
      // Use shared API_BASE logic and helper to read saved user
      const RAW_API_BASE = process.env.REACT_APP_API_BASE || '';
      const API_BASE = RAW_API_BASE.replace(/\/$/, '');
      const { getCurrentUserStudyData, clearUserStudyData } = await import('./utils/user');
      const parsedData = getCurrentUserStudyData();
      console.log('App startup: found userStudyData=', parsedData, 'API_BASE=', API_BASE);
      if (parsedData?.userId) {
        try {
          const response = await fetch(`${API_BASE}/api/users/verify/${parsedData.userId}`);

          if (response.ok) {
            const verifiedUser = await response.json();
            console.log('App startup: user verified on server:', verifiedUser);
            setUserData(verifiedUser);
            setCurrentStep('evaluation'); // Proceed to evaluation
          } else {
            // User not found in DB, clear local storage and reset
            clearUserStudyData();
            setUserData(null);
            setCurrentStep('registration');
            messageApi.error('Your session has expired or is invalid. Please register again.');
          }
        } catch (error) {
          console.error('Failed to verify user session:', error);
          clearUserStudyData();
          setUserData(null);
          setCurrentStep('registration');
          messageApi.error('Could not connect to the server to verify your session. Please try again later.');
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
