import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout, AuthPage } from './components';
import { HomePage } from './pages/HomePage';
import { ProjectPage } from './pages/ProjectPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { apiService } from './services/api';
import { exportFlowData } from './utils';
import { Node, Edge } from 'reactflow';
import './App.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { user, signOut } = useAuth();

  const handleDeploy = async (nodes: Node[], edges: Edge[]) => {
    try {
      const flowData = exportFlowData(nodes, edges);
      const result = await apiService.deployFlow(flowData);
      
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

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <MainLayout
      onDeploy={handleDeploy}
      onSave={handleSave}
      onLoad={handleLoad}
      onNew={handleNew}
      user={user}
      onLogout={handleLogout}
    />
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } />
          <Route path="/mml" element={
            <ProtectedRoute>
              <AppContent />
            </ProtectedRoute>
          } />
          <Route path="/project" element={
            <ProtectedRoute>
              <ProjectPage />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;