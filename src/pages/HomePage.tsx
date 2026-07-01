import React, { useEffect, useState } from 'react';
import { AppSidebar, SidebarView } from '../components/layout/AppSidebar';
import { ModelLibraryTable } from '../components/ui/ModelLibraryTable';
import { ProjectsView } from '../components/ui/ProjectsView';
import { LandingView } from '../components/ui/LandingView';
import { ProfileView } from '../components/ui/ProfileView';
import { useAuth } from '../contexts/AuthContext';
import { AuthService } from '../services/auth';
import { useSharedProjectNotifications } from '../hooks/useSharedProjectNotifications';

export const HomePage: React.FC = () => {
  const [activeView, setActiveView] = useState<SidebarView>('home');
  const { user, refreshCurrentUser } = useAuth();
  const userKey = user?.email ?? user?.id ?? null;
  const { unreadCount, markSeen, markAllSeen, refresh } = useSharedProjectNotifications(userKey);

  // Always fetch fresh profile data from the backend on mount so the sidebar
  // shows the correct name (not stale localStorage cache).
  useEffect(() => { refreshCurrentUser(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeView === 'projects') void refresh();
  }, [activeView, refresh]);

  const userName = user
    ? [user.givenName, user.familyName].filter(Boolean).join(' ') || user.username
    : 'User';
  const userEmail = user?.email;

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden', background: '#f7f8fa' }}>
      <AppSidebar
        activeView={activeView}
        onViewChange={setActiveView}
        userName={userName}
        userRole="Methodologist"
        userEmail={userEmail}
        sharedProjectsUnreadCount={unreadCount}
        onLogout={() => AuthService.signOut().then(() => { globalThis.location.href = '/login'; })}
      />
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
        backgroundColor: '#f3f4f6',
        backgroundImage: 'radial-gradient(circle, #d1d5db 0.75px, transparent 0.75px)',
        backgroundSize: '24px 24px',
      }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeView === 'home'     && <LandingView userName={userName} onNavigate={setActiveView} />}
          {activeView === 'library'  && <ModelLibraryTable />}
          {activeView === 'projects' && (
            <ProjectsView
              userKey={userKey}
              sharedUnreadCount={unreadCount}
              onSharedProjectOpened={markSeen}
              onSharedTabOpened={markAllSeen}
            />
          )}
          {activeView === 'profile'  && <ProfileView user={user} userRole="Methodologist" onNameSaved={refreshCurrentUser} />}
        </div>
      </main>
    </div>
  );
};
