import React, { useState, useEffect } from 'react';
import { Bell, AlertCircle, Calendar, Settings, MessageCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { formatDistance } from 'date-fns';

interface Notification {
  id: string;
  type: 'rent' | 'maintenance' | 'tenant' | 'system' | 'message';
  message: string;
  created_at: string;
  read: boolean;
  link?: string;
}

export default function NotificationDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10) as unknown as { data: Notification[] | null; error: any };

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.read).length);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      toast({
        title: "Error fetching notifications",
        description: error.message || "There was an error fetching notifications",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'rent': return <AlertCircle className="mr-2 h-4 w-4 text-amber-500" />;
      case 'maintenance': return <Settings className="mr-2 h-4 w-4 text-blue-500" />;
      case 'tenant': return <Calendar className="mr-2 h-4 w-4 text-green-500" />;
      case 'message': return <MessageCircle className="mr-2 h-4 w-4 text-purple-500" />;
      case 'system': return <Bell className="mr-2 h-4 w-4 text-gray-500" />;
      default: return null;
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notification.id) as unknown as { data: any; error: any };

        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    if (notification.link) {
      navigate(notification.link);
    } else {
      switch (notification.type) {
        case 'rent':
          navigate('/rent');
          break;
        case 'maintenance':
          navigate('/settings');
          break;
        case 'tenant':
          navigate('/tenants');
          break;
        case 'system':
        case 'message':
          navigate('/settings');
          break;
      }
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
      toast({
        title: 'Notification deleted',
        description: 'The notification has been removed.',
      });
    } catch (error: any) {
      console.error('Error deleting notification:', error);
      toast({
        title: 'Error',
        description: 'Could not delete notification',
        variant: 'destructive',
      });
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false) as unknown as { error: any };

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);

      toast({
        title: "Notifications",
        description: "All notifications marked as read"
      });
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
      toast({
        title: "Error",
        description: "Could not mark notifications as read",
        variant: "destructive"
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-h-[500px] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <DropdownMenuLabel className="text-lg font-semibold">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-sm text-blue-600"
            >
              Mark all read
            </Button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No notifications
          </div>
        ) : (
          notifications.map(notification => (
            <DropdownMenuItem
              key={notification.id}
              className={`cursor-pointer hover:bg-gray-100 ${!notification.read ? 'bg-blue-50' : ''} group`}
            >
              <div
                className="flex items-start justify-between w-full gap-2"
                onClick={() => handleNotificationClick(notification)}
              >
                {getNotificationIcon(notification.type)}
                <div className="flex-grow">
                  <p className="text-sm font-medium">{notification.message}</p>
                  <p className="text-xs text-gray-500">
                    {formatDistance(new Date(notification.created_at), new Date(), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notification.id);
                  }}
                  className="invisible group-hover:visible text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
