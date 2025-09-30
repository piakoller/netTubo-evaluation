
import React, { useState } from 'react';
import { Card, Button, Space, Tooltip } from 'antd';
import { MedicineBoxOutlined, CopyOutlined, ArrowsAltOutlined, ShrinkOutlined } from '@ant-design/icons';
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
    <Card style={{ marginTop: 16, marginBottom: 16 }} title={<span><MedicineBoxOutlined /> Publications Used</span>}>
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

const TherapyRecommendation = ({ recommendation, trialData = [] }) => {
  if (!recommendation) return null;

  const { raw_response } = recommendation;
  console.log(trialData)

  const nctUrlMap = {};
  trialData.forEach(trial => {
    if (trial.nct_id && trial.url) nctUrlMap[trial.nct_id] = trial.url;
  });

// Map NCT IDs to array of publication objects { title, url, source }
const nctPublicationMap = {};
trialData.forEach(trial => {
  const nctId = trial.nct_id;
  const online = trial.publication_analysis?.online_search_results || {};
  const sources = [
    { key: 'pubmed', arr: online.pubmed?.publications, label: 'PubMed' },
    { key: 'onclive', arr: online.onclive?.articles, label: 'OncLive' },
    // { key: 'google_scholar', arr: online.google_scholar?.articles, label: 'Google Scholar' },
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

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      console.warn('Copy failed');
    }
  };

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
      a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" />
    };
    return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{processed}</ReactMarkdown>;
  };


  // Find all NCT numbers mentioned in the markdown
  const mentionedNCTs = Array.from(new Set((sanitizedRaw.match(/NCT\d{8}/g) || [])));

  return (
    <>
      <Card
        title={<span><MedicineBoxOutlined /> AI Therapy Recommendation</span>}
        style={{ marginBottom: 16 }}
      >
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
      <PublicationsCard mentionedNCTs={mentionedNCTs} nctPublicationMap={nctPublicationMap} />
    </>
  );
}

export default TherapyRecommendation;
