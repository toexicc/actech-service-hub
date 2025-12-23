import { useState, useEffect, useCallback, useRef } from 'react';
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
    console.log('Could not play notification sound:', error);
  }
};

// Request browser notification permission
const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('Browser does not support notifications');
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

export const useNotifications = (userId: string | null) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const previousNotificationIds = useRef<Set<string>>(new Set());
  const hasShownInitialNotifications = useRef(false);

  // Request permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await fetchNotifications(userId);
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // On initial load, show notifications for recent unread messages
      if (!hasShownInitialNotifications.current && data.length > 0) {
        hasShownInitialNotifications.current = true;
        
        // Filter unread notifications from last 24 hours
        const recentUnread = data.filter(n => {
          if (n.read) return false;
          const notifDate = new Date(n.createdAt);
          return notifDate > twentyFourHoursAgo;
        });
        
        // Show native notifications with delay between each
        recentUnread.forEach((notification, index) => {
          setTimeout(() => {
            const cleanMessage = cleanNotificationMessage(notification.message);
            showBrowserNotification(notification.title, cleanMessage);
            if (index === 0) playNotificationSound(); // Only play sound once
          }, index * 1000); // 1 second delay between each
        });
        
        // Initialize previous IDs
        previousNotificationIds.current = new Set(data.map(n => n.id));
      } else if (hasShownInitialNotifications.current && data.length > 0) {
        // After initial load, only notify for truly new notifications
        const newNotifications = data.filter(
          n => !n.read && !previousNotificationIds.current.has(n.id)
        );
        
        for (const notification of newNotifications) {
          const cleanMessage = cleanNotificationMessage(notification.message);
          showBrowserNotification(notification.title, cleanMessage);
          playNotificationSound();
        }
        
        // Update previous notification IDs
        previousNotificationIds.current = new Set(data.map(n => n.id));
      }
      
      // Clean messages for display
      const cleanedNotifications = data.map(n => ({
        ...n,
        message: cleanNotificationMessage(n.message)
      }));
      
      setNotifications(cleanedNotifications);
      setUnreadCount(data.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadNotifications();
    // Poll every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const markAsRead = async (notificationId: string) => {
    const success = await markNotificationRead(notificationId);
    if (success) {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    const success = await markAllNotificationsRead(userId);
    if (success) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  };

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refresh: loadNotifications
  };
};
