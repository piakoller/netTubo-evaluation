import React from 'react';
import { Card, Typography, Alert, Button, Steps } from 'antd';
import { BookOutlined, PlayCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;
const { Step } = Steps;

const StudyInstructions = ({ onStartEvaluation, userData }) => {
  
  const evaluationSteps = [
    {
      title: 'Review Patient',
      description: 'Read patient demographics and clinical question'
    },
    {
      title: 'Read AI Recommendation', 
      description: 'Review the therapy recommendation from AI'
    },
    {
      title: 'Rate Quality',
      description: 'Rate overall recommendation quality (1-10)'
    },
    {
      title: 'Implementation Decision',
      description: 'Would you implement this in practice?'
    },
    {
      title: 'Add Comments',
      description: 'Optional feedback and suggestions'
    }
  ];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Title level={2}>
            <BookOutlined style={{ marginRight: '8px' }} />
            Study Instructions
          </Title>
          <Paragraph style={{ fontSize: '16px', color: '#666' }}>
            Thank you for participating! Here's how the evaluation process works.
          </Paragraph>
        </div>

        <Alert
          message={`Welcome ${userData?.profession || 'Participant'}`}
          description={`User ID: ${userData?.userId} | Experience: ${userData?.yearsExperience || 'N/A'} years`}
          type="success"
          showIcon
          style={{ marginBottom: '24px' }}
        />

        <Title level={3}>What You'll Be Doing</Title>
        <Paragraph style={{ fontSize: '16px', marginBottom: '24px' }}>
          You will evaluate AI-generated therapy recommendations for patient cases. 
          For each case, you'll follow a simple 5-step process:
        </Paragraph>

        <Steps direction="vertical" size="small" style={{ marginBottom: '32px' }}>
          {evaluationSteps.map((step, index) => (
            <Step
              key={index}
              title={step.title}
              description={step.description}
              status="process"
            />
          ))}
        </Steps>

        <Title level={3}>Rating Guidelines</Title>
        <div style={{ marginBottom: '24px' }}>
          <Paragraph>
            <strong>Overall Quality Rating (1-10):</strong>
          </Paragraph>
          <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
            <li><strong>1-3:</strong> Poor recommendation with significant problems</li>
            <li><strong>4-6:</strong> Average recommendation with some issues</li>
            <li><strong>7-8:</strong> Good recommendation with minor concerns</li>
            <li><strong>9-10:</strong> Excellent recommendation, ready to implement</li>
          </ul>
        </div>

        <Title level={3}>Implementation Decision</Title>
        <div style={{ marginBottom: '32px' }}>
          <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
            <li><strong>Yes:</strong> I would implement this recommendation as-is</li>
            <li><strong>Maybe with modifications:</strong> Good foundation but needs changes</li>
            <li><strong>No:</strong> Not suitable for clinical implementation</li>
          </ul>
        </div>

        <Alert
          message="Focus on Clinical Relevance"
          description="Consider: Is this recommendation appropriate, safe, and practical for real-world clinical use?"
          type="info"
          style={{ marginBottom: '32px' }}
        />

        <div style={{ textAlign: 'center' }}>
          <Button 
            type="primary" 
            size="large"
            icon={<PlayCircleOutlined />}
            onClick={onStartEvaluation}
            style={{ minWidth: '250px', height: '50px', fontSize: '16px' }}
          >
            Start Evaluating Cases
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default StudyInstructions;