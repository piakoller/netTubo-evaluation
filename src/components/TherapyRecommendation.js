import React, { useState } from 'react';
import { Card, Typography, Button, Space, Tooltip, Divider } from 'antd';
import { MedicineBoxOutlined, CopyOutlined, ArrowsAltOutlined, ShrinkOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const { Title, Text } = Typography;

const TherapyRecommendation = ({ recommendation, patientId }) => {
  const [expanded, setExpanded] = useState(false);

  if (!recommendation) return null;

  const { raw_response } = recommendation;

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
      console.warn('Copy to clipboard failed', e);
    }
  };

  const sanitizeRaw = (raw) => {
    if (!raw) return '';
    let s = String(raw);
    s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    s = s.replace(/\\n/g, '\n');
    s = s.replace(/\u00A0/g, ' ');
    s = s.replace(/<therapy_recommendation>/gi, '')
         .replace(/<\/therapy_recommendation>/gi, '')
         .replace(/<rationale>/gi, '')
         .replace(/<\/rationale>/gi, '');
    s = s.replace(/^\s+$/gm, '');
    // These two lines try to consolidate list markers followed by newlines and spaces, ensuring correct parsing
    s = s.replace(/(^|\n)\s*(\d+\.)\s*\n\s*/g, '$1$2 ');
    s = s.replace(/(^|\n)\s*([*+\-])\s*\n\s*/g, '$1$2 ');
    s = s.replace(/\n{2,}/g, '\n'); // Collapse 2+ newlines to 1 to reduce excessive spacing
    s = s.trim();
    return s;
  };

  const sanitizedRaw = sanitizeRaw(raw_response || '');

const markdownComponents = {
    p: ({ node, ...props }) => (
      // Added a small margin-bottom and explicit line-height for paragraphs
      <p style={{ margin: '0 0 0.5em 0', whiteSpace: 'normal', lineHeight: '1.4' }} {...props} />
    ),
    h1: ({ node, ...props }) => (<h1 style={{ margin: '0 0 0.5em 0' }} {...props} />),
    h2: ({ node, ...props }) => (<h2 style={{ margin: '0 0 0.5em 0' }} {...props} />),
    h3: ({ node, ...props }) => (<h3 style={{ margin: '0 0 0.5em 0' }} {...props} />),
    h4: ({ node, ...props }) => (<h4 style={{ margin: '0 0 0.5em 0' }} {...props} />),
    h5: ({ node, ...props }) => (<h5 style={{ margin: '0 0 0.5em 0' }} {...props} />),
    h6: ({ node, ...props }) => (<h6 style={{ margin: '0 0 0.5em 0' }} {...props} />),
    ul: ({ node, ...props }) => (
      // Added a small margin-bottom for lists to separate them from subsequent elements
      <ul style={{ margin: '0 0 0.5em 0', paddingLeft: 20 }} {...props} />
    ),
    ol: ({ node, ...props }) => (
      // Added a small margin-bottom for lists
      <ol style={{ margin: '0 0 0.5em 0', paddingLeft: 20 }} {...props} />
    ),
    li: ({ node, ...props }) => (
      // Reduced margin-bottom and added explicit line-height for list items for tighter spacing
      <li style={{ margin: '0 0 0.2em 0', lineHeight: '1.4' }} {...props} />
    ),
  };

  const parseSections = (raw) => {
    if (!raw) return { therapy: '', rationale: '', rest: '' };
    const grab = (tag) => {
      const m = raw.match(new RegExp(`<${tag}>([\s\S]*?)</${tag}>`, 'i'));
      return m ? m[1].trim() : '';
    };
    const therapy = grab('therapy_recommendation');
    const rationale = grab('rationale');
    const rest = raw
      .replace(new RegExp(`<therapy_recommendation>[\s\S]*?</therapy_recommendation>`, 'ig'), '')
      .replace(new RegExp(`<rationale>[\s\S]*?</rationale>`, 'ig'), '')
      .trim();
    return { therapy, rationale, rest };
  };

  const sections = parseSections(sanitizedRaw);

  return (
    <Card 
      title={
        <span>
          <MedicineBoxOutlined style={{ marginRight: '8px' }} />
          AI Therapy Recommendation
        </span>
      }
      className="recommendation-card"
      style={{ marginBottom: '16px' }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Title level={5} style={{ margin: 0 }}>LLM Response</Title>
          <Space size="small">
            <Tooltip title="Copy response">
              <Button
                size="small"
                type="text"
                icon={<CopyOutlined />}
                onClick={() => copyText(raw_response || '')}
              />
            </Tooltip>
            <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
              <Button
                size="small"
                type="text"
                icon={expanded ? <ShrinkOutlined /> : <ArrowsAltOutlined />}
                onClick={() => setExpanded((v) => !v)}
              />
            </Tooltip>
          </Space>
        </div>
        <div 
          className="recommendation-content" 
          style={{ 
            maxHeight: expanded ? 'none' : '500px', 
            overflowY: 'auto', 
            border: '1px solid #e8e8e8', 
            padding: '16px', 
            borderRadius: '6px',
            backgroundColor: '#fafafa',
            fontFamily: 'inherit',
            lineHeight: '1.6'
          }}
        >
          {sections.therapy ? (
            <div style={{ marginBottom: 16 }}>
              <Title level={5} style={{ marginTop: 0 }}>Therapy Recommendation</Title>
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
                {sections.therapy}
              </ReactMarkdown>
            </div>
          ) : null}

          {sections.rationale ? (
            <div style={{ marginTop: sections.therapy ? 8 : 0 }}>
              {sections.therapy ? <Divider /> : null}
              <Title level={5} style={{ marginTop: 0 }}>Rationale</Title>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {sections.rationale}
              </ReactMarkdown>
            </div>
          ) : null}

          {!sections.therapy && !sections.rationale ? (
            sanitizedRaw ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {sanitizedRaw}
              </ReactMarkdown>
            ) : (
              <Text>No recommendation available</Text>
            )
          ) : null}
        </div>
        {!expanded && (raw_response || '').length > 0 && (
          <Button type="link" size="small" onClick={() => setExpanded(true)} style={{ paddingLeft: 0 }}>
            Show more
          </Button>
        )}
        {expanded && (
          <Button type="link" size="small" onClick={() => setExpanded(false)} style={{ paddingLeft: 0 }}>
            Show less
          </Button>
        )}
      </div>
    </Card>
  );
};

export default TherapyRecommendation;