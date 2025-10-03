import React, { useState } from 'react';
import { Card, Typography, Divider, Button, Space, Tooltip } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { CopyOutlined, ArrowsAltOutlined, ShrinkOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

// This component strictly shows fields available from the workflow JSON:
// - patient.id
// - patient.clinical_information
// - patient.clinical_question
// - optional: patient.expert_recommendation
const PatientInfo = ({ patient, showExpertRecommendation = false }) => {
  // Hooks must be at the top-level and not behind any early return
  const [expandClinical, setExpandClinical] = useState(false);
  const [expandQuestion, setExpandQuestion] = useState(false);

  if (!patient) return null;

  const copyText = async (text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch (e) {
      // no-op if clipboard fails
      console.warn('Copy to clipboard failed', e);
    }
  };

  const title = (
    <span>
      <UserOutlined style={{ marginRight: 8 }} />
      Patient {patient.id}
    </span>
  );

  return (
    <Card title={title} className="patient-card" style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Title level={5} style={{ margin: 0 }}>Clinical Information</Title>
          <Space size="small">
            <Tooltip title="Copy clinical information">
              <Button
                size="small"
                type="text"
                icon={<CopyOutlined />}
                onClick={() => copyText(patient.clinical_information || '')}
              />
            </Tooltip>
            <Tooltip title={expandClinical ? 'Collapse' : 'Expand'}>
              <Button
                size="small"
                type="text"
                icon={expandClinical ? <ShrinkOutlined /> : <ArrowsAltOutlined />}
                onClick={() => setExpandClinical((v) => !v)}
              />
            </Tooltip>
          </Space>
        </div>
        <div style={{
          whiteSpace: 'pre-wrap',
          marginBottom: 0,
          maxHeight: expandClinical ? 'none' : 450,
          overflow: 'hidden',
          lineHeight: 1.6
        }}>
          {patient.clinical_information || 'No clinical information available'}
        </div>
      </div>

      <Divider />

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Title level={5} style={{ margin: 0 }}>Clinical Question</Title>
          <Space size="small">
            <Tooltip title="Copy clinical question">
              <Button
                size="small"
                type="text"
                icon={<CopyOutlined />}
                onClick={() => copyText(patient.clinical_question || '')}
              />
            </Tooltip>
            <Tooltip title={expandQuestion ? 'Collapse' : 'Expand'}>
              <Button
                size="small"
                type="text"
                icon={expandQuestion ? <ShrinkOutlined /> : <ArrowsAltOutlined />}
                onClick={() => setExpandQuestion((v) => !v)}
              />
            </Tooltip>
          </Space>
        </div>
        <div style={{
          fontStyle: 'italic',
          fontSize: 16,
          whiteSpace: 'pre-wrap',
          marginBottom: 0,
          maxHeight: expandQuestion ? 'none' : 140,
          overflow: 'hidden',
          lineHeight: 1.6
        }}>
          {patient.clinical_question || 'No clinical question provided'}
        </div>
      </div>

      {showExpertRecommendation && patient.expert_recommendation && (
        <>
          <Divider />
          <div>
            <Title level={5} style={{ marginBottom: 8 }}>Expert Recommendation</Title>
            <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
              {patient.expert_recommendation}
            </Paragraph>
          </div>
        </>
      )}
    </Card>
  );
};

export default PatientInfo;