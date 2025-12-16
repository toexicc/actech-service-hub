import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Message,
  Conversation,
  Staff,
  subscribeToMessages,
  subscribeToStaff,
  sendMessage as firebaseSendMessage,
  markMessageAsRead,
  getConversations,
} from "@/lib/firebase";

export const useMessaging = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const userId = sessionStorage.getItem("userFullName") || "";
  const userName = sessionStorage.getItem("userFullName") || "";

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const unsubscribeMessages = subscribeToMessages(userId, (fetchedMessages) => {
      setMessages(fetchedMessages);
      setIsLoading(false);
    });

    const unsubscribeStaff = subscribeToStaff((fetchedStaff) => {
      setStaffList(fetchedStaff);
    });

    return () => {
      unsubscribeMessages();
      unsubscribeStaff();
    };
  }, [userId]);

  const conversations = useMemo(
    () => getConversations(messages, userId),
    [messages, userId]
  );

  const totalUnreadCount = useMemo(
    () => messages.filter((m) => !m.isRead && m.receiverId === userId).length,
    [messages, userId]
  );

  const getMessagesWithUser = useCallback(
    (otherUserId: string) => {
      return messages.filter(
        (m) =>
          (m.senderId === userId && m.receiverId === otherUserId) ||
          (m.senderId === otherUserId && m.receiverId === userId)
      );
    },
    [messages, userId]
  );

  const sendMessage = useCallback(
    async (receiverId: string, receiverName: string, content: string) => {
      try {
        await firebaseSendMessage({
          senderId: userId,
          senderName: userName,
          receiverId,
          receiverName,
          content,
        });
      } catch (error) {
        console.error("Error sending message:", error);
        throw error;
      }
    },
    [userId, userName]
  );

  const markAsRead = useCallback(async (messageId: string) => {
    try {
      await markMessageAsRead(messageId);
    } catch (error) {
      console.error("Error marking message as read:", error);
    }
  }, []);

  const markConversationAsRead = useCallback(
    async (otherUserId: string) => {
      const unreadMessages = messages.filter(
        (m) => m.senderId === otherUserId && m.receiverId === userId && !m.isRead
      );
      
      await Promise.all(unreadMessages.map((m) => markAsRead(m.id!)));
    },
    [messages, userId, markAsRead]
  );

  return {
    messages,
    conversations,
    staffList,
    totalUnreadCount,
    isLoading,
    getMessagesWithUser,
    sendMessage,
    markAsRead,
    markConversationAsRead,
  };
};
