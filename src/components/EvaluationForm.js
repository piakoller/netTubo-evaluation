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
  Typography
} from 'antd';

import { MedicineBoxOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Text, Title } = Typography;

const EvaluationForm = ({ onSubmit, onExpertSubmit, loading, expertRecommendation, expertModalTriggerRef, savedEvaluation }) => {
  const [form] = Form.useForm();
  const [expertForm] = Form.useForm();
  const [showExpertModal, setShowExpertModal] = useState(false);

  // Allow parent to trigger the expert modal
  React.useEffect(() => {
    if (expertModalTriggerRef) {
      expertModalTriggerRef.current = () => setShowExpertModal(true);
    }
  }, [expertModalTriggerRef]);
  const [expertEvaluationSubmitted, setExpertEvaluationSubmitted] = useState(false);

  // Load saved evaluation data into form
  React.useEffect(() => {
    if (savedEvaluation) {
      console.log('Loading saved evaluation into form:', savedEvaluation);
      const formValues = {
        overall_rating: savedEvaluation.overallRating || savedEvaluation.overall_rating || 5,
        implementation_willingness: savedEvaluation.implementationWillingness || savedEvaluation.implementation_willingness,
        comments: savedEvaluation.comments || '',
        // Category 1: Evidence Retrieval
        guideline_found: savedEvaluation.guideline_found,
        cites_primary_study: savedEvaluation.cites_primary_study,
        acknowledges_new_data: savedEvaluation.acknowledges_new_data,
        citations_real: savedEvaluation.citations_real,
        // Category 2: Clinical Soundness
        clinical_appropriateness: savedEvaluation.clinical_appropriateness,
        contraindication_awareness: savedEvaluation.contraindication_awareness,
        treatment_completeness: savedEvaluation.treatment_completeness,
        notes_guideline_evidence_conflict: savedEvaluation.notes_guideline_evidence_conflict,
        // Category 3: Actionability
        actionable_next_steps: savedEvaluation.actionable_next_steps,
        personalization: savedEvaluation.personalization,
        quality_of_life: savedEvaluation.quality_of_life
      };
      console.log('Setting form values:', formValues);
      
      // Use setFields to mark fields as touched and set values
      const fieldsToSet = Object.entries(formValues)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([name, value]) => ({
          name,
          value,
          touched: true,
          validating: false
        }));
      
      form.setFields(fieldsToSet);
      
      // Also validate to ensure form state is correct
      setTimeout(() => {
        form.validateFields().catch(() => {
          // Validation might fail, but that's ok - just checking state
        });
      }, 0);
    } else {
      // Reset to default values when no saved evaluation
      console.log('No saved evaluation, resetting form');
      form.resetFields();
      form.setFieldsValue({
        overall_rating: 5
      });
    }
  }, [savedEvaluation, form]);

  // Yes/No options for detailed evaluation
  const yesNoOptions = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' }
  ];

  // Evaluation categories and questions (updated to match user specification)
  const evaluationCategories = [
    {
      key: 'evidence_retrieval',
      title: 'Category 1: Evidence Retrieval',
      description: 'Evaluates how well the recommendation is grounded in established medical knowledge',
      questions: [
        {
          key: 'guideline_found',
          label: 'Has the chatbot found and included at least one relevant guideline (regardless if the recommendation is aligned with the guideline)?',
          description: ''
        },
        {
          key: 'cites_primary_study',
          label: 'Does the answer cite at least one peer-reviewed primary study (trial or high-quality observational study) relevant to the recommendation?',
          description: ''
        },
        {
          key: 'acknowledges_new_data',
          label: 'If newer, potentially practice-changing data exist (e.g., conference abstracts, preprints, press releases), does the answer acknowledge them?',
          description: ''
        },
        {
          key: 'citations_real',
          label: 'Do all citations correspond to real, retrievable sources?',
          description: ''
        }
      ]
    },
    {
      key: 'clinical_soundness',
      title: 'Category 2: Clinical Soundness and Safety',
      description: 'Evaluates the appropriateness and safety of the plan for the specific patient.',
      questions: [
        {
          key: 'clinical_appropriateness',
          label: 'Clinical Appropriateness: Is the primary recommended therapy (or sequence of therapies) a suitable and recognized option for the patient\'s specific cancer type, grade, stage, and molecular profile?',
          description: ''
        },
        {
          key: 'contraindication_awareness',
          label: 'Contraindication Awareness: Does the recommendation demonstrate awareness of the patient\'s specific clinical state (e.g., acute complications, organ dysfunction) and avoid treatments that would be clearly contraindicated?',
          description: ''
        },
        {
          key: 'treatment_completeness',
          label: 'Treatment Completeness: Does the recommendation address all necessary and appropriate treatment modalities for this clinical case (e.g., surgery, systemic therapy, supportive care)?',
          description: ''
        },
        {
          key: 'notes_guideline_evidence_conflict',
          label: 'If major guidelines conflict with newer evidence, does the answer note the disagreement (without needing to resolve it fully)?',
          description: ''
        }
      ]
    },
    {
      key: 'actionability',
      title: 'Category 3: Actionability and Patient-Centeredness',
      description: 'Evaluates whether the recommendation is a practical clinical tool that considers the patient\'s context.',
      questions: [
        {
          key: 'actionable_next_steps',
          label: 'Actionable Next Steps: Does the recommendation define clear, concrete, and immediate next steps for the clinical team to execute (e.g., "Perform ⁶⁸Ga-DOTATATE PET/CT," "Consult HPB surgery")?',
          description: ''
        },
        {
          key: 'personalization',
          label: 'Personalization: Does the plan tailor recommendations to patient-specific factors that go beyond standard diagnosis and stage (e.g., unique molecular markers, prior treatment history, significant comorbidities)?',
          description: ''
        },
        {
          key: 'quality_of_life',
          label: 'Quality of Life Consideration: Does the recommendation explicitly acknowledge or address how the proposed plan might impact the patient\'s quality of life?',
          description: ''
        }
      ]
    }
  ];

  const overallRating = {
    key: 'overall_rating',
    label: 'Overall Recommendation Quality',
    description: 'Rate the overall quality of this therapy recommendation (1 = very poor, 10 = excellent)'
  };

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
      // Debug: log all values received from the form
      console.log('Form values at submit:', values);
      // Collect detailed evaluation answers
      const detailedAnswers = {};
      evaluationCategories.forEach(category => {
        category.questions.forEach(question => {
          if (values[question.key] !== undefined) {
            detailedAnswers[question.key] = values[question.key];
          } else {
            // Debug: log missing question key
            console.warn('Missing value for question:', question.key);
          }
        });
      });

      const evaluationData = {
        overall_rating: values.overall_rating,
        implementation_willingness: values.implementation_willingness,
        comments: values.comments || '',
        ...detailedAnswers
      };

      console.log('Evaluation data to submit:', evaluationData);

      await onSubmit(evaluationData);
      
      // Jump to the top of the page so the expert modal (if any) is visible
      if (typeof window !== 'undefined' && window.scrollTo) {
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) {
          // fallback for older browsers
          window.scrollTo(0, 0);
        }
      }

      // Show expert recommendation modal after successful submission
      if (expertRecommendation) {
        setShowExpertModal(true);
      }
      
      // Don't reset form - allow users to update their evaluation
      // form.resetFields();
    } catch (error) {
      console.error('Error submitting evaluation:', error);
    }
  };

  const handleSubmitFailed = (errorInfo) => {
    // Build a detailed error message listing all missing fields
    const missingFields = errorInfo.errorFields.map(field => {
      const fieldName = field.name[0];
      
      // Find the human-readable label for this field
      if (fieldName === 'implementation_willingness') {
        return 'Implementation Willingness';
      }
      
      // Search through all categories for the question
      for (const category of evaluationCategories) {
        const question = category.questions.find(q => q.key === fieldName);
        if (question) {
          return question.label;
        }
      }
      
      return fieldName;
    });

    const errorMessage = missingFields.length === 1
      ? `Please answer the required question: ${missingFields[0]}`
      : `Please answer the following required questions:\n• ${missingFields.join('\n• ')}`;

    Modal.error({
      title: 'Missing Required Fields',
      content: (
        <div>
          <p>You must answer all required questions before submitting.</p>
          <div style={{ marginTop: '12px', fontWeight: 'bold' }}>
            Missing:
          </div>
          <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
            {missingFields.map((field, index) => (
              <li key={index}>{field}</li>
            ))}
          </ul>
        </div>
      ),
      okText: 'OK',
    });

    // Scroll to the first error field
    if (errorInfo.errorFields.length > 0) {
      form.scrollToField(errorInfo.errorFields[0].name);
    }
  };

  const handleExpertEvaluationSubmit = async (values) => {
    try {
      const expertEvaluationData = {
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
        // Log values as they change to help debug validation issues
        onValuesChange={(changedValues, allValues) => {
          console.log('Form onValuesChange:', changedValues, allValues);
        }}
        onFinish={handleSubmit}
        onFinishFailed={handleSubmitFailed}
        initialValues={{
          overall_rating: 5
        }}
        scrollToFirstError
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
        <div>
          <Title level={4} style={{ marginBottom: '24px' }}>Detailed Evaluation Questions</Title>
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
                    label={null}
                    rules={[{ required: true, message: `Please answer ${question.label}` }]}
                  >
                    <div style={{ marginBottom: 4, fontWeight: 500 }}>
                      {question.label}
                    </div>
                    <div style={{ marginBottom: 12, color: '#666', fontSize: 13 }}>
                      {question.description}
                    </div>
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
        </div>

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
          {savedEvaluation && (
            <div style={{ 
              marginBottom: '16px', 
              padding: '12px', 
              backgroundColor: '#e6f7ff', 
              border: '1px solid #91d5ff',
              borderRadius: '4px'
            }}>
              <Text style={{ color: '#0050b3', fontWeight: 'bold' }}>
                ✓ Previously evaluated on {new Date(savedEvaluation.timestamp).toLocaleString()}
              </Text>
              <div style={{ fontSize: '12px', color: '#096dd9', marginTop: '4px' }}>
                You can update your evaluation below
              </div>
            </div>
          )}
          <Button 
            type="primary" 
            htmlType="submit" 
            size="large"
            loading={loading}
            style={{ minWidth: '200px' }}
          >
            {savedEvaluation ? 'Update Evaluation' : 'Submit Evaluation'}
          </Button>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
            {savedEvaluation 
              ? 'Your changes will update the previous evaluation' 
              : 'You can update your evaluation at any time using the navigation buttons above'}
          </div>
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