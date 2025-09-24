import React from 'react';
import { Card, Typography, Alert } from 'antd';
import { BookOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const Instructions = () => {
  return (
    <div className="instructions-content">
      <Card>
        <Title level={2}>
          <BookOutlined style={{ marginRight: '8px' }} />
          Evaluation Instructions
        </Title>
        
        <Alert
          message="How to Evaluate AI Therapy Recommendations"
          description="Review each patient case and rate the AI-generated therapy recommendation based on its clinical quality and usefulness."
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: '24px' }}
        />

        <Title level={3}>Step-by-Step Process</Title>
        
        <div style={{ marginBottom: '24px' }}>
          <Title level={4}>1. Review the Patient Information</Title>
          <Paragraph>
            • Read the patient demographics, diagnosis, and clinical question<br/>
            • Consider the medical context and patient's condition
          </Paragraph>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <Title level={4}>2. Read the AI Recommendation</Title>
          <Paragraph>
            • Carefully review the complete therapy recommendation<br/>
            • Consider if it appropriately addresses the clinical question
          </Paragraph>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <Title level={4}>3. Rate the Recommendation</Title>
          <Paragraph>
            <strong>Overall Quality (1-10 scale):</strong><br/>
            • 1-3: Poor recommendation, significant problems<br/>
            • 4-6: Average recommendation, some issues<br/>
            • 7-8: Good recommendation, minor concerns<br/>
            • 9-10: Excellent recommendation, would implement
          </Paragraph>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <Title level={4}>4. Implementation Decision</Title>
          <Paragraph>
            Choose whether you would implement this recommendation:<br/>
            • <strong>Yes:</strong> Ready to use in clinical practice<br/>
            • <strong>Maybe with modifications:</strong> Good but needs changes<br/>
            • <strong>No:</strong> Not suitable for implementation
          </Paragraph>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <Title level={4}>5. Add Comments (Optional)</Title>
          <Paragraph>
            Provide any additional feedback about the recommendation's strengths, 
            weaknesses, or suggestions for improvement.
          </Paragraph>
        </div>

        <Alert
          message="Focus on Clinical Relevance"
          description="Evaluate whether the recommendation is appropriate, safe, and practical for real-world clinical use."
          type="success"
          style={{ marginTop: '24px' }}
        />
      </Card>
    </div>
  );
};

export default Instructions;