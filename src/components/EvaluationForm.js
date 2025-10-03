import React, { useState } from 'react';
import { 
  Form, 
  Slider, 
  Radio, 
  Input, 
  Button, 
  Divider,
  Card,
  Modal,
  Space
} from 'antd';

import { MedicineBoxOutlined } from '@ant-design/icons';

const { TextArea } = Input;

const EvaluationForm = ({ onSubmit, onExpertSubmit, loading, expertRecommendation }) => {
  const [form] = Form.useForm();
  const [expertForm] = Form.useForm();
  const [showExpertModal, setShowExpertModal] = useState(false);
  const [expertEvaluationSubmitted, setExpertEvaluationSubmitted] = useState(false);

  const overallRating = {
    key: 'overall_rating',
    label: 'Overall Recommendation Quality',
    description: 'Rate the overall quality of this therapy recommendation (1 = very poor, 10 = excellent)'
  };

  const similarityOptions = [
    { value: 'baseline', label: 'More similar to the Baseline AI recommendation' },
    { value: 'agentic', label: 'More similar to the Agentic AI recommendation' },
    { value: 'neither', label: 'Different from both AI recommendations' },
    { value: 'both', label: 'Similar to both AI recommendations' }
  ];

  const agreementOptions = [
    { value: 'strongly_agree', label: 'Strongly agree' },
    { value: 'agree', label: 'Agree' },
    { value: 'neutral', label: 'Neutral' },
    { value: 'disagree', label: 'Disagree' },
    { value: 'strongly_disagree', label: 'Strongly disagree' }
  ];

  const implementationOptions = [
    { value: 'yes', label: 'Yes, I would implement this' },
    { value: 'maybe', label: 'Maybe, with modifications' },
    { value: 'no', label: 'No, I would not implement this' }
  ];

  const handleSubmit = async (values) => {
    try {
      const evaluationData = {
        overall_rating: values.overall_rating,
        implementation_willingness: values.implementation_willingness,
        comments: values.comments || ''
      };

      await onSubmit(evaluationData);
      
      // Show expert recommendation modal after successful submission
      if (expertRecommendation) {
        setShowExpertModal(true);
      }
      
      form.resetFields();
    } catch (error) {
      console.error('Error submitting evaluation:', error);
    }
  };

  const handleExpertEvaluationSubmit = async (values) => {
    try {
      const expertEvaluationData = {
        expert_similarity: values.expert_similarity,
        expert_agreement: values.expert_agreement,
        expert_comments: values.expert_comments || ''
      };

      // Save expert evaluation to database if handler is provided
      if (onExpertSubmit) {
        await onExpertSubmit(expertEvaluationData);
      }
      
      setExpertEvaluationSubmitted(true);
      setTimeout(() => {
        setShowExpertModal(false);
        setExpertEvaluationSubmitted(false);
        expertForm.resetFields();
      }, 1500);
      
    } catch (error) {
      console.error('Error submitting expert evaluation:', error);
    }
  };

  const sliderMarks = {
    1: '1',
    3: '3',
    5: '5',
    7: '7',
    10: '10'
  };

  return (
    <div className="evaluation-form">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          overall_rating: 5
        }}
      >
        {/* Name field removed to keep study anonymous */}

        <Card>
          <Form.Item
            name="overall_rating"
            label={
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{overallRating.label}</div>
                <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>{overallRating.description}</div>
              </div>
            }
          >
            <Slider
              min={1}
              max={10}
              marks={sliderMarks}
              step={1}
              tooltip={{ formatter: (value) => `${value}/10` }}
            />
          </Form.Item>
        </Card>

        <Divider />

        <Form.Item
          name="implementation_willingness"
          label="Would you implement this recommendation in clinical practice?"
          rules={[{ required: true, message: 'Please select an option' }]}
        >
          <Radio.Group>
            {implementationOptions.map(option => (
              <Radio.Button key={option.value} value={option.value} style={{ marginBottom: '8px' }}>
                {option.label}
              </Radio.Button>
            ))}
          </Radio.Group>
        </Form.Item>

        <Divider />

        <Form.Item
          name="comments"
          label="Comments (Optional)"
        >
          <TextArea 
            rows={4} 
            placeholder="Any additional feedback about the recommendation..."
          />
        </Form.Item>

        <Form.Item style={{ marginTop: '32px', textAlign: 'center' }}>
          <Button 
            type="primary" 
            htmlType="submit" 
            size="large"
            loading={loading}
            style={{ minWidth: '200px' }}
          >
            Submit Evaluation
          </Button>
        </Form.Item>
      </Form>

      {/* Expert Recommendation Modal */}
      <Modal
        title={
          <div style={{ fontSize: '20px', color: '#0369a1', fontWeight: 'bold' }}>
            <MedicineBoxOutlined /> Actual Tumor Board Decision
          </div>
        }
        open={showExpertModal}
        onCancel={() => setShowExpertModal(false)}
        footer={null}
        width={800}
        style={{ top: 20 }}
      >
        <div style={{ marginBottom: '24px' }}>
          <div style={{ 
            backgroundColor: '#f0f9ff', 
            border: '1px solid #bae6fd', 
            borderRadius: 6, 
            padding: 16, 
            marginBottom: 16 
          }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#0369a1', fontWeight: 'bold' }}>
              In an actual tumor board meeting, this is what would have been decided for this patient:
            </p>
            {expertRecommendation || "No expert recommendation available for this case."}
          </div>
        </div>

        <Divider>Expert Recommendation Evaluation</Divider>

        <Form
          form={expertForm}
          layout="vertical"
          onFinish={handleExpertEvaluationSubmit}
        >
          <Form.Item
            name="expert_similarity"
            label="Which AI recommendation is this expert decision most similar to?"
            rules={[{ required: true, message: 'Please select an option' }]}
          >
            <Radio.Group>
              <Space direction="vertical">
                {similarityOptions.map(option => (
                  <Radio key={option.value} value={option.value}>
                    {option.label}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="expert_agreement"
            label="Do you agree with this expert tumor board decision?"
            rules={[{ required: true, message: 'Please select an option' }]}
          >
            <Radio.Group>
              <Space direction="vertical">
                {agreementOptions.map(option => (
                  <Radio key={option.value} value={option.value}>
                    {option.label}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="expert_comments"
            label="Additional comments about the expert recommendation (Optional)"
          >
            <Input.TextArea 
              rows={3} 
              placeholder="Any thoughts on how the expert recommendation compares to the AI recommendations..."
            />
          </Form.Item>

          <Form.Item style={{ textAlign: 'center', marginTop: '24px' }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              size="large"
              loading={expertEvaluationSubmitted}
              style={{ minWidth: '200px' }}
            >
              {expertEvaluationSubmitted ? 'Submitted!' : 'Submit Expert Evaluation'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EvaluationForm;