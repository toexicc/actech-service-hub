import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

const NotificationDropdown = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    setOpen(false);
    
    // Navigate based on notification type
    if (notification.serviceId) {
      navigate(`/manage-client?serviceId=${notification.serviceId}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "status_change":
        return "🔄";
      case "assignment":
        return "👤";
      case "update":
        return "📝";
      case "message":
        return "💬";
      default:
        return "🔔";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y">
              {notifications.slice(0, 50).map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "w-full p-4 text-left hover:bg-muted/50 transition-colors",
                    !notification.isRead && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm line-clamp-2",
                        !notification.isRead && "font-medium"
                      )}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationDropdown;
