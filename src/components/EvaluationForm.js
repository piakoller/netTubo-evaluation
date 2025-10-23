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
  Space,
  Typography,
  Collapse
} from 'antd';

import { MedicineBoxOutlined, FileTextOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;
const { Panel } = Collapse;

const EvaluationForm = ({ onSubmit, onExpertSubmit, loading, expertRecommendation }) => {
  const [form] = Form.useForm();
  const [expertForm] = Form.useForm();
  const [showExpertModal, setShowExpertModal] = useState(false);
  const [expertEvaluationSubmitted, setExpertEvaluationSubmitted] = useState(false);

  // Yes/No options for detailed evaluation
  const yesNoOptions = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' }
  ];

  // Evaluation categories and questions
  const evaluationCategories = [
    {
      key: 'evidence_foundation',
      title: 'Category 1: Evidence Foundation',
      description: 'Evaluates how well the recommendation is grounded in established medical knowledge',
      questions: [
        {
          key: 'guideline_adherence',
          label: 'Guideline Adherence',
          description: 'Does the recommendation explicitly cite and align with current, high-level clinical practice guidelines (ESMO, ENETS) relevant to the patient\'s diagnosis?'
        },
        {
          key: 'clinical_trial_integration',
          label: 'Clinical Trial Integration', 
          description: 'Does the recommendation cite specific, relevant clinical trials to justify the recommended therapies, particularly for advanced or contingent scenarios?'
        },
        {
          key: 'diagnostic_soundness',
          label: 'Diagnostic Soundness',
          description: 'Are the recommended diagnostic and staging procedures (e.g., imaging, biomarkers) appropriate and in line with current standards of care?'
        }
      ]
    },
    {
      key: 'clinical_soundness',
      title: 'Category 2: Clinical Soundness and Safety',
      description: 'Evaluates the appropriateness and safety of the plan for the specific patient',
      questions: [
        {
          key: 'clinical_appropriateness',
          label: 'Clinical Appropriateness',
          description: 'Is the primary recommended therapy (or sequence of therapies) a suitable and recognized option for the patient\'s specific cancer type, grade, stage, and molecular profile?'
        },
        {
          key: 'contraindication_awareness',
          label: 'Contraindication Awareness',
          description: 'Does the recommendation demonstrate awareness of the patient\'s specific clinical state (e.g., acute bleeding, organ dysfunction) and avoid treatments that would be clearly contraindicated?'
        },
        {
          key: 'treatment_completeness',
          label: 'Treatment Completeness',
          description: 'Does the recommendation address all necessary and appropriate treatment modalities for this clinical case (e.g., surgery, systemic therapy, supportive care)?'
        }
      ]
    },
    {
      key: 'recommendation_quality',
      title: 'Category 3: Recommendation Quality and Rationale',
      description: 'Evaluates the logical structure, transparency, and decision-making quality of the output',
      questions: [
        {
          key: 'rationale_clarity',
          label: 'Rationale Clarity',
          description: 'Is the clinical reasoning that connects the patient\'s data, guidelines, and trial evidence to the final recommendation explicitly stated and logical?'
        },
        {
          key: 'risk_benefit_transparency',
          label: 'Risk-Benefit Transparency',
          description: 'Does the recommendation explicitly state both the potential benefits (e.g., survival data, disease control) and the potential significant risks or toxicities of the proposed treatments?'
        },
        {
          key: 'consideration_alternatives',
          label: 'Consideration of Alternatives',
          description: 'Does the recommendation present clinically valid alternative treatment options for key decision points, especially if the optimal path is uncertain?'
        }
      ]
    },
    {
      key: 'actionability',
      title: 'Category 4: Actionability and Patient-Centeredness',
      description: 'Evaluates whether the recommendation is a practical clinical tool that considers the patient\'s context',
      questions: [
        {
          key: 'actionable_next_steps',
          label: 'Actionable Next Steps',
          description: 'Does the recommendation define clear, concrete, and immediate next steps for the clinical team to execute (e.g., "Perform ⁶⁸Ga-DOTATATE PET/CT," "Consult HPB surgery")?'
        },
        {
          key: 'personalization',
          label: 'Personalization',
          description: 'Does the plan tailor recommendations to patient-specific factors that go beyond standard diagnosis and stage (e.g., unique molecular markers, prior treatment history, significant comorbidities)?'
        },
        {
          key: 'quality_of_life',
          label: 'Quality of Life Consideration',
          description: 'Does the recommendation explicitly acknowledge or address how the proposed plan might impact the patient\'s quality of life?'
        }
      ]
    }
  ];

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
      // Collect detailed evaluation answers
      const detailedAnswers = {};
      evaluationCategories.forEach(category => {
        category.questions.forEach(question => {
          if (values[question.key]) {
            detailedAnswers[question.key] = values[question.key];
          }
        });
      });

      const evaluationData = {
        overall_rating: values.overall_rating,
        implementation_willingness: values.implementation_willingness,
        comments: values.comments || '',
        ...detailedAnswers
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

        {/* Detailed Evaluation Questions */}
        <Collapse 
          items={[
            {
              key: '1',
              label: <Text strong>Detailed Evaluation Questions</Text>,
              children: (
                <div style={{ padding: '0 16px' }}>
                  {evaluationCategories.map(category => (
                    <div key={category.key} style={{ marginBottom: '24px' }}>
                      <Title level={5} style={{ color: '#1890ff', marginBottom: '12px' }}>
                        {category.title}
                      </Title>
                      <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                        {category.description}
                      </Text>
                      
                      {category.questions.map(question => (
                        <Form.Item
                          key={question.key}
                          name={question.key}
                          label={question.label}
                          help={question.description}
                          rules={[{ required: true, message: `Please answer ${question.label}` }]}
                        >
                          <Radio.Group>
                            {yesNoOptions.map(option => (
                              <Radio key={option.value} value={option.value}>
                                {option.label}
                              </Radio>
                            ))}
                          </Radio.Group>
                        </Form.Item>
                      ))}
                    </div>
                  ))}
                </div>
              )
            }
          ]} 
          defaultActiveKey={[]} 
          style={{ marginBottom: '24px' }}
        />

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