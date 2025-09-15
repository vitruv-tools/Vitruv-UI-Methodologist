import React from 'react';

const containerStyle: React.CSSProperties = {
  userSelect: 'none',
  width: '100%',
  background: '#f8f9fa',
  padding: '16px',
  boxSizing: 'border-box',
  height: '100%',
  overflowY: 'auto',
  borderRight: '1px solid #e9ecef',
};

const titleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  marginBottom: '16px',
  color: '#2c3e50',
  textAlign: 'left',
  padding: '8px 0',
  borderBottom: '2px solid #3498db',
  fontFamily: 'Georgia, serif',
};

const sectionStyle: React.CSSProperties = {
  marginTop: '16px',
  marginBottom: '8px',
  fontWeight: 700,
  fontSize: '13px',
  color: '#2c3e50',
  borderBottom: '1px solid #3498db',
  paddingBottom: '6px',
  fontFamily: 'Georgia, serif',
};

const infoItemStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #d1ecf1',
  borderRadius: '6px',
  padding: '12px',
  marginBottom: '12px',
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
};

export const VsumsPanel: React.FC = () => {
  return (
    <div style={containerStyle}>
      <div style={titleStyle}>vSUMS</div>

      <div style={sectionStyle}>Overview</div>
      <div style={infoItemStyle}>
        vSUMS workspace and project tools will appear here.
      </div>

      <div style={sectionStyle}>Recent</div>
      <div style={infoItemStyle}>No recent items.</div>

      <div style={sectionStyle}>Actions</div>
      <div style={infoItemStyle}>Coming soon.</div>
    </div>
  );
};


