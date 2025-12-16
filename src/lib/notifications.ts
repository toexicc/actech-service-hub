import { GOOGLE_SHEETS_SCRIPT_URL } from './googleSheets';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'service_update' | 'new_inquiry' | 'message' | 'system';
  read: boolean;
  createdAt: string;
  serviceId?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export const fetchNotifications = async (userId: string): Promise<Notification[]> => {
  try {
    const response = await fetch(
      `${GOOGLE_SHEETS_SCRIPT_URL}?action=getNotifications&userId=${encodeURIComponent(userId)}`
    );
    const data = await response.json();
    return data.notifications || data.data || [];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

export const markNotificationRead = async (notificationId: string): Promise<boolean> => {
  try {
    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      body: new URLSearchParams({
        action: 'markNotificationRead',
        notificationId,
      }),
    });
    const data = await response.json();
    return data.success || data.result === 'success';
  } catch (error) {
    console.error('Error marking notification read:', error);
    return false;
  }
};

export const markAllNotificationsRead = async (userId: string): Promise<boolean> => {
  try {
    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      body: new URLSearchParams({
        action: 'markAllNotificationsRead',
        userId,
      }),
    });
    const data = await response.json();
    return data.success || data.result === 'success';
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    return false;
  }
};

export const createNotification = async (
  notification: Omit<Notification, 'id' | 'createdAt' | 'read'>
): Promise<boolean> => {
  try {
    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      body: new URLSearchParams({
        action: 'createNotification',
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        serviceId: notification.serviceId ?? '',
      }),
    });
    const data = await response.json();
    return data.success || data.result === 'success';
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
};

export const fetchMessages = async (userId: string): Promise<Message[]> => {
  try {
    const response = await fetch(
      `${GOOGLE_SHEETS_SCRIPT_URL}?action=getMessages&userId=${encodeURIComponent(userId)}`
    );
    const data = await response.json();
    return data.messages || data.data || [];
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
};

export const sendMessage = async (message: Omit<Message, 'id' | 'createdAt' | 'read'>): Promise<boolean> => {
  try {
    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      body: new URLSearchParams({
        action: 'sendMessage',
        senderId: message.senderId,
        senderName: message.senderName,
        receiverId: message.receiverId,
        receiverName: message.receiverName,
        content: message.content,
      }),
    });
    const data = await response.json();
    return data.success || data.result === 'success';
  } catch (error) {
    console.error('Error sending message:', error);
    return false;
  }
};

export const markMessageRead = async (messageId: string): Promise<boolean> => {
  try {
    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      body: new URLSearchParams({
        action: 'markMessageRead',
        messageId,
      }),
    });
    const data = await response.json();
    return data.success || data.result === 'success';
  } catch (error) {
    console.error('Error marking message read:', error);
    return false;
  }
};
