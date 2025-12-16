import { useState, useEffect } from 'react';
import { MessageCircle, Send, ArrowLeft, Users } from 'lucide-react';
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

interface Staff {
  staffId: string;
  name: string;
  department: string;
}

interface MessagingPanelProps {
  userId: string | null;
  userName: string | null;
}

export const MessagingPanel = ({ userId, userName }: MessagingPanelProps) => {
  const { messages, unreadCount, sendMessage, markAsRead, getConversations } = useMessaging(userId);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getStaffList`);
        const data = await response.json();
        const staffData = data.staff || data.data || [];
        setStaffList(staffData.filter((s: Staff) => s.staffId !== userId));
      } catch (error) {
        console.error('Error fetching staff:', error);
      }
    };
    fetchStaff();
  }, [userId]);

  const conversations = getConversations();
  const currentConversation = conversations.find(c => c.partnerId === selectedConversation);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConversation || !userName) return;
    
    setSending(true);
    const partner = staffList.find(s => s.staffId === selectedConversation) || 
                   conversations.find(c => c.partnerId === selectedConversation);
    const partnerName = partner ? ('name' in partner ? partner.name : partner.partnerName) : 'Unknown';
    
    const success = await sendMessage(selectedConversation, partnerName, userName, newMessage.trim());
    if (success) {
      setNewMessage('');
    }
    setSending(false);
  };

  const startNewChat = (staff: Staff) => {
    setSelectedConversation(staff.staffId);
    setShowNewChat(false);
  };

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
                  onClick={() => setSelectedConversation(null)}
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
                  onClick={() => setShowNewChat(false)}
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
                    const isOwn = msg.senderId === userId;
                    if (!msg.read && msg.receiverId === userId) {
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
                          <p className="text-sm">{msg.content}</p>
                          <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {format(new Date(msg.createdAt), 'h:mm a')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </ScrollArea>
            <div className="p-4 border-t flex gap-2">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                disabled={sending}
              />
              <Button onClick={handleSend} disabled={sending || !newMessage.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : showNewChat ? (
          // Staff list for new chat
          <ScrollArea className="flex-1">
            <div className="p-2">
              {staffList.length === 0 ? (
                <p className="text-center text-muted-foreground p-4">No staff available</p>
              ) : (
                staffList.map((staff) => (
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
        ) : (
          // Conversations list
          <div className="flex-1 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-2">
                {conversations.length === 0 ? (
                  <p className="text-center text-muted-foreground p-4">No conversations yet</p>
                ) : (
                  conversations.map((conv) => (
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
                          {conv.lastMessage.content}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(conv.lastMessage.createdAt), 'MMM d')}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="p-4 border-t">
              <Button 
                onClick={() => setShowNewChat(true)} 
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
