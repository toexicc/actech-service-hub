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
    return data.notifications || [];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

export const markNotificationRead = async (notificationId: string): Promise<boolean> => {
  try {
    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'markNotificationRead',
        notificationId
      })
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error marking notification read:', error);
    return false;
  }
};

export const markAllNotificationsRead = async (userId: string): Promise<boolean> => {
  try {
    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'markAllNotificationsRead',
        userId
      })
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    return false;
  }
};

export const createNotification = async (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<boolean> => {
  try {
    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'createNotification',
        ...notification
      })
    });
    const data = await response.json();
    return data.success;
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
    return data.messages || [];
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
};

export const sendMessage = async (message: Omit<Message, 'id' | 'createdAt' | 'read'>): Promise<boolean> => {
  try {
    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'sendMessage',
        ...message
      })
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error sending message:', error);
    return false;
  }
};

export const markMessageRead = async (messageId: string): Promise<boolean> => {
  try {
    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'markMessageRead',
        messageId
      })
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error marking message read:', error);
    return false;
  }
};
