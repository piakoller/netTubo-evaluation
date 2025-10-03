
import React from 'react';
import { Card, Button, Space, Tooltip, Row, Col } from 'antd';
import { MedicineBoxOutlined, CopyOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Publications Card Component
const PublicationsCard = ({ mentionedNCTs = [], nctPublicationMap = {} }) => {
  if (!mentionedNCTs || mentionedNCTs.length === 0) return null;
  // Collect publications for each mentioned NCT
  const pubs = mentionedNCTs
    .map(nct => ({ nct, publications: nctPublicationMap[nct] || [] }))
    .filter(item => item.publications.length > 0);
  if (pubs.length === 0) return null;
  return (
    <Card style={{ marginTop: 16, marginBottom: 16 }} title={<span><MedicineBoxOutlined /> Publications Used for  Agentic AI Recommendation</span>}>
      <ul style={{ paddingLeft: 20 }}>
        {pubs.map(({ nct, publications }) => (
          <li key={nct}>
            <strong>{nct}:</strong>
            <ul style={{ paddingLeft: 16 }}>
              {publications.map((pub, idx) => (
                <li key={idx}>
                  <a href={pub.url} target="_blank" rel="noopener noreferrer">{pub.title}</a>
                  {pub.source ? <span style={{ marginLeft: 8, color: '#888' }}>({pub.source})</span> : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Card>
  );
};

// Single Recommendation Component
const SingleRecommendation = ({ title, description, recommendation, nctUrlMap = {}, showPublications = false, trialData = [] }) => {
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      console.warn('Copy failed');
    }
  };

  if (!recommendation) {
    return (
      <Card title={title} style={{ marginBottom: 16 }}>
        {description && description}
        <p>No recommendation available</p>
      </Card>
    );
  }

  const { raw_response } = recommendation;

  const sanitizedRaw = (raw_response || '')
    .replace(/<\/?(therapy_recommendation|rationale)>/gi, '')
    .replace(/\\n/g, '\n')
    .trim();

  const MarkdownWithNCTLinks = ({ content }) => {
    if (!content) return null;
    const nctRegex = /(NCT\d{8})/g;
    const parts = content.split(nctRegex);
    const processed = parts.map(p => nctUrlMap[p] ? `[${p}](${nctUrlMap[p]})` : p).join('');
    // Custom link renderer to open in new tab
    const components = {
      a: ({node, children, ...props}) => (
        <a {...props} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    };
    return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{processed}</ReactMarkdown>;
  };

  // Map NCT IDs to array of publication objects for the publications card
  const nctPublicationMap = {};
  if (showPublications) {
    trialData.forEach(trial => {
      const nctId = trial.nct_id;
      const online = trial.publication_analysis?.online_search_results || {};
      const sources = [
        { key: 'pubmed', arr: online.pubmed?.publications, label: 'PubMed' },
        { key: 'onclive', arr: online.onclive?.articles, label: 'OncLive' },
        { key: 'congress_abstracts', arr: online.congress_abstracts?.abstracts, label: 'Congress Abstracts' }
      ];
      let allPubs = [];
      sources.forEach(src => {
        if (Array.isArray(src.arr) && src.arr.length > 0) {
          allPubs = allPubs.concat(
            src.arr.map(pub => ({
              title: pub.title || pub.abstract_text || 'Publication',
              url: pub.url || pub.link || '',
              source: src.label
            }))
          );
        }
      });
      if (nctId && allPubs.length > 0) {
        nctPublicationMap[nctId] = allPubs;
      }
    });
  }

  // Find all NCT numbers mentioned in the markdown
  const mentionedNCTs = Array.from(new Set((sanitizedRaw.match(/NCT\d{8}/g) || [])));

  return (
    <>
      <Card title={title} style={{ marginBottom: 16 }}>
        {description && (
          <div style={{ marginBottom: 16 }}>
            {description}
          </div>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <Space size="small">
            <Tooltip title="Copy response">
              <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => copyText(raw_response || '')} />
            </Tooltip>
          </Space>
        </div>

        <div style={{
          border: '1px solid #e8e8e8',
          padding: 16,
          borderRadius: 6,
          backgroundColor: '#fafafa'
        }}>
          {sanitizedRaw ? <MarkdownWithNCTLinks content={sanitizedRaw} /> : <p>No recommendation available</p>}
        </div>
      </Card>
      {showPublications && <PublicationsCard mentionedNCTs={mentionedNCTs} nctPublicationMap={nctPublicationMap} />}
    </>
  );
};

const TherapyRecommendation = ({ recommendation, baselineRecommendation, trialData = [] }) => {
  // Create NCT URL mapping from trial data
  const nctUrlMap = {};
  trialData.forEach(trial => {
    if (trial.nct_id && trial.url) nctUrlMap[trial.nct_id] = trial.url;
  });

  // Convert baseline recommendation string to the expected object format
  const baselineRecommendationObj = baselineRecommendation 
    ? (typeof baselineRecommendation === 'string' 
        ? { raw_response: baselineRecommendation } 
        : baselineRecommendation)
    : null;

  return (
    <Row gutter={[16, 16]}>
      {/* Left column: Baseline recommendation */}
      <Col xs={24} lg={12}>
        <SingleRecommendation 
          title={<span><MedicineBoxOutlined /> Baseline AI Recommendation</span>}
          description={
            <div style={{ 
              backgroundColor: '#f0f9ff', 
              border: '1px solid #bae6fd', 
              borderRadius: 6, 
              padding: 12,
              height: 120
            }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#0369a1' }}>
                <strong>Baseline Model:</strong> Standard large language model (GPT-5) providing therapy recommendations 
                based solely on clinical case information without access to external knowledge sources or clinical trial databases.
              </p>
            </div>
          }
          recommendation={baselineRecommendationObj}
          nctUrlMap={{}} // No NCT links for baseline
          showPublications={false}
          trialData={[]}
        />
      </Col>
      
      {/* Right column: Current agentic recommendation */}
      <Col xs={24} lg={12}>
        <SingleRecommendation 
          title={<span><MedicineBoxOutlined /> Agentic AI Recommendation</span>}
          description={
            <div style={{ 
              backgroundColor: '#f0fdf4', 
              border: '1px solid #bbf7d0', 
              borderRadius: 6, 
              padding: 12,
              height: 120
            }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#15803d' }}>
                <strong>Enhanced Agentic System:</strong> Multi-agent AI workflow that analyzes clinical guidelines, 
                searches clinical trial databases, retrieves relevant publications, and provides evidence-based 
                recommendations with direct links to trials and supporting literature.
              </p>
            </div>
          }
          recommendation={recommendation}
          nctUrlMap={nctUrlMap}
          showPublications={true}
          trialData={trialData}
        />
      </Col>
    </Row>
  );
};

export default TherapyRecommendation;
