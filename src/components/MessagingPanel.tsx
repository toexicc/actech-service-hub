import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, ArrowLeft, Users, Search, Image, X, Camera, Check, CheckCheck, RotateCcw } from 'lucide-react';
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
import { useMessaging } from '@/hooks/useMessaging';
import { format } from 'date-fns';
import { GOOGLE_SHEETS_SCRIPT_URL } from '@/lib/googleSheets';
import { toast } from 'sonner';

const parseMessageDate = (value: string) => {
  if (!value) return new Date(0);
  if (value.endsWith('Z')) return new Date(value.replace(/Z$/, ''));
  return new Date(value);
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

interface PendingMessage {
  id: string;
  content: string;
  receiverId: string;
  receiverName: string;
  status: 'sending' | 'sent' | 'failed';
  timestamp: Date;
}

export const MessagingPanel = ({ userId, userName }: MessagingPanelProps) => {
  // Get username from session storage for dual-ID lookup
  const username = typeof window !== 'undefined' ? sessionStorage.getItem('username') : null;
  
  const { messages, unreadCount, sendMessage, markAsRead, getConversations, refresh } = useMessaging(userId, username);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getStaffList`);
        const data = await response.json();
        const staffData = data.staff || data.data || [];
        setStaffList(staffData.filter((s: Staff) => s.staffId !== userId && s.username !== username));
      } catch (error) {
        console.error('Error fetching staff:', error);
      }
    };
    fetchStaff();
  }, [userId, username]);

  // Helper to find staff by staffId OR username (for backward compatibility)
  const findStaffById = (id: string) => 
    staffList.find(s => s.staffId === id || s.username === id);

  const conversations = getConversations();
  
  // Filter conversations by search query
  const filteredConversations = conversations.filter(conv => 
    conv.partnerName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Filter staff list by search query
  const filteredStaff = staffList.filter(staff =>
    staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    staff.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Match conversation by staffId or username
  const currentConversation = conversations.find(c => {
    if (c.partnerId === selectedConversation) return true;
    const staff = findStaffById(c.partnerId);
    return staff && (staff.staffId === selectedConversation || staff.username === selectedConversation);
  });

  const handleSend = async () => {
    if ((!newMessage.trim() && !attachedImage) || !selectedConversation || !userName) return;
    
    const partner = findStaffById(selectedConversation) || 
                   conversations.find(c => c.partnerId === selectedConversation);
    const partnerName = partner ? ('name' in partner ? partner.name : partner.partnerName) : 'Unknown';
    
    // Combine text and image
    let messageContent = newMessage.trim();
    if (attachedImage) {
      messageContent = messageContent ? `${messageContent}\n[Image: ${attachedImage}]` : `[Image: ${attachedImage}]`;
    }
    
    // Create pending message for optimistic UI
    const pendingId = `pending-${Date.now()}`;
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
      // Remove from pending and let the hook handle the actual message
      setPendingMessages(prev => prev.filter(m => m.id !== pendingId));
    } else {
      // Mark as failed
      setPendingMessages(prev => 
        prev.map(m => m.id === pendingId ? { ...m, status: 'failed' as const } : m)
      );
      toast.error('Failed to send message');
    }
    setSending(false);
  };

  const retryMessage = async (pendingMsg: PendingMessage) => {
    if (!userName) return;
    
    setPendingMessages(prev => 
      prev.map(m => m.id === pendingMsg.id ? { ...m, status: 'sending' as const } : m)
    );
    
    const success = await sendMessage(pendingMsg.receiverId, pendingMsg.receiverName, userName, pendingMsg.content);
    
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
    // Check if there's already a conversation with this person (by staffId or username)
    const existingConv = conversations.find(c => {
      const convStaff = findStaffById(c.partnerId);
      return convStaff && (convStaff.staffId === staff.staffId);
    });
    
    if (existingConv) {
      // Use the existing conversation's partnerId to maintain consistency
      setSelectedConversation(existingConv.partnerId);
    } else {
      setSelectedConversation(staff.staffId);
    }
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

  const renderMessageContent = (content: string) => {
    // Check if message contains an image
    const imageMatch = content.match(/\[Image: (data:image\/[^;]+;base64,[^\]]+)\]/);
    if (imageMatch) {
      const textContent = content.replace(/\[Image: data:image\/[^;]+;base64,[^\]]+\]/, '').trim();
      return (
        <>
          {textContent && <p className="text-sm mb-2">{textContent}</p>}
          <img 
            src={imageMatch[1]} 
            alt="Attached" 
            className="max-w-full rounded-md max-h-48 object-contain"
          />
        </>
      );
    }
    return <p className="text-sm">{content}</p>;
  };

  // Render message status indicator
  const renderMessageStatus = (msg: any, isOwn: boolean) => {
    if (!isOwn) return null;
    
    const userIds = new Set([userId, username].filter(Boolean));
    const isRead = msg.read;
    const time = format(parseMessageDate(msg.createdAt), 'h:mm a');
    
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

  // Render pending message status
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

  // Get pending messages for current conversation
  const conversationPendingMessages = pendingMessages.filter(
    m => m.receiverId === selectedConversation
  );

  return (
    <Sheet>
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
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            {selectedConversation ? (
              <>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    setSelectedConversation(null);
                    setAttachedImage(null);
                  }}
                  className="h-8 w-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span>{currentConversation?.partnerName || 'Chat'}</span>
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

        {selectedConversation ? (
          // Chat view
          <div className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {currentConversation?.messages
                  .slice()
                  .reverse()
                  .map((msg) => {
                    const userIds = new Set([userId, username].filter(Boolean));
                    const isOwn = userIds.has(msg.senderId);
                    if (!msg.read && userIds.has(msg.receiverId)) {
                      markAsRead(msg.id);
                    }
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 ${
                            isOwn
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          {renderMessageContent(msg.content)}
                          {isOwn ? (
                            renderMessageStatus(msg, isOwn)
                          ) : (
                            <p className="text-xs mt-1 text-muted-foreground">
                              {format(parseMessageDate(msg.createdAt), 'h:mm a')}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                
                {/* Pending messages */}
                {conversationPendingMessages.map((pendingMsg) => (
                  <div key={pendingMsg.id} className="flex justify-end">
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      pendingMsg.status === 'failed' 
                        ? 'bg-destructive/80 text-destructive-foreground' 
                        : 'bg-primary/70 text-primary-foreground'
                    }`}>
                      {renderMessageContent(pendingMsg.content)}
                      {renderPendingStatus(pendingMsg.status, () => retryMessage(pendingMsg))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            {/* Attached image preview */}
            {attachedImage && (
              <div className="px-4 py-2 border-t bg-muted/50">
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
            
            <div className="p-4 border-t flex gap-2">
              {/* Hidden file inputs */}
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
              
              {/* Camera button */}
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => cameraInputRef.current?.click()}
                disabled={sending}
                title="Take photo"
              >
                <Camera className="h-4 w-4" />
              </Button>
              
              {/* Image attachment button */}
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                title="Attach image"
              >
                <Image className="h-4 w-4" />
              </Button>
              
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                disabled={sending}
                className="flex-1"
              />
              <Button onClick={handleSend} disabled={sending || (!newMessage.trim() && !attachedImage)}>
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
                {filteredConversations.length === 0 ? (
                  <p className="text-center text-muted-foreground p-4">
                    {searchQuery ? 'No conversations found' : 'No conversations yet'}
                  </p>
                ) : (
                  filteredConversations.map((conv) => (
                    <button
                      key={conv.partnerId}
                      onClick={() => setSelectedConversation(conv.partnerId)}
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
            <div className="p-4 border-t">
              <Button 
                onClick={() => {
                  setShowNewChat(true);
                  setSearchQuery('');
                }} 
                className="w-full"
                variant="outline"
              >
                <Users className="h-4 w-4 mr-2" />
                New Message
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
