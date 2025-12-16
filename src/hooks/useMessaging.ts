import { useState, useEffect, useCallback } from 'react';
import { Message, fetchMessages, sendMessage as sendMessageApi, markMessageRead } from '@/lib/notifications';

export const useMessaging = (userId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadMessages = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await fetchMessages(userId);
      setMessages((prev) => {
        // Remove local optimistic messages that now have server versions
        const serverMsgs = new Set(
          data.map((m) => `${m.senderId}|${m.receiverId}|${m.content}`)
        );
        const localToKeep = prev.filter(
          (m) =>
            m.id.startsWith('local-') &&
            !serverMsgs.has(`${m.senderId}|${m.receiverId}|${m.content}`)
        );
        return [...localToKeep, ...data].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
      setUnreadCount(data.filter((m) => !m.read && m.receiverId === userId).length);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadMessages();
    // Poll every 15 seconds for messages
    const interval = setInterval(loadMessages, 15000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const sendMessage = async (receiverId: string, receiverName: string, senderName: string, content: string) => {
    if (!userId) return false;

    // Optimistic UI update (Google Apps Script can be slow)
    const optimistic: Message = {
      id: `local-${Date.now()}`,
      senderId: userId,
      senderName,
      receiverId,
      receiverName,
      content,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [optimistic, ...prev]);

    const success = await sendMessageApi({
      senderId: userId,
      senderName,
      receiverId,
      receiverName,
      content,
    });

    if (success) {
      // Refresh in background to replace optimistic message with saved one
      loadMessages();
      return true;
    }

    // Roll back optimistic insert on failure
    setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    return false;
  };

  const markAsRead = async (messageId: string) => {
    const success = await markMessageRead(messageId);
    if (success) {
      setMessages(prev => 
        prev.map(m => m.id === messageId ? { ...m, read: true } : m)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const getConversations = () => {
    const conversationMap = new Map<string, Message[]>();
    
    messages.forEach(msg => {
      const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      const existing = conversationMap.get(partnerId) || [];
      existing.push(msg);
      conversationMap.set(partnerId, existing);
    });

    return Array.from(conversationMap.entries()).map(([partnerId, msgs]) => {
      const sortedMsgs = msgs.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const lastMessage = sortedMsgs[0];
      const partnerName = lastMessage.senderId === userId 
        ? lastMessage.receiverName 
        : lastMessage.senderName;
      
      return {
        partnerId,
        partnerName,
        lastMessage,
        messages: sortedMsgs,
        unreadCount: sortedMsgs.filter(m => !m.read && m.receiverId === userId).length
      };
    }).sort((a, b) => 
      new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );
  };

  return {
    messages,
    loading,
    unreadCount,
    sendMessage,
    markAsRead,
    getConversations,
    refresh: loadMessages
  };
};
