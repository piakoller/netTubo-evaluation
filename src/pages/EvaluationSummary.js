import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Statistic, Progress, Table } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import dataService from '../services/dataService';

const { Title } = Typography;

const EvaluationSummary = () => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const evaluationStats = await dataService.getEvaluationStats();
      setStats(evaluationStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Card loading={true} style={{ minHeight: '400px' }} />;
  }

  const { totalEvaluations, averageRatings, trustDistribution, implementationDistribution, evaluations } = stats;

  // Prepare data for charts
  const ratingsData = Object.entries(averageRatings).map(([key, value]) => ({
    category: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    rating: Math.round(value * 10) / 10
  }));

  const trustData = Object.entries(trustDistribution).map(([key, value]) => ({
    name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: value,
    percentage: Math.round((value / totalEvaluations) * 100)
  }));

  const implementationData = Object.entries(implementationDistribution).map(([key, value]) => ({
    name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: value,
    percentage: Math.round((value / totalEvaluations) * 100)
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  // Table columns for detailed evaluations
  const columns = [
    {
      title: 'Evaluator',
      dataIndex: 'evaluator_name',
      key: 'evaluator_name',
    },
    {
      title: 'Patient',
      dataIndex: 'patient_name',
      key: 'patient_name',
    },
    {
      title: 'Overall Rating',
      dataIndex: ['ratings', 'overall_quality'],
      key: 'overall_quality',
      render: (value) => `${value}/10`,
    },
    {
      title: 'Trust Level',
      dataIndex: 'trust_level',
      key: 'trust_level',
      render: (value) => value?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    },
    {
      title: 'Implementation',
      dataIndex: 'implementation_willingness',
      key: 'implementation_willingness',
      render: (value) => value?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    },
    {
      title: 'Date',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (value) => new Date(value).toLocaleDateString(),
    },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <Card>
        <Title level={2}>
          <BarChartOutlined style={{ marginRight: '8px' }} />
          Evaluation Summary Dashboard
        </Title>
      </Card>

      {/* Summary Statistics */}
      <Row gutter={[24, 24]} style={{ marginTop: '24px' }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Evaluations"
              value={totalEvaluations}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Average Overall Rating"
              value={averageRatings.overall_quality || 0}
              precision={1}
              suffix="/ 10"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="High Trust Evaluations"
              value={((trustDistribution.high || 0) + (trustDistribution.very_high || 0))}
              suffix={`/ ${totalEvaluations}`}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {totalEvaluations > 0 && (
        <>
          {/* Rating Categories Chart */}
          <Card title="Average Ratings by Category" style={{ marginTop: '24px' }}>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={ratingsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="category" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="rating" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Trust and Implementation Charts */}
          <Row gutter={[24, 24]} style={{ marginTop: '24px' }}>
            <Col xs={24} lg={12}>
              <Card title="Trust Level Distribution">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={trustData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {trustData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Implementation Willingness">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={implementationData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {implementationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          {/* Detailed Evaluations Table */}
          <Card title="Individual Evaluations" style={{ marginTop: '24px' }}>
            <Table
              columns={columns}
              dataSource={evaluations}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
              }}
            />
          </Card>
        </>
      )}

      {totalEvaluations === 0 && (
        <Card style={{ marginTop: '24px', textAlign: 'center', padding: '48px' }}>
          <Title level={3} style={{ color: '#ccc' }}>
            No evaluations completed yet
          </Title>
          <p style={{ color: '#ccc' }}>
            Complete some patient evaluations to see summary statistics and charts here.
          </p>
        </Card>
      )}
    </div>
  );
};

export default EvaluationSummary;