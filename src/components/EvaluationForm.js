import React, { useState } from 'react';
import { 
  Form, 
  Slider, 
  Radio, 
  Input, 
  Button, 
  Typography, 
  Divider,
  Card
} from 'antd';

const { Title } = Typography;
const { TextArea } = Input;

const EvaluationForm = ({ onSubmit, loading }) => {
  const [form] = Form.useForm();

  const overallRating = {
    key: 'overall_rating',
    label: 'Overall Recommendation Quality',
    description: 'Rate the overall quality of this therapy recommendation (1 = very poor, 10 = excellent)'
  };

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
      form.resetFields();
    } catch (error) {
      console.error('Error submitting evaluation:', error);
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
    </div>
  );
};

export default EvaluationForm;