import React from 'react';
import { Card, Typography, Button, Row, Col } from 'antd';
import { FormOutlined, BookOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Title, Paragraph } = Typography;

const Home = () => {
  return (
    <div className="home-content">
      <Card className="welcome-card">
        <Title level={1}>LLM Therapy Evaluation</Title>
        <Paragraph style={{ fontSize: '18px', marginBottom: '32px' }}>
          Evaluate AI-generated therapy recommendations for patient cases.
        </Paragraph>
        
        <Row gutter={[24, 24]} justify="center">
          <Col xs={24} sm={12} md={8}>
            <Card className="feature-card" hoverable>
              <FormOutlined className="feature-icon" />
              <Title level={3}>Start Evaluation</Title>
              <Paragraph>
                Review patient cases and rate the AI therapy recommendations.
              </Paragraph>
              <Link to="/evaluation">
                <Button type="primary" size="large" block>Begin Review</Button>
              </Link>
            </Card>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Card className="feature-card" hoverable>
              <BookOutlined className="feature-icon" />
              <Title level={3}>Instructions</Title>
              <Paragraph>
                Learn how to evaluate therapy recommendations effectively.
              </Paragraph>
              <Link to="/instructions">
                <Button type="default" size="large" block>Read Guide</Button>
              </Link>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Home;