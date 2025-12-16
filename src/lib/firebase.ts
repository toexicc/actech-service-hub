import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, set, get, onValue, update, query, orderByChild, equalTo, limitToLast, off, DataSnapshot } from "firebase/database";

// Firebase configuration - you'll need to replace these with your actual Firebase project credentials
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// ============ NOTIFICATION FUNCTIONS ============

export interface Notification {
  id?: string;
  userId: string;
  serviceId: string;
  message: string;
  type: "status_change" | "assignment" | "update" | "message";
  timestamp: number;
  isRead: boolean;
  metadata?: {
    oldStatus?: string;
    newStatus?: string;
    changedBy?: string;
  };
}

export const createNotification = async (notification: Omit<Notification, "id" | "timestamp" | "isRead">) => {
  const notificationsRef = ref(database, "notifications");
  const newNotificationRef = push(notificationsRef);
  
  const notificationData: Notification = {
    ...notification,
    timestamp: Date.now(),
    isRead: false,
  };
  
  await set(newNotificationRef, notificationData);
  return newNotificationRef.key;
};

export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
) => {
  const notificationsRef = ref(database, "notifications");
  
  const handleSnapshot = (snapshot: DataSnapshot) => {
    const notifications: Notification[] = [];
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val();
      if (data.userId === userId) {
        notifications.push({
          ...data,
          id: childSnapshot.key,
        });
      }
    });
    // Sort by timestamp descending
    notifications.sort((a, b) => b.timestamp - a.timestamp);
    callback(notifications);
  };
  
  onValue(notificationsRef, handleSnapshot);
  
  // Return unsubscribe function
  return () => off(notificationsRef);
};

export const markNotificationAsRead = async (notificationId: string) => {
  const notificationRef = ref(database, `notifications/${notificationId}`);
  await update(notificationRef, { isRead: true });
};

export const markAllNotificationsAsRead = async (userId: string) => {
  const notificationsRef = ref(database, "notifications");
  const snapshot = await get(notificationsRef);
  
  const updates: { [key: string]: boolean } = {};
  snapshot.forEach((childSnapshot) => {
    const data = childSnapshot.val();
    if (data.userId === userId && !data.isRead) {
      updates[`notifications/${childSnapshot.key}/isRead`] = true;
    }
  });
  
  if (Object.keys(updates).length > 0) {
    await update(ref(database), updates);
  }
};

// ============ MESSAGING FUNCTIONS ============

export interface Message {
  id?: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  content: string;
  timestamp: number;
  isRead: boolean;
}

export interface Conversation {
  oderId: string;
  otherUserName: string;
  lastMessage: string;
  lastTimestamp: number;
  unreadCount: number;
}

export const sendMessage = async (message: Omit<Message, "id" | "timestamp" | "isRead">) => {
  const messagesRef = ref(database, "messages");
  const newMessageRef = push(messagesRef);
  
  const messageData: Message = {
    ...message,
    timestamp: Date.now(),
    isRead: false,
  };
  
  await set(newMessageRef, messageData);
  return newMessageRef.key;
};

export const subscribeToMessages = (
  userId: string,
  callback: (messages: Message[]) => void
) => {
  const messagesRef = ref(database, "messages");
  
  const handleSnapshot = (snapshot: DataSnapshot) => {
    const messages: Message[] = [];
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val();
      if (data.senderId === userId || data.receiverId === userId) {
        messages.push({
          ...data,
          id: childSnapshot.key,
        });
      }
    });
    // Sort by timestamp ascending for chat display
    messages.sort((a, b) => a.timestamp - b.timestamp);
    callback(messages);
  };
  
  onValue(messagesRef, handleSnapshot);
  
  return () => off(messagesRef);
};

export const markMessageAsRead = async (messageId: string) => {
  const messageRef = ref(database, `messages/${messageId}`);
  await update(messageRef, { isRead: true });
};

export const getConversations = (messages: Message[], userId: string): Conversation[] => {
  const conversationMap = new Map<string, Conversation>();
  
  messages.forEach((msg) => {
    const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
    const otherName = msg.senderId === userId ? msg.receiverName : msg.senderName;
    
    const existing = conversationMap.get(otherId);
    const isUnread = !msg.isRead && msg.receiverId === userId;
    
    if (!existing || msg.timestamp > existing.lastTimestamp) {
      conversationMap.set(otherId, {
        oderId: otherId,
        otherUserName: otherName,
        lastMessage: msg.content,
        lastTimestamp: msg.timestamp,
        unreadCount: (existing?.unreadCount || 0) + (isUnread ? 1 : 0),
      });
    } else if (isUnread) {
      existing.unreadCount++;
    }
  });
  
  return Array.from(conversationMap.values()).sort((a, b) => b.lastTimestamp - a.lastTimestamp);
};

// ============ STAFF FUNCTIONS ============

export interface Staff {
  id: string;
  name: string;
  role: string;
}

export const subscribeToStaff = (callback: (staff: Staff[]) => void) => {
  const staffRef = ref(database, "staff");
  
  const handleSnapshot = (snapshot: DataSnapshot) => {
    const staffList: Staff[] = [];
    snapshot.forEach((childSnapshot) => {
      staffList.push({
        id: childSnapshot.key!,
        ...childSnapshot.val(),
      });
    });
    callback(staffList);
  };
  
  onValue(staffRef, handleSnapshot);
  
  return () => off(staffRef);
};

export const addStaffMember = async (staff: Omit<Staff, "id">) => {
  const staffRef = ref(database, "staff");
  const newStaffRef = push(staffRef);
  await set(newStaffRef, staff);
  return newStaffRef.key;
};

export { database, ref, onValue, off };
