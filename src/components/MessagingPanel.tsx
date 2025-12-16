import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useMessaging } from "@/hooks/useMessaging";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface MessagingPanelProps {
  trigger?: React.ReactNode;
}

const MessagingPanel = ({ trigger }: MessagingPanelProps) => {
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    conversations,
    staffList,
    totalUnreadCount,
    getMessagesWithUser,
    sendMessage,
    markConversationAsRead,
  } = useMessaging();

  const currentUserId = sessionStorage.getItem("userFullName") || "";
  const currentMessages = selectedUser ? getMessagesWithUser(selectedUser.id) : [];

  useEffect(() => {
    if (selectedUser) {
      markConversationAsRead(selectedUser.id);
    }
  }, [selectedUser, markConversationAsRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;

    try {
      await sendMessage(selectedUser.id, selectedUser.name, newMessage.trim());
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    if (isToday(date)) {
      return format(date, "h:mm a");
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, "h:mm a")}`;
    }
    return format(date, "MMM d, h:mm a");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const availableStaff = staffList.filter((s) => s.name !== currentUserId);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="relative">
            <MessageSquare className="h-5 w-5" />
            {totalUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
                {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
              </span>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          {selectedUser ? (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedUser(null)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-8 w-8">
                <AvatarFallback>{getInitials(selectedUser.name)}</AvatarFallback>
              </Avatar>
              <SheetTitle className="text-left">{selectedUser.name}</SheetTitle>
            </div>
          ) : (
            <SheetTitle>Messages</SheetTitle>
          )}
        </SheetHeader>

        {selectedUser ? (
          <>
            {/* Chat Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {currentMessages.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  currentMessages.map((msg) => {
                    const isMine = msg.senderId === currentUserId;
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          isMine ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-2xl px-4 py-2",
                            isMine
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                          <p
                            className={cn(
                              "text-xs mt-1",
                              isMine
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            )}
                          >
                            {formatMessageTime(msg.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Conversations List */}
            <ScrollArea className="flex-1">
              {conversations.length === 0 && availableStaff.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No conversations yet
                </div>
              ) : (
                <div className="divide-y">
                  {/* Existing Conversations */}
                  {conversations.map((conv) => (
                    <button
                      key={conv.oderId}
                      onClick={() =>
                        setSelectedUser({ id: conv.oderId, name: conv.otherUserName })
                      }
                      className="w-full p-4 text-left hover:bg-muted/50 transition-colors flex items-center gap-3"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {getInitials(conv.otherUserName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm truncate">
                            {conv.otherUserName}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(conv.lastTimestamp, {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.lastMessage}
                        </p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </button>
                  ))}

                  {/* New Conversation Section */}
                  {availableStaff.length > 0 && (
                    <>
                      <div className="p-3 bg-muted/30">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>Start New Conversation</span>
                        </div>
                      </div>
                      {availableStaff
                        .filter(
                          (staff) =>
                            !conversations.some((c) => c.oderId === staff.name)
                        )
                        .map((staff) => (
                          <button
                            key={staff.id}
                            onClick={() =>
                              setSelectedUser({ id: staff.name, name: staff.name })
                            }
                            className="w-full p-4 text-left hover:bg-muted/50 transition-colors flex items-center gap-3"
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarFallback>
                                {getInitials(staff.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{staff.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {staff.role}
                              </p>
                            </div>
                          </button>
                        ))}
                    </>
                  )}
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default MessagingPanel;
