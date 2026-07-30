import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Notification as AppNotification, fetchNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/notifications';


// Create a simple notification sound using Web Audio API
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    // Silent fail for audio
  }
};

// Request browser notification permission
const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    return false;
  }
  
  if (window.Notification.permission === 'granted') {
    return true;
  }
  
  if (window.Notification.permission !== 'denied') {
    const permission = await window.Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};

// Show browser notification
const showBrowserNotification = (title: string, body: string, icon?: string) => {
  if (window.Notification && window.Notification.permission === 'granted') {
    const notification = new window.Notification(title, {
      body,
      icon: icon || '/ac-tech-logo-pdf.png',
      tag: 'ac-tech-notification',
    });
    
    // Auto close after 15 seconds for better visibility in PWA
    setTimeout(() => notification.close(), 15000);
    
    // Focus window when clicked
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
};

// Clean notification message (remove image URLs)
const cleanNotificationMessage = (message: string): string => {
  // Handle various image formats in notifications
  if (message.includes('data:image/')) {
    // Replace full base64 URLs
    return message
      .replace(/\[Image:\s*data:image\/[^\]]+\]/gi, '📷 sent an image')
      .replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/gi, '📷 sent an image')
      .trim();
  }
  if (message.includes('[Image:')) {
    return message.replace(/\[Image:[^\]]+\]/g, '📷 sent an image').trim();
  }
  return message;
};

// Global tracker for shown notification IDs to prevent duplicates across component mounts
const shownNotificationIds = new Set<string>();

export const useNotifications = (userId: string | null, _enabled: boolean = true) => {
  // Always enabled when userId is present - notifications should load immediately on login
  const enabled = !!userId;
  const queryClient = useQueryClient();
  const previousNotificationIds = useRef<Set<string>>(new Set());
  const hasInitialLoad = useRef(false);

  // Request permission only when enabled (iOS requires user gesture)
  useEffect(() => {
    if (!enabled) return;
    requestNotificationPermission();
  }, [enabled]);

  // Fetch notifications using React Query for proper caching
  const { data: rawNotifications = [], isLoading } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      const data = await fetchNotifications(userId);
      return data;
    },
    enabled: !!userId && enabled,
    staleTime: 10 * 1000,
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
    refetchInterval: enabled ? 60000 : false, // Safety-net poll; realtime does the heavy lifting
    refetchOnWindowFocus: true, // Refetch when user returns to app
    refetchOnMount: false, // Don't refetch on every mount - use cached data
  });

  // Realtime: instant delivery of new/updated notifications for this user.
  useEffect(() => {
    if (!userId || !enabled) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, enabled, queryClient]);


  // Clean and process notifications
  const notifications = rawNotifications.map(n => ({
    ...n,
    message: cleanNotificationMessage(n.message)
  }));

  const unreadCount = notifications.filter(n => !n.read).length;

  // Handle new notification alerts (browser notifications + sound)
  useEffect(() => {
    if (!enabled || !rawNotifications.length) return;

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (!hasInitialLoad.current) {
      // First load - show notifications for recent unread messages
      hasInitialLoad.current = true;
      
      const recentUnread = rawNotifications.filter(n => {
        if (n.read) return false;
        if (shownNotificationIds.has(n.id)) return false;
        const notifDate = new Date(n.createdAt);
        return notifDate > twentyFourHoursAgo;
      });
      
      // Show native notifications with delay between each
      recentUnread.forEach((notification, index) => {
        shownNotificationIds.add(notification.id);
        setTimeout(() => {
          const cleanMessage = cleanNotificationMessage(notification.message);
          showBrowserNotification(notification.title, cleanMessage);
          if (index === 0) playNotificationSound();
        }, index * 1000);
      });
      
      // Initialize previous IDs
      previousNotificationIds.current = new Set(rawNotifications.map(n => n.id));
    } else {
      // Subsequent fetches - only notify for truly new notifications
      const newNotifications = rawNotifications.filter(
        n => !n.read && 
             !previousNotificationIds.current.has(n.id) && 
             !shownNotificationIds.has(n.id)
      );
      
      for (const notification of newNotifications) {
        shownNotificationIds.add(notification.id);
        const cleanMessage = cleanNotificationMessage(notification.message);
        showBrowserNotification(notification.title, cleanMessage);
        playNotificationSound();
      }
      
      // Update previous notification IDs
      previousNotificationIds.current = new Set(rawNotifications.map(n => n.id));
    }
  }, [rawNotifications, enabled]);

  const markAsRead = useCallback(async (notificationId: string) => {
    const success = await markNotificationRead(notificationId);
    if (success) {
      // Optimistically update cache
      queryClient.setQueryData(['notifications', userId], (old: AppNotification[] | undefined) => {
        if (!old) return old;
        return old.map(n => n.id === notificationId ? { ...n, read: true } : n);
      });
    }
  }, [queryClient, userId]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    const success = await markAllNotificationsRead(userId);
    if (success) {
      // Optimistically update cache
      queryClient.setQueryData(['notifications', userId], (old: AppNotification[] | undefined) => {
        if (!old) return old;
        return old.map(n => ({ ...n, read: true }));
      });
    }
  }, [queryClient, userId]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
  }, [queryClient, userId]);

  return {
    notifications,
    loading: isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refresh
  };
};
