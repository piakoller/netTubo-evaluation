import React, { useState } from 'react';
import { Card, Form, Input, Select, Button, Typography, Alert, message } from 'antd';
import { UserOutlined, TrophyOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;
const { Option } = Select;

const UserRegistration = ({ onRegistrationComplete }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [accessVerified, setAccessVerified] = useState(false);

  // API base can be configured via REACT_APP_API_BASE (omit trailing slash),
  // fallback to empty string so relative paths are used in same-origin setups.
  const RAW_API_BASE = process.env.REACT_APP_API_BASE || '';
  const API_BASE = RAW_API_BASE.replace(/\/$/, '');

  // Generate unique user ID
  const generateUserId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `USER_${timestamp}_${random}`;
  };

  const professions = [
    'Medical Oncologist',
    'Nuclear Medicine Physician',
    'Endocrinologist',
    'Radiologist',
    'Pathologist',
    'General Practitioner',
    'Medical Resident',
    'Medical Student',
    'Nurse Practitioner',
    'Physician Assistant',
    'Other Medical Professional',
    'Non-Medical Professional'
  ];

  const handleSubmit = async (values) => {
    setLoading(true);
    
    try {
      // 1) Verify access code first
      let accessRes;
      try {
        accessRes = await fetch(`${API_BASE}/api/access/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: values.accessCode })
        });
      } catch (netErr) {
        // Network-level error (CORS, server unreachable, DNS, etc.)
        throw new Error(`Network error while verifying access code: ${netErr.message}`);
      }

      if (!accessRes.ok) {
        const err = await accessRes.json().catch(() => ({}));
        throw new Error(err.error || 'Access code verification failed');
      }
      setAccessVerified(true);

      const userId = generateUserId();
      const userData = {
        userId,
        profession: values.profession,
        yearsExperience: values.yearsExperience,
        timestamp: new Date().toISOString(),
        sessionStart: new Date().toISOString()
      };

      // Save to database via API
      let response;
      try {
        response = await fetch(`${API_BASE}/api/users/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userData.userId,
            profession: userData.profession,
            yearsExperience: parseInt(userData.yearsExperience)
          })
        });
      } catch (netErr) {
        // Network-level error during registration
        throw new Error(`Network error while registering user: ${netErr.message}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to register user');
      }

      const result = await response.json();
      console.log('User registered in database:', result);
      
      // Still store in localStorage for session management (as backup)
      localStorage.setItem('userStudyData', JSON.stringify(userData));
      
      // Call parent callback to proceed to instructions
      onRegistrationComplete(userData);
      
    } catch (error) {
      console.error('Registration error:', error);
      // If access was not verified, do NOT proceed or fallback
      if (!accessVerified) {
        message.error(error.message || 'Access code verification failed');
        return;
      }

      // Access ok, but DB failed — proceed locally only
      message.warning('Database unavailable. Proceeding with local-only session.');

      const userData = {
        userId: generateUserId(),
        profession: values.profession,
        yearsExperience: values.yearsExperience,
        timestamp: new Date().toISOString(),
        sessionStart: new Date().toISOString()
      };

      localStorage.setItem('userStudyData', JSON.stringify(userData));
      console.log('Saved to localStorage as fallback:', userData);

      onRegistrationComplete(userData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Title level={2}>
            <UserOutlined style={{ marginRight: '8px' }} />
            User Study: AI Therapy Evaluation
          </Title>
          <Paragraph style={{ fontSize: '16px', color: '#666' }}>
            Welcome to our research study on AI-generated therapy recommendations. 
            Please provide some information about your background to begin.
          </Paragraph>
        </div>

        <Alert
          message="Research Study Participation"
          description="Your responses will be used for research purposes to improve AI clinical decision support systems. All data will be anonymized and handled according to research ethics guidelines."
          type="info"
          showIcon
          style={{ marginBottom: '24px' }}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
        >
          <Form.Item
            name="accessCode"
            label="Access code"
            rules={[{ required: true, message: 'Please enter the access code provided by the study team' }]}
          >
            <Input.Password placeholder="Enter access code" autoComplete="off" style={{ width: '260px' }} />
          </Form.Item>

          <Form.Item
            name="profession"
            label="What is your profession?"
            rules={[{ required: true, message: 'Please select your profession' }]}
          >
            <Select placeholder="Select your profession">
              {professions.map(profession => (
                <Option key={profession} value={profession}>
                  {profession}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="yearsExperience"
            label="How many years of clinical experience do you have?"
            rules={[
              { required: true, message: 'Please enter your years of experience' },
              { pattern: /^\d+$/, message: 'Please enter a valid number' }
            ]}
          >
            <Input
              placeholder="Enter number of years (e.g., 5)"
              addonAfter="years"
              style={{ width: '200px' }}
            />
          </Form.Item>

          <Form.Item style={{ textAlign: 'center', marginTop: '32px' }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              size="large"
              icon={<TrophyOutlined />}
              style={{ minWidth: '200px' }}
            >
              Begin Study
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default UserRegistration;