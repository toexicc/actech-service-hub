import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { format } from 'date-fns';

interface NotificationDropdownProps {
  userId: string | null;
}

export const NotificationDropdown = ({ userId }: NotificationDropdownProps) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications(userId);
  const [showPreview, setShowPreview] = useState(false);
  const [previewNotification, setPreviewNotification] = useState<typeof notifications[0] | null>(null);
  const previousUnreadCountRef = useRef(unreadCount);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Show preview when a new notification arrives
  useEffect(() => {
    if (unreadCount > previousUnreadCountRef.current && notifications.length > 0) {
      // Find the newest unread notification
      const newestUnread = notifications.find(n => !n.read);
      if (newestUnread) {
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

  const handlePreviewClick = () => {
    if (previewNotification) {
      markAsRead(previewNotification.id);
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
          className="absolute right-0 top-12 w-80 bg-card border border-border rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-200"
          onClick={handlePreviewClick}
        >
          <div className="flex items-start gap-2 p-3 cursor-pointer hover:bg-accent/50 rounded-lg">
            <span className="text-lg">{getNotificationIcon(previewNotification.type)}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{previewNotification.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{previewNotification.message}</p>
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
        <DropdownMenuContent align="end" className="w-80">
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
          <DropdownMenuSeparator />
          <ScrollArea className="h-[300px]">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">No notifications</div>
            ) : (
              notifications.slice(0, 20).map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={`flex flex-col items-start p-3 cursor-pointer ${
                    !notification.read ? 'bg-accent/50' : ''
                  }`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-2 w-full">
                    <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{notification.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(notification.createdAt), 'MMM d, h:mm a')}
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
