export const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  backdropFilter: 'blur(4px)',
};

export const modalStyle: React.CSSProperties = {
  backgroundColor: '#1e1e1e',
  borderRadius: '12px',
  width: '90%',
  maxWidth: '1200px',
  height: '85vh',
  maxHeight: '900px',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
  overflow: 'hidden',
};

export const headerStyle: React.CSSProperties = {
  padding: '16px 24px',
  borderBottom: '1px solid #333',
  backgroundColor: '#252526',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

export const headerTitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#fff',
  fontSize: '18px',
  fontWeight: 600,
};

export const headerSubTitleStyle: React.CSSProperties = {
  margin: '4px 0 0 0',
  color: '#888',
  fontSize: '16px',
};

export const headerCloseButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#888',
  fontSize: '24px',
  cursor: 'pointer',
  padding: '4px 8px',
  lineHeight: 1,
};

export const toolbarStyle: React.CSSProperties = {
  padding: '12px 24px',
  borderBottom: '1px solid #333',
  backgroundColor: '#2d2d2d',
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
};

export const toolbarDividerStyle: React.CSSProperties = {
  width: '1px',
  backgroundColor: '#444',
  margin: '0 4px',
};

export const buttonBaseStyles: React.CSSProperties = {
  padding: '6px 12px',
  border: 'none',
  borderRadius: '4px',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
};

export const makeButtonStyles = (
  backgroundColor: string,
  color: string = '#fff',
  disabled: boolean = false
): React.CSSProperties => ({
  ...buttonBaseStyles,
  backgroundColor: disabled ? '#333' : backgroundColor,
  color: disabled ? '#666' : color,
  cursor: disabled ? 'not-allowed' : 'pointer',
});

export const codeAreaStyle: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  overflow: 'hidden',
};

export const lineNumberColumnStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: '50px',
  backgroundColor: '#1e1e1e',
  borderRight: '1px solid #333',
  padding: '16px 8px',
  overflow: 'hidden',
  userSelect: 'none',
};

export const lineNumberStyle: React.CSSProperties = {
  color: '#858585',
  fontSize: '13px',
  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
  lineHeight: '20px',
  textAlign: 'right',
};

export const textareaStyle: React.CSSProperties = {
  position: 'absolute',
  left: '50px',
  top: 0,
  right: 0,
  bottom: 0,
  width: 'calc(100% - 50px)',
  height: '100%',
  padding: '16px',
  backgroundColor: '#1e1e1e',
  color: '#d4d4d4',
  border: 'none',
  outline: 'none',
  resize: 'none',
  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
  fontSize: '13px',
  lineHeight: '20px',
  tabSize: 2,
};

export const footerStyle: React.CSSProperties = {
  padding: '12px 24px',
  borderTop: '1px solid #333',
  backgroundColor: '#252526',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

export const footerTextStyle: React.CSSProperties = {
  color: '#888',
  fontSize: '12px',
};


