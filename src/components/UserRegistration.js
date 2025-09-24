import React, { useState } from 'react';
import { Card, Form, Input, Select, Button, Typography, Alert } from 'antd';
import { UserOutlined, TrophyOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;
const { Option } = Select;

const UserRegistration = ({ onRegistrationComplete }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

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
      const userId = generateUserId();
      const userData = {
        userId,
        profession: values.profession,
        yearsExperience: values.yearsExperience,
        timestamp: new Date().toISOString(),
        sessionStart: new Date().toISOString()
      };

      // Save to database (API call would go here)
      console.log('User registered:', userData);
      
      // Store in localStorage for session management
      localStorage.setItem('userStudyData', JSON.stringify(userData));
      
      // Call parent callback to proceed to instructions
      onRegistrationComplete(userData);
      
    } catch (error) {
      console.error('Registration error:', error);
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