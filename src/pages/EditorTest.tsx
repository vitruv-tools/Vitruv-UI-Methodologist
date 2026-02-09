import React from 'react';
import { CodeEditorModal } from '../components/flow/CodeEditorModal';

export function EditorTest() {
  return (
    <div style={{ padding: '20px', backgroundColor: '#1e1e1e', minHeight: '100vh' }}>
      <h1 style={{ color: '#fff' }}>Monaco Editor + LSP Test</h1>
      <CodeEditorModal
        isOpen={true}
        onClose={() => console.log('Close clicked')}
        onSave={async (code) => {
          console.log('Save clicked:', code);
        }}
        onDelete={() => console.log('Delete clicked')}
        initialCode="// Test Reactions Code\nreaction TestReaction {\n  \n}"
        edgeId="test-edge-123"
        sourceFileName="SourceModel.ecore"
        targetFileName="TargetModel.ecore"
      />
    </div>
  );
}