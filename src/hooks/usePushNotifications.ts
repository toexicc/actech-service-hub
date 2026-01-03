import { useState, useEffect, useCallback } from 'react';
import { 
  promptForPushPermission, 
  getNotificationPermission, 
  isSubscribedToPush,
  setOneSignalExternalUserId,
  clearOneSignalExternalUserId 
} from '@/lib/onesignal';

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: 'default' | 'granted' | 'denied';
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<void>;
  setUserId: (userId: string) => Promise<void>;
  clearUserId: () => Promise<void>;
  refresh: () => void;
}

export const usePushNotifications = (): UsePushNotificationsReturn => {
  const [permission, setPermission] = useState<'default' | 'granted' | 'denied'>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if push notifications are supported
  const isSupported = typeof window !== 'undefined' && 
    'Notification' in window && 
    'serviceWorker' in navigator;

  const refresh = useCallback(() => {
    if (!isSupported) return;
    
    // Small delay to ensure OneSignal is ready
    setTimeout(() => {
      setPermission(getNotificationPermission());
      setIsSubscribed(isSubscribedToPush());
    }, 100);
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported) return;
    
    // Initial check after a delay for OneSignal to initialize
    const timer = setTimeout(refresh, 1000);
    
    // Listen for permission changes
    const handlePermissionChange = () => {
      refresh();
    };

    if (window.OneSignal) {
      window.OneSignal.Notifications.addEventListener('permissionChange', handlePermissionChange);
    }

    return () => {
      clearTimeout(timer);
      if (window.OneSignal) {
        window.OneSignal.Notifications.removeEventListener('permissionChange', handlePermissionChange);
      }
    };
  }, [isSupported, refresh]);

  const subscribe = useCallback(async () => {
    if (!isSupported || isLoading) return;
    
    setIsLoading(true);
    try {
      await promptForPushPermission();
      refresh();
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, isLoading, refresh]);

  const setUserId = useCallback(async (userId: string) => {
    try {
      await setOneSignalExternalUserId(userId);
    } catch (error) {
      console.error('Failed to set push notification user ID:', error);
    }
  }, []);

  const clearUserId = useCallback(async () => {
    try {
      await clearOneSignalExternalUserId();
    } catch (error) {
      console.error('Failed to clear push notification user ID:', error);
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    setUserId,
    clearUserId,
    refresh,
  };
};
