import { useState, useEffect, useCallback } from "react";
import {
  Notification,
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createNotification,
} from "@/lib/firebase";

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const userId = sessionStorage.getItem("userFullName") || "";

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = subscribeToNotifications(userId, (fetchedNotifications) => {
      setNotifications(fetchedNotifications);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead(userId);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }, [userId]);

  const sendNotification = useCallback(
    async (
      targetUserId: string,
      serviceId: string,
      message: string,
      type: Notification["type"],
      metadata?: Notification["metadata"]
    ) => {
      try {
        await createNotification({
          userId: targetUserId,
          serviceId,
          message,
          type,
          metadata,
        });
      } catch (error) {
        console.error("Error sending notification:", error);
      }
    },
    []
  );

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    sendNotification,
  };
};
