import { useCallback, useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { isSharedProject } from '../utils/vsumProjectList';
import {
  countUnreadSharedProjects,
  markSharedProjectSeen,
  markSharedProjectsSeen,
} from '../utils/sharedProjectNotifications';

export function useSharedProjectNotifications(userKey?: string | null) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await apiService.getVsumsPaginated('', 0, 100);
      const shared = (res.data ?? []).filter(isSharedProject);
      setUnreadCount(countUnreadSharedProjects(shared, userKey));
    } catch {
      // ignore transient errors
    }
  }, [userKey]);

  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onRefresh = () => { void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    globalThis.addEventListener('vitruv.refreshVsums', onRefresh);
    const timer = globalThis.setInterval(() => { void refresh(); }, 60000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      globalThis.removeEventListener('vitruv.refreshVsums', onRefresh);
      globalThis.clearInterval(timer);
    };
  }, [refresh]);

  const markSeen = useCallback((projectId: number) => {
    markSharedProjectSeen(projectId, userKey);
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, [userKey]);

  const markAllSeen = useCallback((projectIds: number[]) => {
    markSharedProjectsSeen(projectIds, userKey);
    void refresh();
  }, [userKey, refresh]);

  return { unreadCount, refresh, markSeen, markAllSeen };
}
