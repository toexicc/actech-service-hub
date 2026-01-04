import { useState, useEffect, useCallback } from 'react';
import { 
  Message, 
  GroupChat,
  fetchMessages, 
  sendMessage as sendMessageApi, 
  markMessageRead,
  fetchGroupChats,
  fetchGroupMessages,
  sendGroupMessage as sendGroupMessageApi,
  createGroupChat as createGroupChatApi
} from '@/lib/notifications';

const parseMessageDate = (value: string): Date => {
  // Apps Script sometimes returns an ISO string that represents local time but ends with "Z".
  // If we treat it as UTC, it shifts and shows the wrong time.
  // Heuristic: when it ends with Z, parse it as *local* by removing the timezone.
  if (!value) return new Date(0);
  try {
    let date: Date;
    if (value.endsWith('Z')) {
      date = new Date(value.replace(/Z$/, ''));
    } else {
      date = new Date(value);
    }
    // Validate the date - if invalid, return epoch
    if (isNaN(date.getTime())) {
      console.warn('Invalid date value:', value);
      return new Date(0);
    }
    return date;
  } catch {
    console.warn('Error parsing date:', value);
    return new Date(0);
  }
};

export const useMessaging = (userId: string | null, username?: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [groupMessages, setGroupMessages] = useState<Record<string, Message[]>>({});
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadMessages = useCallback(async () => {
    if (!userId) return;
    try {
      // Fetch messages by both userId (staffId) and username to handle mixed data
      const fetchPromises = [fetchMessages(userId)];
      if (username && username !== userId) {
        fetchPromises.push(fetchMessages(username));
      }
      
      const results = await Promise.all(fetchPromises);
      const allMessages = results.flat();
      
      // Deduplicate by message ID
      const uniqueMessages = Array.from(
        new Map(allMessages.map(m => [m.id, m])).values()
      );
      
      setMessages((prev) => {
        // Remove local optimistic messages that now have server versions
        const serverMsgs = new Set(
          uniqueMessages.map((m) => `${m.senderId}|${m.receiverId}|${m.content}`)
        );
        const localToKeep = prev.filter(
          (m) =>
            m.id.startsWith('local-') &&
            !serverMsgs.has(`${m.senderId}|${m.receiverId}|${m.content}`)
        );
        return [...localToKeep, ...uniqueMessages].sort(
          (a, b) => parseMessageDate(b.createdAt).getTime() - parseMessageDate(a.createdAt).getTime()
        );
      });
      
      // Count unread where receiver matches either userId or username
      setUnreadCount(
        uniqueMessages.filter((m) => !m.read && (m.receiverId === userId || m.receiverId === username)).length
      );
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, username]);

  const loadGroupChats = useCallback(async () => {
    if (!userId) return;
    try {
      const groups = await fetchGroupChats(userId);
      setGroupChats(groups);
      
      // Load messages for each group
      if (groups.length > 0) {
        const groupMsgsPromises = groups.map(async (group) => {
          try {
            const msgs = await fetchGroupMessages(group.id);
            return { groupId: group.id, messages: msgs };
          } catch (error) {
            console.error(`Error loading messages for group ${group.id}:`, error);
            return { groupId: group.id, messages: [] };
          }
        });
        
        const groupMsgsResults = await Promise.all(groupMsgsPromises);
        const newGroupMessages: Record<string, Message[]> = {};
        groupMsgsResults.forEach(({ groupId, messages }) => {
          newGroupMessages[groupId] = messages.sort(
            (a, b) => parseMessageDate(b.createdAt).getTime() - parseMessageDate(a.createdAt).getTime()
          );
        });
        setGroupMessages(newGroupMessages);
      }
    } catch (error) {
      console.error('Error loading group chats:', error);
    }
  }, [userId]);

  useEffect(() => {
    loadMessages();
    loadGroupChats();
    // Poll every 15 seconds for messages
    const interval = setInterval(() => {
      loadMessages();
      loadGroupChats();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadMessages, loadGroupChats]);

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
      createdAt: new Date().toLocaleString(),
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

  const sendGroupMessage = async (groupId: string, senderName: string, content: string) => {
    if (!userId) return false;

    // Optimistic UI update
    const optimistic: Message = {
      id: `local-group-${Date.now()}`,
      senderId: userId,
      senderName,
      receiverId: groupId,
      receiverName: groupChats.find(g => g.id === groupId)?.name || 'Group',
      content,
      read: false,
      createdAt: new Date().toLocaleString(),
      groupId,
    };
    
    setGroupMessages((prev) => ({
      ...prev,
      [groupId]: [optimistic, ...(prev[groupId] || [])],
    }));

    const success = await sendGroupMessageApi(groupId, userId, senderName, content);

    if (success) {
      // Refresh group messages
      const msgs = await fetchGroupMessages(groupId);
      setGroupMessages((prev) => ({
        ...prev,
        [groupId]: msgs.sort(
          (a, b) => parseMessageDate(b.createdAt).getTime() - parseMessageDate(a.createdAt).getTime()
        ),
      }));
      return true;
    }

    // Roll back optimistic insert on failure
    setGroupMessages((prev) => ({
      ...prev,
      [groupId]: (prev[groupId] || []).filter((m) => m.id !== optimistic.id),
    }));
    return false;
  };

  const createGroupChat = async (name: string, memberIds: string[], memberNames: string[], creatorName: string) => {
    if (!userId) return null;

    const result = await createGroupChatApi({
      name,
      createdBy: userId,
      memberIds: [userId, ...memberIds],
      memberNames: [creatorName, ...memberNames],
    });

    if (result.success && result.groupId) {
      // Refresh group chats
      await loadGroupChats();
      return result.groupId;
    }

    return null;
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
    const userIds = new Set([userId, username].filter(Boolean));
    
    // Filter out group messages from direct messages
    const directMessages = messages.filter(m => !m.groupId);
    
    directMessages.forEach(msg => {
      // Determine partnerId based on whether current user sent or received
      const isSender = userIds.has(msg.senderId);
      const partnerId = isSender ? msg.receiverId : msg.senderId;
      const existing = conversationMap.get(partnerId) || [];
      existing.push(msg);
      conversationMap.set(partnerId, existing);
    });

    return Array.from(conversationMap.entries()).map(([partnerId, msgs]) => {
      const sortedMsgs = msgs.sort((a, b) => 
        parseMessageDate(b.createdAt).getTime() - parseMessageDate(a.createdAt).getTime()
      );
      const lastMessage = sortedMsgs[0];
      const userIds = new Set([userId, username].filter(Boolean));
      const isSender = userIds.has(lastMessage.senderId);
      const partnerName = isSender 
        ? lastMessage.receiverName 
        : lastMessage.senderName;
      
      return {
        partnerId,
        partnerName,
        lastMessage,
        messages: sortedMsgs,
        unreadCount: sortedMsgs.filter(m => !m.read && userIds.has(m.receiverId)).length,
        isGroup: false
      };
    }).sort((a, b) => 
      parseMessageDate(b.lastMessage.createdAt).getTime() - parseMessageDate(a.lastMessage.createdAt).getTime()
    );
  };

  const getGroupConversations = () => {
    return groupChats.map(group => {
      const msgs = groupMessages[group.id] || [];
      const lastMessage = msgs[0];
      
      return {
        groupId: group.id,
        groupName: group.name,
        memberIds: group.memberIds,
        memberNames: group.memberNames,
        lastMessage,
        messages: msgs,
        unreadCount: 0, // TODO: Implement group unread count
        isGroup: true
      };
    }).sort((a, b) => {
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return parseMessageDate(b.lastMessage.createdAt).getTime() - parseMessageDate(a.lastMessage.createdAt).getTime();
    });
  };

  return {
    messages,
    groupChats,
    groupMessages,
    loading,
    unreadCount,
    sendMessage,
    sendGroupMessage,
    createGroupChat,
    markAsRead,
    getConversations,
    getGroupConversations,
    refresh: () => {
      loadMessages();
      loadGroupChats();
    }
  };
};
