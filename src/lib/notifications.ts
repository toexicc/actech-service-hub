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
  groupId?: string; // For group messages
}

export interface GroupChat {
  id: string;
  name: string;
  createdBy: string;
  memberIds: string[];
  memberNames: string[];
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
        groupId: message.groupId || '',
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

// ============ GROUP CHAT FUNCTIONS ============

export const fetchGroupChats = async (userId: string): Promise<GroupChat[]> => {
  try {
    const response = await fetch(
      `${GOOGLE_SHEETS_SCRIPT_URL}?action=getGroupChats&userId=${encodeURIComponent(userId)}`
    );
    const data = await response.json();
    return data.groups || data.data || [];
  } catch (error) {
    console.error('Error fetching group chats:', error);
    return [];
  }
};

export const createGroupChat = async (
  group: Omit<GroupChat, 'id' | 'createdAt'>
): Promise<{ success: boolean; groupId?: string }> => {
  try {
    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      body: new URLSearchParams({
        action: 'createGroupChat',
        name: group.name,
        createdBy: group.createdBy,
        memberIds: group.memberIds.join(','),
        memberNames: group.memberNames.join(','),
      }),
    });
    const data = await response.json();
    return {
      success: data.success || data.result === 'success',
      groupId: data.groupId,
    };
  } catch (error) {
    console.error('Error creating group chat:', error);
    return { success: false };
  }
};

export const fetchGroupMessages = async (groupId: string): Promise<Message[]> => {
  try {
    const response = await fetch(
      `${GOOGLE_SHEETS_SCRIPT_URL}?action=getGroupMessages&groupId=${encodeURIComponent(groupId)}`
    );
    const data = await response.json();
    return data.messages || data.data || [];
  } catch (error) {
    console.error('Error fetching group messages:', error);
    return [];
  }
};

export const sendGroupMessage = async (
  groupId: string,
  senderId: string,
  senderName: string,
  content: string
): Promise<boolean> => {
  try {
    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      body: new URLSearchParams({
        action: 'sendGroupMessage',
        groupId,
        senderId,
        senderName,
        content,
      }),
    });
    const data = await response.json();
    return data.success || data.result === 'success';
  } catch (error) {
    console.error('Error sending group message:', error);
    return false;
  }
};

export const addGroupMember = async (
  groupId: string,
  memberId: string,
  memberName: string
): Promise<boolean> => {
  try {
    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      body: new URLSearchParams({
        action: 'addGroupMember',
        groupId,
        memberId,
        memberName,
      }),
    });
    const data = await response.json();
    return data.success || data.result === 'success';
  } catch (error) {
    console.error('Error adding group member:', error);
    return false;
  }
};

export const removeGroupMember = async (
  groupId: string,
  memberId: string
): Promise<boolean> => {
  try {
    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      body: new URLSearchParams({
        action: 'removeGroupMember',
        groupId,
        memberId,
      }),
    });
    const data = await response.json();
    return data.success || data.result === 'success';
  } catch (error) {
    console.error('Error removing group member:', error);
    return false;
  }
};

export const leaveGroupChat = async (
  groupId: string,
  userId: string
): Promise<boolean> => {
  return removeGroupMember(groupId, userId);
};

// ============ TYPING INDICATOR FUNCTIONS ============

export const setTypingStatus = async (
  userId: string,
  conversationId: string,
  isGroup: boolean
): Promise<boolean> => {
  try {
    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      body: new URLSearchParams({
        action: 'setTypingStatus',
        userId,
        conversationId,
        isGroup: isGroup.toString(),
      }),
    });
    const data = await response.json();
    return data.success || data.result === 'success';
  } catch (error) {
    console.error('Error setting typing status:', error);
    return false;
  }
};

export const getTypingStatus = async (
  conversationId: string,
  isGroup: boolean
): Promise<{ userId: string; timestamp: string }[]> => {
  try {
    const response = await fetch(
      `${GOOGLE_SHEETS_SCRIPT_URL}?action=getTypingStatus&conversationId=${encodeURIComponent(conversationId)}&isGroup=${isGroup}`
    );
    const data = await response.json();
    return data.typingUsers || [];
  } catch (error) {
    console.error('Error getting typing status:', error);
    return [];
  }
};

export const clearTypingStatus = async (
  userId: string,
  conversationId: string
): Promise<boolean> => {
  try {
    const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      body: new URLSearchParams({
        action: 'clearTypingStatus',
        userId,
        conversationId,
      }),
    });
    const data = await response.json();
    return data.success || data.result === 'success';
  } catch (error) {
    console.error('Error clearing typing status:', error);
    return false;
  }
};
