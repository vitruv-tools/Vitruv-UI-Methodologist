import React, { useState } from 'react';
import { AppSidebar, SidebarView } from '../components/layout/AppSidebar';
import { ModelLibraryTable } from '../components/ui/ModelLibraryTable';
import { ProjectsView } from '../components/ui/ProjectsView';
import { AuthService } from '../services/auth';

const ComingSoon: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', gap: 12 }}>
    <div style={{ fontSize: 36 }}>⚙️</div>
    <div style={{ fontSize: 20, fontWeight: 600, color: '#374151' }}>{title}</div>
    <div style={{ fontSize: 14 }}>Dieser Bereich wird noch entwickelt.</div>
  </div>
);

export const HomePage: React.FC = () => {
  const [activeView, setActiveView] = useState<SidebarView>('library');

  const currentUser = AuthService.getCurrentUser();
  const userName = currentUser
    ? [currentUser.givenName, currentUser.familyName].filter(Boolean).join(' ') || currentUser.username
    : 'User';
  const userEmail = currentUser?.email;

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden', background: '#f7f8fa' }}>
      <AppSidebar
        activeView={activeView}
        onViewChange={setActiveView}
        userName={userName}
        userRole="Methodologist"
        userEmail={userEmail}
        onSettings={() => setActiveView('settings')}
        onLogout={() => AuthService.signOut().then(() => window.location.href = '/login')}
      />
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
        backgroundColor: '#f1f2f4',
        backgroundImage: 'radial-gradient(circle, #b0b7c3 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeView === 'library'  && <ModelLibraryTable />}
          {activeView === 'projects' && <ProjectsView />}
          {activeView === 'settings' && <ComingSoon title="Einstellungen" />}
        </div>
      </main>
    </div>
  );
};
