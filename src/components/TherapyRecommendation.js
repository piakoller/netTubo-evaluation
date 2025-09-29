import React, { useState } from 'react';
import { Card, Typography, Button, Space, Tooltip, Divider } from 'antd';
import { MedicineBoxOutlined, CopyOutlined, ArrowsAltOutlined, ShrinkOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const { Title, Text } = Typography;

const TherapyRecommendation = ({ recommendation, patientId, trialData = [] }) => {
  const [expanded, setExpanded] = useState(false);

  if (!recommendation) return null;

  const { raw_response } = recommendation;

  // Create a map of NCT IDs to their URLs from trial data
  const nctUrlMap = {};
  if (trialData && Array.isArray(trialData)) {
    trialData.forEach(trial => {
      if (trial.nct_id && trial.url) {
        nctUrlMap[trial.nct_id] = trial.url;
      }
    });
  }

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

  // Normalisiere Linebreaks
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  s = s.replace(/\\n/g, '\n');
  s = s.replace(/\u00A0/g, ' ');

  // Entferne eigene Tags
  s = s.replace(/<\/?(therapy_recommendation|rationale)>/gi, '');

  // Entferne reine Leerzeilen
  s = s.replace(/^\s+$/gm, '');

  // Fix für Listen: Marker nicht durch linebreaks zerstören
  s = s.replace(/(^|\n)\s*(\d+\.)\s*\n\s*/g, '$1$2 ');
  s = s.replace(/(^|\n)\s*([*+\-])\s*\n\s*/g, '$1$2 ');

  // ⚡ Wichtiger Schritt: Überschriften und Listen behalten ihre Umbrüche,
  // sonst aber Umbrüche in Fließtext durch Leerzeichen ersetzen
  s = s.replace(/([^\n])\n(?![#*\-0-9])/g, '$1 ');

  // AGGRESSIVER: Alle mehrfachen Umbrüche auf einen einzigen reduzieren
  s = s.replace(/\n{2,}/g, '\n');

  // OPTIONAL: Alle verbleibenden Umbrüche durch Leerzeichen ersetzen (für komplett fließenden Text)
  // s = s.replace(/\n/g, ' ');

  return s.trim();
};

  const sanitizedRaw = sanitizeRaw(raw_response || '');

  // Component to render markdown with NCT links
  const MarkdownWithNCTLinks = ({ content }) => {
    if (!content) return null;
    
    // Split content by NCT numbers and create mixed content
    const nctRegex = /(NCT\d{8})/g;
    const parts = content.split(nctRegex);
    
    const processedContent = parts.map((part, index) => {
      if (part.match(/^NCT\d{8}$/)) {
        // This is an NCT number
        const url = nctUrlMap[part];
        if (url) {
          return `[${part}](${url})`;
        }
        return part;
      }
      return part;
    }).join('');

    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {processedContent}
      </ReactMarkdown>
    );
  };

const markdownComponents = {
    p: ({ node, ...props }) => (
      // Reduced margin for tighter spacing
      <p style={{ margin: '0 0 0.2em 0', whiteSpace: 'normal', lineHeight: '1.3' }} {...props} />
    ),
    h1: ({ node, ...props }) => (<h1 style={{ margin: '0 0 0.3em 0', lineHeight: '1.2' }} {...props} />),
    h2: ({ node, ...props }) => (<h2 style={{ margin: '0 0 0.3em 0', lineHeight: '1.2' }} {...props} />),
    h3: ({ node, ...props }) => (<h3 style={{ margin: '0 0 0.3em 0', lineHeight: '1.2' }} {...props} />),
    h4: ({ node, ...props }) => (<h4 style={{ margin: '0 0 0.3em 0', lineHeight: '1.2' }} {...props} />),
    h5: ({ node, ...props }) => (<h5 style={{ margin: '0 0 0.3em 0', lineHeight: '1.2' }} {...props} />),
    h6: ({ node, ...props }) => (<h6 style={{ margin: '0 0 0.3em 0', lineHeight: '1.2' }} {...props} />),
    ul: ({ node, ...props }) => (
      // Almost zero margin and minimal padding for lists
      <ul style={{ 
        margin: '0', 
        marginBottom: '0.3em',
        // paddingLeft: '1.2em',
        listStylePosition: 'outside'
      }} {...props} />
    ),
    ol: ({ node, ...props }) => (
      // Almost zero margin and minimal padding for ordered lists
      <ol style={{ 
        margin: '0', 
        marginBottom: '0.3em',
        paddingLeft: '1.2em',
        listStylePosition: 'outside'
      }} {...props} />
    ),
    li: ({ node, ...props }) => (
      // Zero margin for list items
      <li style={{ 
        margin: '0', 
        padding: '0',
        lineHeight: '1.3',
        marginBottom: '0.1em'
      }} {...props} />
    ),
    // Custom link component with target="_blank" for external links
    a: ({ node, href, children, ...props }) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer"
        style={{ 
          color: '#1890ff', 
          textDecoration: 'underline',
          fontWeight: href && href.includes('clinicaltrials.gov') ? 'bold' : 'normal'
        }}
        title={href && href.includes('clinicaltrials.gov') ? `Open ${children} on ClinicalTrials.gov` : undefined}
        {...props}
      >
        {children}
      </a>
    )
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
            lineHeight: '1.3'  // Reduced from 1.6 to 1.3 for tighter spacing
          }}
        >
          {sections.therapy ? (
            <div style={{ marginBottom: 16 }}>
              <Title level={5} style={{ marginTop: 0 }}>Therapy Recommendation</Title>
              <MarkdownWithNCTLinks content={sections.therapy} />
            </div>
          ) : null}

          {sections.rationale ? (
            <div style={{ marginTop: sections.therapy ? 8 : 0 }}>
              {sections.therapy ? <Divider /> : null}
              <Title level={5} style={{ marginTop: 0 }}>Rationale</Title>
              <MarkdownWithNCTLinks content={sections.rationale} />
            </div>
          ) : null}

          {!sections.therapy && !sections.rationale ? (
            sanitizedRaw ? (
              <MarkdownWithNCTLinks content={sanitizedRaw} />
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