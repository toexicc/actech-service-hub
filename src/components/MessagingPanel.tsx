import { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Send, ArrowLeft, Users, Search, Image, X, Camera, Check, CheckCheck, RotateCcw, UsersRound, UserPlus, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useMessaging } from '@/hooks/useMessaging';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { parseManilaDate } from '@/lib/timezone';

import { setTypingStatus, clearTypingStatus, getTypingStatus, markGroupMessageRead, getGroupMessageReadReceipts, ReadReceipt } from '@/lib/notifications';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const parseMessageDate = (value: string): Date => {
  const parsed = parseManilaDate(value);
  if (!parsed) {
    console.warn('Invalid date value in MessagingPanel:', value);
    return new Date(0);
  }
  return parsed;
};

const formatDateSeparator = (date: Date): string => {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
};

interface Staff {
  staffId: string;
  username?: string;
  name: string;
  department: string;
}

interface MessagingPanelProps {
  userId: string | null;
  userName: string | null;
}

export interface MessagingPanelRef {
  openPanel: () => void;
}

interface PendingMessage {
  id: string;
  content: string;
  receiverId: string;
  receiverName: string;
  status: 'sending' | 'sent' | 'failed';
  timestamp: Date;
  isGroup?: boolean;
}

export const MessagingPanel = forwardRef<MessagingPanelRef, MessagingPanelProps>(({ userId, userName }, ref) => {
  const navigate = useNavigate();
  const username = typeof window !== 'undefined' ? sessionStorage.getItem('username') : null;
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const { 
    messages, 
    groupChats,
    groupMessages,
    unreadCount, 
    sendMessage, 
    sendGroupMessage,
    createGroupChat,
    markAsRead, 
    getConversations, 
    getGroupConversations,
    refresh 
  } = useMessaging(userId, username, isSheetOpen);

  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const [showGroupChatDialog, setShowGroupChatDialog] = useState(false);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [groupChatName, setGroupChatName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentAtRef = useRef<number>(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [readReceipts, setReadReceipts] = useState<Record<string, ReadReceipt[]>>({});
  const [loadingReceipts, setLoadingReceipts] = useState(false);

  // Expose openPanel method via ref
  useImperativeHandle(ref, () => ({
    openPanel: () => setIsSheetOpen(true),
  }), []);

  useEffect(() => {
    if (!isSheetOpen) return;

    (async () => {
      try {
        const { fetchStaffList } = await import('@/lib/staffList');
        const all = await fetchStaffList();
        setStaffList(all.filter((s) => s.staffId !== userId && s.username !== username) as any);
      } catch (error) {
        console.error('Error fetching staff:', error);
      }
    })();
  }, [isSheetOpen, userId, username]);

  const findStaffById = (id: string) => 
    staffList.find(s => s.staffId === id || s.username === id);

  const typingConversationId = useMemo(() => {
    if (selectedGroupId) return selectedGroupId;
    if (!userId || !selectedConversation) return null;
    // Use a stable key so both users query the same conversation ID
    return [userId, selectedConversation].sort().join('__');
  }, [selectedGroupId, userId, selectedConversation]);

  // Typing indicator logic
  const handleTyping = useCallback(async () => {
    if (!userId || !typingConversationId) return;

    // Mark local state as typing immediately
    if (!isTyping) setIsTyping(true);

    // Update remote typing status frequently while the user is typing.
    // Throttle to avoid spamming the Apps Script endpoint.
    const now = Date.now();
    if (now - lastTypingSentAtRef.current > 700) {
      lastTypingSentAtRef.current = now;
      await setTypingStatus(userId, typingConversationId, !!selectedGroupId);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to clear typing status after 3 seconds of no typing
    typingTimeoutRef.current = setTimeout(async () => {
      setIsTyping(false);
      await clearTypingStatus(userId, typingConversationId);
    }, 3000);
  }, [userId, typingConversationId, selectedGroupId, isTyping]);

  // Poll for typing status
  useEffect(() => {
    if (!typingConversationId) {
      setTypingUsers([]);
      return;
    }

    const pollTyping = async () => {
      const typing = await getTypingStatus(typingConversationId, !!selectedGroupId);
      const selfIds = new Set([userId, username].filter(Boolean).map(id => id?.toLowerCase()));
      const otherTyping = typing
        .filter((t) => !selfIds.has(t.userId?.toLowerCase()))
        .map((t) => {
          const staff = staffList.find((s) => s.staffId === t.userId || s.username === t.userId);
          return staff?.name || t.userId;
        });
      setTypingUsers(otherTyping);
    };

    pollTyping();
    const interval = setInterval(pollTyping, 2000);
    return () => clearInterval(interval);
  }, [typingConversationId, selectedGroupId, userId, username, staffList]);

  // Clear typing on unmount or conversation change
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (typingConversationId && userId) {
        clearTypingStatus(userId, typingConversationId);
      }
    };
  }, [typingConversationId, userId]);

  // Fetch read receipts for group messages and mark messages as read
  useEffect(() => {
    if (!selectedGroupId || !userId || !userName) return;

    const fetchReceipts = async () => {
      setLoadingReceipts(true);
      try {
        const receipts = await getGroupMessageReadReceipts(selectedGroupId);
        setReadReceipts(receipts);
      } catch (error) {
        console.error('Error fetching read receipts:', error);
      }
      setLoadingReceipts(false);
    };

    // Mark unread messages as read
    const markMessagesRead = async () => {
      const groupMsgs = groupMessages[selectedGroupId] || [];
      for (const msg of groupMsgs) {
        // Only mark messages from others as read
        if (msg.senderId !== userId && msg.senderName !== userName) {
          await markGroupMessageRead(msg.id, userId, userName);
        }
      }
    };

    fetchReceipts();
    markMessagesRead();

    // Poll for new read receipts every 10 seconds
    const interval = setInterval(fetchReceipts, 10000);
    return () => clearInterval(interval);
  }, [selectedGroupId, userId, userName, groupMessages]);

  const conversations = getConversations();
  const groupConversations = getGroupConversations();
  
  const filteredConversations = conversations.filter(conv => 
    conv.partnerName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredGroupConversations = groupConversations.filter(group =>
    group.groupName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredStaff = staffList.filter(staff =>
    staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    staff.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const currentConversation = conversations.find(c => {
    if (c.partnerId === selectedConversation) return true;
    const staff = findStaffById(c.partnerId);
    return staff && (staff.staffId === selectedConversation || staff.username === selectedConversation);
  });

  const currentGroup = selectedGroupId ? groupConversations.find(g => g.groupId === selectedGroupId) : null;

  const handleSend = async () => {
    if ((!newMessage.trim() && !attachedImage) || !userName) return;
    
    let messageContent = newMessage.trim();
    if (attachedImage) {
      messageContent = messageContent ? `${messageContent}\n[Image: ${attachedImage}]` : `[Image: ${attachedImage}]`;
    }
    
    const pendingId = `pending-${Date.now()}`;
    
    if (selectedGroupId && currentGroup) {
      // Send to group
      const pendingMsg: PendingMessage = {
        id: pendingId,
        content: messageContent,
        receiverId: selectedGroupId,
        receiverName: currentGroup.groupName,
        status: 'sending',
        timestamp: new Date(),
        isGroup: true
      };
      
      setPendingMessages(prev => [...prev, pendingMsg]);
      setNewMessage('');
      setAttachedImage(null);
      setSending(true);
      
      const success = await sendGroupMessage(selectedGroupId, userName, messageContent);
      
      if (success) {
        setPendingMessages(prev => prev.filter(m => m.id !== pendingId));
      } else {
        setPendingMessages(prev => 
          prev.map(m => m.id === pendingId ? { ...m, status: 'failed' as const } : m)
        );
        toast.error('Failed to send message');
      }
      setSending(false);
    } else if (selectedConversation) {
      // Send direct message
      const partner = findStaffById(selectedConversation) || 
                     conversations.find(c => c.partnerId === selectedConversation);
      const partnerName = partner ? ('name' in partner ? partner.name : partner.partnerName) : 'Unknown';
      
      const pendingMsg: PendingMessage = {
        id: pendingId,
        content: messageContent,
        receiverId: selectedConversation,
        receiverName: partnerName,
        status: 'sending',
        timestamp: new Date()
      };
      
      setPendingMessages(prev => [...prev, pendingMsg]);
      setNewMessage('');
      setAttachedImage(null);
      setSending(true);
      
      const success = await sendMessage(selectedConversation, partnerName, userName, messageContent);
      
      if (success) {
        setPendingMessages(prev => prev.filter(m => m.id !== pendingId));
      } else {
        setPendingMessages(prev => 
          prev.map(m => m.id === pendingId ? { ...m, status: 'failed' as const } : m)
        );
        toast.error('Failed to send message');
      }
      setSending(false);
    }
  };

  const retryMessage = async (pendingMsg: PendingMessage) => {
    if (!userName) return;
    
    setPendingMessages(prev => 
      prev.map(m => m.id === pendingMsg.id ? { ...m, status: 'sending' as const } : m)
    );
    
    let success = false;
    if (pendingMsg.isGroup) {
      success = await sendGroupMessage(pendingMsg.receiverId, userName, pendingMsg.content);
    } else {
      success = await sendMessage(pendingMsg.receiverId, pendingMsg.receiverName, userName, pendingMsg.content);
    }
    
    if (success) {
      setPendingMessages(prev => prev.filter(m => m.id !== pendingMsg.id));
      toast.success('Message sent');
    } else {
      setPendingMessages(prev => 
        prev.map(m => m.id === pendingMsg.id ? { ...m, status: 'failed' as const } : m)
      );
      toast.error('Failed to send message');
    }
  };

  const startNewChat = (staff: Staff) => {
    const existingConv = conversations.find(c => {
      const convStaff = findStaffById(c.partnerId);
      return convStaff && (convStaff.staffId === staff.staffId);
    });
    
    if (existingConv) {
      setSelectedConversation(existingConv.partnerId);
    } else {
      setSelectedConversation(staff.staffId);
    }
    setSelectedGroupId(null);
    setShowNewChat(false);
    setSearchQuery('');
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateGroupChat = async () => {
    if (selectedGroupMembers.length < 1) {
      toast.error('Select at least 1 member for a group chat');
      return;
    }
    if (!groupChatName.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    if (!userName) {
      toast.error('User not logged in');
      return;
    }

    setCreatingGroup(true);
    
    const memberNames = selectedGroupMembers.map(id => {
      const staff = staffList.find(s => s.staffId === id);
      return staff?.name || 'Unknown';
    });

    const groupId = await createGroupChat(groupChatName.trim(), selectedGroupMembers, memberNames, userName);
    
    if (groupId) {
      toast.success('Group chat created!');
      setShowGroupChatDialog(false);
      setSelectedGroupMembers([]);
      setGroupChatName('');
      setSelectedGroupId(groupId);
      setSelectedConversation(null);
    } else {
      toast.error('Failed to create group chat');
    }
    
    setCreatingGroup(false);
  };

  const toggleGroupMember = (staffId: string) => {
    setSelectedGroupMembers(prev => 
      prev.includes(staffId) 
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };

  const renderMessageContent = (content: string, isOwn: boolean = false) => {
    // Check for image attachments
    const imageMatch = content.match(/\[Image: (data:image\/[^;]+;base64,[^\]]+)\]/);
    if (imageMatch) {
      const textContent = content.replace(/\[Image: data:image\/[^;]+;base64,[^\]]+\]/, '').trim();
      return (
        <>
          {textContent && <p className="text-sm mb-2 whitespace-pre-wrap">{textContent}</p>}
          <img 
            src={imageMatch[1]} 
            alt="Attached" 
            className="max-w-full rounded-md max-h-48 object-contain cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setImageViewerUrl(imageMatch[1])}
          />
        </>
      );
    }

    // Check for forwarded service messages and render a redirect button
    // Supports both legacy "🔗 View Details: https://..." and newer "🔗 NAV_PATH: /..." formats.
    const forwardMatch = content.match(/📋 Service Forwarded:/);
    if (forwardMatch) {
      const legacyUrlMatch = content.match(/🔗 View Details: ([^\s]+)/);
      const navPathMatch = content.match(/🔗 NAV_PATH: (\/[\S]+)/);

      const targetRaw = navPathMatch?.[1] || legacyUrlMatch?.[1] || "";

      const textWithoutLink = content
        .replace(/🔗\s*NAV_PATH:\s*\/[\S]+/, "")
        .replace(/🔗\s*View Details:\s*[^\s]+/, "")
        .trim();

      const navigateTo = (raw: string) => {
        if (!raw) return;

        let path = raw;
        try {
          if (raw.startsWith("http")) {
            const u = new URL(raw);
            path = `${u.pathname}${u.search}`;
          }
        } catch {
          // ignore
        }

        if (!path.startsWith("/")) return;

        setIsSheetOpen(false);
        navigate(path);
      };

      return (
        <div className="space-y-2">
          <p className="text-sm whitespace-pre-wrap">{textWithoutLink}</p>
          {!!targetRaw && (
            <Button
              size="sm"
              variant={isOwn ? "secondary" : "default"}
              className={`w-full ${isOwn ? "" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
              onClick={() => navigateTo(targetRaw)}
            >
              View Service Details
            </Button>
          )}
        </div>
      );
    }

    // Check for any URLs in regular messages and make them clickable
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    const hasUrls = urlRegex.test(content);
    
    if (hasUrls) {
      return (
        <p className="text-sm whitespace-pre-wrap">
          {parts.map((part, index) => {
            if (part.match(/^https?:\/\//)) {
              return (
                <a 
                  key={index}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-300 underline hover:text-blue-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  {part}
                </a>
              );
            }
            return part;
          })}
        </p>
      );
    }
    
    return <p className="text-sm whitespace-pre-wrap">{content}</p>;
  };

  const renderMessageStatus = (msg: any, isOwn: boolean) => {
    if (!isOwn) return null;
    
    const time = format(parseMessageDate(msg.createdAt), 'h:mm a');
    const messageReceipts = selectedGroupId ? readReceipts[msg.id] || [] : [];
    const isGroupMessage = !!selectedGroupId;
    const currentGroup = selectedGroupId ? groupConversations.find(g => g.groupId === selectedGroupId) : null;
    
    // For group messages, show read by count
    if (isGroupMessage && currentGroup) {
      const otherMemberCount = currentGroup.memberNames.length - 1; // Exclude sender
      const readByCount = messageReceipts.length;
      const allRead = readByCount >= otherMemberCount && otherMemberCount > 0;
      
      return (
        <div className="flex items-center gap-1 mt-1">
          <span className="text-xs text-primary-foreground/70">{time}</span>
          {readByCount > 0 ? (
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-0.5 hover:opacity-80">
                  <CheckCheck className={`h-3.5 w-3.5 ${allRead ? 'text-blue-400' : 'text-primary-foreground/70'}`} />
                  <span className="text-xs text-primary-foreground/70">{readByCount}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" side="top" align="end">
                <div className="text-xs font-medium mb-2">Read by</div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {messageReceipts.map((receipt) => (
                    <div key={receipt.id} className="flex items-center justify-between text-xs">
                      <span className="truncate">{receipt.userName}</span>
                      <span className="text-muted-foreground">
                        {format(new Date(receipt.readAt), 'h:mm a')}
                      </span>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <span title="Delivered"><Check className="h-3.5 w-3.5 text-primary-foreground/70" /></span>
          )}
        </div>
      );
    }
    
    // For direct messages
    const isRead = msg.read;
    return (
      <div className="flex items-center gap-1 mt-1">
        <span className="text-xs text-primary-foreground/70">{time}</span>
        {isRead ? (
          <span title="Read"><CheckCheck className="h-3.5 w-3.5 text-blue-400" /></span>
        ) : (
          <span title="Delivered"><Check className="h-3.5 w-3.5 text-primary-foreground/70" /></span>
        )}
      </div>
    );
  };

  const renderPendingStatus = (status: 'sending' | 'sent' | 'failed', onRetry?: () => void) => {
    switch (status) {
      case 'sending':
        return (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-primary-foreground/70">Sending...</span>
            <div className="h-3 w-3 border-2 border-primary-foreground/50 border-t-transparent rounded-full animate-spin" />
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-destructive">Failed</span>
            {onRetry && (
              <button onClick={onRetry} className="p-0.5 hover:bg-white/20 rounded">
                <RotateCcw className="h-3 w-3 text-primary-foreground" />
              </button>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  // Filter out pending messages that already appear in the actual messages
  const conversationPendingMessages = pendingMessages.filter(m => {
    const isForCurrentConversation = (selectedGroupId && m.receiverId === selectedGroupId) ||
      (!selectedGroupId && m.receiverId === selectedConversation);
    if (!isForCurrentConversation) return false;
    
    // Don't show pending message if it's already in the real messages (only show failed ones)
    if (m.status === 'sending') return false;
    
    return true;
  });

  const currentMessages = selectedGroupId 
    ? (groupMessages[selectedGroupId] || [])
    : (currentConversation?.messages || []);

  const chatTitle = selectedGroupId 
    ? currentGroup?.groupName 
    : currentConversation?.partnerName || 'Chat';

  return (
    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <MessageCircle className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col h-full max-h-screen overflow-hidden">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            {(selectedConversation || selectedGroupId) ? (
              <>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    setSelectedConversation(null);
                    setSelectedGroupId(null);
                    setAttachedImage(null);
                  }}
                  className="h-8 w-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2">
                  {selectedGroupId && <UsersRound className="h-4 w-4 text-muted-foreground" />}
                  <span>{chatTitle}</span>
                </div>
              </>
            ) : showNewChat ? (
              <>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    setShowNewChat(false);
                    setSearchQuery('');
                  }}
                  className="h-8 w-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span>New Message</span>
              </>
            ) : (
              <>
                <MessageCircle className="h-5 w-5" />
                <span>Messages</span>
              </>
            )}
          </SheetTitle>
        </SheetHeader>

        {(selectedConversation || selectedGroupId) ? (
          // Chat view
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Group members badge */}
            {selectedGroupId && currentGroup && (
              <div className="px-4 py-2 border-b bg-muted/30 flex-shrink-0">
                <p className="text-xs text-muted-foreground mb-1">Members:</p>
                <div className="flex flex-wrap gap-1">
                  {currentGroup.memberNames.map((name, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            <ScrollArea className="flex-1 min-h-0 p-4">
              <div className="space-y-3">
                {(() => {
                  const sortedMessages = currentMessages.slice().reverse();
                  let lastDate: Date | null = null;
                  
                  return sortedMessages.map((msg, index) => {
                    const userIds = new Set([userId, username].filter(Boolean));
                    const isOwn = userIds.has(msg.senderId);
                    const msgDate = parseMessageDate(msg.createdAt);
                    
                    // Check if we need a date separator
                    const showDateSeparator = !lastDate || !isSameDay(lastDate, msgDate);
                    lastDate = msgDate;
                    
                    if (!msg.read && userIds.has(msg.receiverId) && !selectedGroupId) {
                      markAsRead(msg.id);
                    }
                    
                    return (
                      <div key={msg.id}>
                        {/* Date Separator */}
                        {showDateSeparator && (
                          <div className="flex items-center justify-center my-4">
                            <div className="flex-1 border-t border-border" />
                            <span className="px-3 text-xs text-muted-foreground bg-background">
                              {formatDateSeparator(msgDate)}
                            </span>
                            <div className="flex-1 border-t border-border" />
                          </div>
                        )}
                        
                        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[80%] rounded-lg px-3 py-2 ${
                              isOwn
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            {/* Show sender name in group chats */}
                            {selectedGroupId && !isOwn && (
                              <p className="text-xs font-medium mb-1 text-primary">
                                {msg.senderName}
                              </p>
                            )}
                            {renderMessageContent(msg.content, isOwn)}
                            {isOwn ? (
                              renderMessageStatus(msg, isOwn)
                            ) : (
                              <p className="text-xs mt-1 text-muted-foreground">
                                {format(parseMessageDate(msg.createdAt), 'h:mm a')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
                
                {/* Pending messages */}
                {conversationPendingMessages.map((pendingMsg) => (
                  <div key={pendingMsg.id} className="flex justify-end">
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      pendingMsg.status === 'failed' 
                        ? 'bg-destructive/80 text-destructive-foreground' 
                        : 'bg-primary/70 text-primary-foreground'
                    }`}>
                      {renderMessageContent(pendingMsg.content, true)}
                      {renderPendingStatus(pendingMsg.status, () => retryMessage(pendingMsg))}
                    </div>
                  </div>
                ))}
                
                {/* Typing indicator */}
                {typingUsers.length > 0 && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {typingUsers.length === 1 
                            ? `${typingUsers[0]} is typing...` 
                            : `${typingUsers.slice(0, 2).join(', ')}${typingUsers.length > 2 ? ` +${typingUsers.length - 2}` : ''} are typing...`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {/* Attached image preview */}
            {attachedImage && (
              <div className="px-4 py-2 border-t bg-muted/50 flex-shrink-0">
                <div className="relative inline-block">
                  <img 
                    src={attachedImage} 
                    alt="Attached" 
                    className="h-20 rounded-md object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => setAttachedImage(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
            
            <div className="border-t p-4 flex gap-2 flex-shrink-0">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraCapture}
                  className="hidden"
                />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={sending}
                  title="Take photo"
                  className="flex-shrink-0"
                >
                  <Camera className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  title="Attach image"
                  className="flex-shrink-0"
                >
                  <Image className="h-4 w-4" />
                </Button>

                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  disabled={sending}
                  className="flex-1 min-w-0"
                />
                <Button onClick={handleSend} disabled={sending || (!newMessage.trim() && !attachedImage)} className="flex-shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
          </div>
        ) : showNewChat ? (
          // Staff list for new chat
          <div className="flex-1 flex flex-col">
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search staff..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">
                {filteredStaff.length === 0 ? (
                  <p className="text-center text-muted-foreground p-4">
                    {searchQuery ? 'No staff found' : 'No staff available'}
                  </p>
                ) : (
                  filteredStaff.map((staff) => (
                    <button
                      key={staff.staffId}
                      onClick={() => startNewChat(staff)}
                      className="w-full p-3 rounded-lg hover:bg-accent text-left flex items-center gap-3"
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium">{staff.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium">{staff.name}</p>
                        <p className="text-xs text-muted-foreground">{staff.department}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        ) : (
          // Conversations list
          <div className="flex-1 flex flex-col">
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">
                {/* Group Chats Section */}
                {filteredGroupConversations.length > 0 && (
                  <>
                    <p className="text-xs font-medium text-muted-foreground px-3 py-2">Group Chats</p>
                    {filteredGroupConversations.map((group) => (
                      <button
                        key={group.groupId}
                        onClick={() => {
                          setSelectedGroupId(group.groupId);
                          setSelectedConversation(null);
                        }}
                        className="w-full p-3 rounded-lg hover:bg-accent text-left flex items-center gap-3"
                      >
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center relative">
                          <UsersRound className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{group.groupName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {group.lastMessage 
                              ? (group.lastMessage.content.includes('[Image:') 
                                  ? '📷 Image' 
                                  : `${group.lastMessage.senderName}: ${group.lastMessage.content}`)
                              : `${group.memberNames.length} members`}
                          </p>
                        </div>
                        {group.lastMessage && (
                          <span className="text-xs text-muted-foreground">
                            {format(parseMessageDate(group.lastMessage.createdAt), 'MMM d')}
                          </span>
                        )}
                      </button>
                    ))}
                  </>
                )}

                {/* Direct Messages Section */}
                {(filteredConversations.length > 0 || filteredGroupConversations.length > 0) && filteredConversations.length > 0 && (
                  <p className="text-xs font-medium text-muted-foreground px-3 py-2 mt-2">Direct Messages</p>
                )}
                
                {filteredConversations.length === 0 && filteredGroupConversations.length === 0 ? (
                  <p className="text-center text-muted-foreground p-4">
                    {searchQuery ? 'No conversations found' : 'No conversations yet'}
                  </p>
                ) : (
                  filteredConversations.map((conv) => (
                    <button
                      key={conv.partnerId}
                      onClick={() => {
                        setSelectedConversation(conv.partnerId);
                        setSelectedGroupId(null);
                      }}
                      className="w-full p-3 rounded-lg hover:bg-accent text-left flex items-center gap-3"
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center relative">
                        <span className="text-sm font-medium">{conv.partnerName.charAt(0)}</span>
                        {conv.unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{conv.partnerName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.lastMessage.content.includes('[Image:') 
                            ? '📷 Image' 
                            : conv.lastMessage.content}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(parseMessageDate(conv.lastMessage.createdAt), 'MMM d')}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="p-4 border-t flex gap-2">
              <Button 
                onClick={() => {
                  setShowNewChat(true);
                  setSearchQuery('');
                }} 
                className="flex-1"
                variant="outline"
              >
                <Users className="h-4 w-4 mr-2" />
                New Message
              </Button>
              <Dialog open={showGroupChatDialog} onOpenChange={setShowGroupChatDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" title="Create Group Chat">
                    <UsersRound className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Group Chat</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Group Name</label>
                      <Input
                        placeholder="Enter group name..."
                        value={groupChatName}
                        onChange={(e) => setGroupChatName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Select Members</label>
                      <ScrollArea className="h-48 border rounded-md p-2 mt-1">
                        {staffList.map((staff) => (
                          <div
                            key={staff.staffId}
                            className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                            onClick={() => toggleGroupMember(staff.staffId)}
                          >
                            <Checkbox checked={selectedGroupMembers.includes(staff.staffId)} />
                            <span>{staff.name}</span>
                            <span className="text-xs text-muted-foreground">({staff.department})</span>
                          </div>
                        ))}
                      </ScrollArea>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedGroupMembers.length} selected
                      </p>
                    </div>
                    <Button 
                      onClick={handleCreateGroupChat} 
                      className="w-full"
                      disabled={creatingGroup}
                    >
                      {creatingGroup ? 'Creating...' : 'Create Group'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}
      </SheetContent>

      {/* Image Viewer Dialog */}
      <Dialog open={!!imageViewerUrl} onOpenChange={() => setImageViewerUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Image</DialogTitle>
          </DialogHeader>
          {imageViewerUrl && (
            <img 
              src={imageViewerUrl} 
              alt="Full size" 
              className="max-w-full max-h-[70vh] object-contain mx-auto"
            />
          )}
        </DialogContent>
      </Dialog>
    </Sheet>
  );
});

MessagingPanel.displayName = "MessagingPanel";
