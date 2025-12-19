import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, X, Wrench, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useNotifications } from '@/hooks/useNotifications';
interface NotificationDropdownProps {
  userId: string | null;
  userRole?: string;
  onOpenMessaging?: (conversationId?: string) => void;
}

// Format date to local time - simple display without timezone suffix
const formatLocalTime = (dateString: string) => {
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString;
    }

    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return dateString;
  }
};

export const NotificationDropdown = ({ userId, userRole, onOpenMessaging }: NotificationDropdownProps) => {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications(userId);
  const [activeTab, setActiveTab] = useState<'services' | 'messages'>('services');
  const [showPreview, setShowPreview] = useState(false);
  const [previewNotification, setPreviewNotification] = useState<typeof notifications[0] | null>(null);
  const previousUnreadCountRef = useRef(unreadCount);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Show preview immediately when a new notification arrives
  useEffect(() => {
    if (unreadCount > previousUnreadCountRef.current && notifications.length > 0) {
      // Find the newest unread notification
      const newestUnread = notifications.find(n => !n.read);
      if (newestUnread) {
        // Show immediately without delay
        setPreviewNotification(newestUnread);
        setShowPreview(true);
        
        // Auto-hide preview after 5 seconds
        if (previewTimeoutRef.current) {
          clearTimeout(previewTimeoutRef.current);
        }
        previewTimeoutRef.current = setTimeout(() => {
          setShowPreview(false);
        }, 5000);
      }
    }
    previousUnreadCountRef.current = unreadCount;
  }, [unreadCount, notifications]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, []);

  const handleDismissPreview = () => {
    setShowPreview(false);
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
  };

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    // Mark as read
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Navigate based on notification type and user role
    if (notification.type === 'service_update' || notification.type === 'new_inquiry') {
      const serviceId = notification.serviceId;
      if (serviceId) {
        const isAdmin = userRole === 'admin' || userRole === 'management';
        if (isAdmin) {
          // ManageClient auto-loads using ?serviceId=
          navigate(`/manage-client?serviceId=${encodeURIComponent(serviceId)}`);
        } else {
          // ServiceUpdate will auto-load using ?serviceId=
          navigate(`/service-update?serviceId=${encodeURIComponent(serviceId)}`);
        }
      }
    } else if (notification.type === 'message') {
      // For message notifications, open messaging panel
      onOpenMessaging?.();
    }
  };

  const handlePreviewClick = () => {
    if (previewNotification) {
      handleNotificationClick(previewNotification);
    }
    setShowPreview(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'service_update':
        return '🔧';
      case 'new_inquiry':
        return '📋';
      case 'message':
        return '💬';
      default:
        return '🔔';
    }
  };

  return (
    <div className="relative">
      {/* Notification Preview Popup */}
      {showPreview && previewNotification && (
        <div 
          className="absolute right-0 top-12 w-96 bg-card border border-border rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-100"
          onClick={handlePreviewClick}
        >
          <div className="flex items-start gap-2 p-3 cursor-pointer hover:bg-accent/50 rounded-lg">
            <span className="text-lg">{getNotificationIcon(previewNotification.type)}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{previewNotification.title}</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{previewNotification.message}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                handleDismissPreview();
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-96">
          <div className="flex items-center justify-between px-3 py-2">
            <h4 className="font-semibold">Notifications</h4>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                className="h-8 text-xs"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'services' | 'messages')} className="w-full">
            <TabsList className="w-full grid grid-cols-2 h-9">
              <TabsTrigger value="services" className="text-xs flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" />
                Services
                {notifications.filter(n => (n.type === 'service_update' || n.type === 'new_inquiry') && !n.read).length > 0 && (
                  <span className="ml-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
                    {notifications.filter(n => (n.type === 'service_update' || n.type === 'new_inquiry') && !n.read).length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="messages" className="text-xs flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" />
                Messages
                {notifications.filter(n => n.type === 'message' && !n.read).length > 0 && (
                  <span className="ml-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
                    {notifications.filter(n => n.type === 'message' && !n.read).length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="services" className="mt-0">
              <ScrollArea className="h-[350px]">
                {loading ? (
                  <div className="p-4 text-center text-muted-foreground">Loading...</div>
                ) : notifications.filter(n => n.type === 'service_update' || n.type === 'new_inquiry').length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">No service notifications</div>
                ) : (
                  notifications
                    .filter(n => n.type === 'service_update' || n.type === 'new_inquiry')
                    .slice(0, 20)
                    .map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className={`flex flex-col items-start p-3 cursor-pointer ${
                          !notification.read ? 'bg-accent/50' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start gap-2 w-full">
                          <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{notification.title}</p>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{notification.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatLocalTime(notification.createdAt)}
                            </p>
                          </div>
                          {!notification.read && (
                            <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="messages" className="mt-0">
              <ScrollArea className="h-[350px]">
                {loading ? (
                  <div className="p-4 text-center text-muted-foreground">Loading...</div>
                ) : notifications.filter(n => n.type === 'message').length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">No message notifications</div>
                ) : (
                  notifications
                    .filter(n => n.type === 'message')
                    .slice(0, 20)
                    .map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className={`flex flex-col items-start p-3 cursor-pointer ${
                          !notification.read ? 'bg-accent/50' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start gap-2 w-full">
                          <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{notification.title}</p>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{notification.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatLocalTime(notification.createdAt)}
                            </p>
                          </div>
                          {!notification.read && (
                            <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
