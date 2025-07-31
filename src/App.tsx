import React from 'react';
import { MainLayout } from './components';
import { ApiService } from './services/api';
import { exportFlowData } from './utils';
import { Node, Edge } from 'reactflow';
import './App.css';

function App() {
  const handleDeploy = async (nodes: Node[], edges: Edge[]) => {
    try {
      const flowData = exportFlowData(nodes, edges);
      const result = await ApiService.deployFlow(flowData);
      
      if (result.success) {
        alert('Flow deployed successfully!');
      } else {
        alert(`Deployment failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Deployment error:', error);
      alert('Deployment failed. Check console for details.');
    }
  };

  const handleSave = () => {
    // TODO: Implement save functionality
    console.log('Save functionality to be implemented');
  };

  const handleLoad = () => {
    // TODO: Implement load functionality
    console.log('Load functionality to be implemented');
  };

  const handleNew = () => {
    // TODO: Implement new flow functionality
    console.log('New flow functionality to be implemented');
  };

  return (
    <MainLayout
      onDeploy={handleDeploy}
      onSave={handleSave}
      onLoad={handleLoad}
      onNew={handleNew}
    />
  );
}

export default App;