import { useState, useEffect, useMemo, useCallback } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  X,
  CalendarIcon,
  Users,
  Tag,
  Filter,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Clock,
  BellRing,
  Home,
  DollarSign,
  Wrench,
  FileText,
  Trash2,
  Edit,
  MoreHorizontal,
  Bell,
  Sun,
  Moon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

const localizer = momentLocalizer(moment);

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  all_day: boolean;
  flat_id?: string;
  tenant_id?: string;
  related_table?: string;
  related_id?: string;
  color?: string;
  recurrence?: string;
  notification_before?: number;
  created_at?: string;
  created_by?: string;
  flats?: { id: string; name: string } | null;
  tenants?: { id: string; name: string } | null;
}

interface Flat {
  id: string;
  name: string;
  address?: string;
}

interface Tenant {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface Settings {
  company_name?: string;
  default_currency?: string;
  rent_due_day?: number;
  grace_period?: number;
  late_fee_percentage?: number;
  notice_period?: number;
  security_deposit?: number;
  maintenance_budget?: number;
  lease_template?: string;
  default_notification_before?: number;
}

const EVENT_TYPES = [
  { value: "rents", label: "Rent Payments", icon: <DollarSign className="h-4 w-4" />, color: "#ef4444" },
  { value: "expenses", label: "Expenses", icon: <DollarSign className="h-4 w-4" />, color: "#f59e0b" },
  { value: "estimates", label: "Estimates", icon: <FileText className="h-4 w-4" />, color: "#3b82f6" },
  { value: "maintenance_requests", label: "Maintenance", icon: <Wrench className="h-4 w-4" />, color: "#10b981" },
  { value: "reminders", label: "Reminders", icon: <BellRing className="h-4 w-4" />, color: "#8b5cf6" },
  { value: "general", label: "General", icon: <CalendarIcon className="h-4 w-4" />, color: "#6b7280" },
];

const RECURRENCE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const NOTIFICATION_OPTIONS = [
  { value: 0, label: "No notification" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 1440, label: "1 day before" },
  { value: 10080, label: "1 week before" },
];

const CustomToolbar = ({ onNavigate, onView, view, label }) => (
  <div className="flex flex-col sm:flex-row justify-between items-center mb-4 p-4 bg-luxury-cream rounded-lg shadow-sm dark:bg-gray-800">
    <div className="flex items-center gap-2 mb-2 sm:mb-0">
      <Button
        variant="outline"
        onClick={() => onNavigate("TODAY")}
        className="text-luxury-charcoal hover:bg-luxury-gold/10 dark:text-gray-200 dark:border-gray-600"
        aria-label="Go to today"
      >
        Today
      </Button>
      <Button
        variant="outline"
        onClick={() => onNavigate("PREV")}
        className="text-luxury-charcoal hover:bg-luxury-gold/10 dark:text-gray-200 dark:border-gray-600"
        aria-label="Previous period"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        onClick={() => onNavigate("NEXT")}
        className="text-luxury-charcoal hover:bg-luxury-gold/10 dark:text-gray-200 dark:border-gray-600"
        aria-label="Next period"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <span className="text-lg font-semibold text-luxury-charcoal dark:text-gray-200">{label}</span>
    </div>
    <Tabs value={view} onValueChange={onView} className="w-auto">
      <TabsList className="bg-luxury-softwhite dark:bg-gray-700">
        <TabsTrigger value="month" className="dark:text-gray-200">Month</TabsTrigger>
        <TabsTrigger value="week" className="dark:text-gray-200">Week</TabsTrigger>
        <TabsTrigger value="day" className="dark:text-gray-200">Day</TabsTrigger>
        <TabsTrigger value="agenda" className="dark:text-gray-200">Agenda</TabsTrigger>
      </TabsList>
    </Tabs>
  </div>
);

export default function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [filters, setFilters] = useState({
    flat_id: "all",
    tenant_id: "all",
    related_table: "all",
    start_date: "",
    end_date: "",
  });
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [relatedData, setRelatedData] = useState<any>(null);
  const [isNewEventOpen, setIsNewEventOpen] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
    title: "",
    description: "",
    start_date: moment().format("YYYY-MM-DDTHH:mm"),
    end_date: moment().add(1, "hour").format("YYYY-MM-DDTHH:mm"),
    all_day: false,
    flat_id: "",
    tenant_id: "",
    related_table: "general",
    recurrence: "none",
    notification_before: 60,
  });
  const [view, setView] = useState<"month" | "week" | "day" | "agenda">("month");
  const [showFilters, setShowFilters] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [stats, setStats] = useState({
    upcomingRents: 0,
    pendingMaintenance: 0,
    upcomingReminders: 0,
    totalEvents: 0,
    eventsToday: 0,
  });

  const fetchFlats = async () => {
    const { data, error } = await supabase.from("flats").select("id, name, address");
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setFlats(data || []);
    }
  };

  const fetchTenants = async () => {
    const { data, error } = await supabase.from("tenants").select("id, name, phone, email");
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setTenants(data || []);
    }
  };

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("settings")
      .select(`
        company_name,
        default_currency,
        rent_due_day,
        grace_period,
        late_fee_percentage,
        notice_period,
        security_deposit,
        maintenance_budget,
        lease_template,
        default_notification_before
      `)
      .single();
    if (error) {
      toast({ title: "Error fetching settings", description: error.message, variant: "destructive" });
      setSettings({
        company_name: "Default Company",
        default_currency: "USD",
        rent_due_day: 1,
        grace_period: 7,
        late_fee_percentage: 5.0,
        notice_period: 30,
        security_deposit: 1000,
        maintenance_budget: 5000.00,
        lease_template: "Standard Lease Agreement",
        default_notification_before: 60,
      }); // Fallback
    } else {
      setSettings(data || {});
      setNewEvent((prev) => ({
        ...prev,
        notification_before: data?.default_notification_before || 60,
      }));
    }
  };

  const fetchNotifications = async (eventId: string) => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, message, read, created_at")
      .eq("reminder_id", eventId);
    if (error) {
      toast({ title: "Error fetching notifications", description: error.message, variant: "destructive" });
    } else {
      setNotifications(data || []);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    let query = supabase
      .from("calendar_events")
      .select(`
        *,
        flats!fk_calendar_events_flat_id (id, name),
        tenants!fk_calendar_events_tenant_id (id, name)
      `);

    if (filters.flat_id !== "all") query = query.eq("flat_id", filters.flat_id);
    if (filters.tenant_id !== "all") query = query.eq("tenant_id", filters.tenant_id);
    if (filters.related_table !== "all") query = query.eq("related_table", filters.related_table);
    if (filters.start_date) query = query.gte("start_date", filters.start_date);
    if (filters.end_date) query = query.lte("end_date", filters.end_date);

    const { data, error } = await query;

    if (error) {
      toast({ title: "Error fetching events", description: error.message, variant: "destructive" });
    } else {
      setEvents(data || []);
    }
    setLoading(false);
  };

  const fetchRelatedData = async (event: CalendarEvent) => {
    if (!event.related_table || !event.related_id) return null;
    const { data, error } = await supabase
      .from(event.related_table)
      .select("*")
      .eq("id", event.related_id)
      .single();
    if (error) {
      toast({ title: "Error fetching related data", description: error.message, variant: "destructive" });
      return null;
    }
    return data;
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    const today = moment().format("YYYY-MM-DD");
    const nextMonth = moment().add(1, "month").format("YYYY-MM-DD");

    const { data: upcomingRents } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("related_table", "rents")
      .gte("start_date", today)
      .lte("start_date", nextMonth);

    const { data: pendingMaintenance } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("related_table", "maintenance_requests")
      .gte("start_date", today);

    const { data: upcomingReminders } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("related_table", "reminders")
      .gte("start_date", today)
      .lte("start_date", nextMonth);

    const { data: eventsToday } = await supabase
      .from("calendar_events")
      .select("id")
      .gte("start_date", `${today}T00:00:00`)
      .lte("start_date", `${today}T23:59:59`);

    setStats({
      upcomingRents: upcomingRents?.length || 0,
      pendingMaintenance: pendingMaintenance?.length || 0,
      upcomingReminders: upcomingReminders?.length || 0,
      totalEvents: events.length,
      eventsToday: eventsToday?.length || 0,
    });

    setStatsLoading(false);
  };

  useEffect(() => {
    fetchFlats();
    fetchTenants();
    fetchSettings();
    fetchEvents();
  }, [filters]);

  useEffect(() => {
    if (!loading) {
      fetchStats();
    }
  }, [loading, events]);

  useEffect(() => {
    if (selectedEvent && selectedEvent.id) {
      fetchRelatedData(selectedEvent).then((data) => {
        setRelatedData(data);
      });
      fetchNotifications(selectedEvent.id);
    } else {
      setRelatedData(null);
      setNotifications([]);
    }
  }, [selectedEvent]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      flat_id: "all",
      tenant_id: "all",
      related_table: "all",
      start_date: "",
      end_date: "",
    });
  };

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.start_date) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const eventData = {
      ...newEvent,
      end_date: newEvent.all_day ? null : newEvent.end_date,
      color: EVENT_TYPES.find((type) => type.value === newEvent.related_table)?.color,
    };

    const { data, error } = await supabase
      .from("calendar_events")
      .insert([eventData])
      .select();

    if (error) {
      toast({
        title: "Error creating event",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Event created",
        description: "Your event has been created successfully",
      });
      fetchEvents();
      setIsNewEventOpen(false);
      setNewEvent({
        title: "",
        description: "",
        start_date: moment().format("YYYY-MM-DDTHH:mm"),
        end_date: moment().add(1, "hour").format("YYYY-MM-DDTHH:mm"),
        all_day: false,
        flat_id: "",
        tenant_id: "",
        related_table: "general",
        recurrence: "none",
        notification_before: settings.default_notification_before || 60,
      });
    }

    setLoading(false);
  };

  const handleUpdateEvent = async () => {
    if (!selectedEvent || !selectedEvent.id) return;

    setLoading(true);

    const { error } = await supabase
      .from("calendar_events")
      .update({
        title: selectedEvent.title,
        description: selectedEvent.description,
        start_date: selectedEvent.start_date,
        end_date: selectedEvent.all_day ? null : selectedEvent.end_date,
        all_day: selectedEvent.all_day,
        flat_id: selectedEvent.flat_id,
        tenant_id: selectedEvent.tenant_id,
        related_table: selectedEvent.related_table,
        recurrence: selectedEvent.recurrence,
        notification_before: selectedEvent.notification_before,
        color: EVENT_TYPES.find((type) => type.value === selectedEvent.related_table)?.color,
      })
      .eq("id", selectedEvent.id);

    if (error) {
      toast({
        title: "Error updating event",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Event updated",
        description: "Your event has been updated successfully",
      });
      fetchEvents();
      setSelectedEvent(null);
      setIsEditing(false);
    }

    setLoading(false);
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent || !selectedEvent.id) return;

    setLoading(true);

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", selectedEvent.id);

    if (error) {
      toast({
        title: "Error deleting event",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Event deleted",
        description: "Your event has been deleted successfully",
      });
      fetchEvents();
      setSelectedEvent(null);
      setConfirmDelete(false);
    }

    setLoading(false);
  };

  const handleNavigate = (action: "PREV" | "NEXT" | "TODAY") => {
    const newDate = new Date(currentDate);

    if (action === "PREV") {
      if (view === "month") newDate.setMonth(newDate.getMonth() - 1);
      else if (view === "week") newDate.setDate(newDate.getDate() - 7);
      else if (view === "day") newDate.setDate(newDate.getDate() - 1);
      else if (view === "agenda") newDate.setDate(newDate.getDate() - 30);
    } else if (action === "NEXT") {
      if (view === "month") newDate.setMonth(newDate.getMonth() + 1);
      else if (view === "week") newDate.setDate(newDate.getDate() + 7);
      else if (view === "day") newDate.setDate(newDate.getDate() + 1);
      else if (view === "agenda") newDate.setDate(newDate.getDate() + 30);
    } else if (action === "TODAY") {
      return setCurrentDate(new Date());
    }

    setCurrentDate(newDate);
  };

  const eventStyleGetter = useCallback((event: any) => {
    const backgroundColor = EVENT_TYPES.find((type) => type.value === event.resource.related_table)?.color || "#6b7280";
    const style = {
      backgroundColor,
      borderRadius: "4px",
      opacity: 0.8,
      color: "white",
      border: "0px",
      display: "block",
      padding: "4px 8px",
    };
    return { style };
  }, []);

  const getEventTypeIcon = (type: string) => {
    const eventType = EVENT_TYPES.find((t) => t.value === type);
    return eventType?.icon || <CalendarIcon className="h-4 w-4" />;
  };

  const calendarEvents = useMemo(() => {
    return events.map((event) => ({
      id: event.id,
      title: event.title,
      start: new Date(event.start_date),
      end: event.end_date ? new Date(event.end_date) : new Date(event.start_date),
      allDay: event.all_day,
      resource: {
        ...event,
        flat_name: event.flats?.name || "Unknown",
        tenant_name: event.tenants?.name || "Unknown",
      },
    }));
  }, [events]);

  const groupedEvents = useMemo(() => {
    const groups: { [key: string]: typeof calendarEvents } = {};

    calendarEvents.forEach((event) => {
      const dateKey = moment(event.start).format("YYYY-MM-DD");
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });

    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        return new Date(a.start).getTime() - new Date(b.start).getTime();
      });
    });

    return groups;
  }, [calendarEvents]);

  const sortedDates = useMemo(() => {
    return Object.keys(groupedEvents).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });
  }, [groupedEvents]);

  return (
    <TooltipProvider>
      <div className={`min-h-screen bg-gradient-to-br from-luxury-softwhite to-luxury-cream/50 p-4 sm:p-6 dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 ${theme === "dark" ? "dark" : ""}`}>
        <div className="flex justify-end mb-4">
          <Switch
            checked={theme === "dark"}
            onCheckedChange={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center"
            aria-label="Toggle dark mode"
          >
            {theme === "dark" ? (
              <Moon className="h-4 w-4 text-luxury-charcoal dark:text-gray-200" />
            ) : (
              <Sun className="h-4 w-4 text-luxury-charcoal dark:text-gray-200" />
            )}
          </Switch>
        </div>
        <Card className="bg-white dark:bg-gray-800 shadow-md rounded-xl border-luxury-cream/20 dark:border-gray-700 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite py-6 dark:bg-gradient-to-r dark:from-gray-700 dark:to-gray-800">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <CardTitle className="text-2xl font-bold text-luxury-charcoal dark:text-gray-200 tracking-tight flex items-center gap-2">
                <CalendarIcon className="h-6 w-6 text-luxury-gold" />
                Event Calendar
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-1 text-luxury-charcoal hover:text-luxury-gold dark:text-gray-200 dark:hover:text-luxury-gold transition-colors"
                  aria-label={showFilters ? "Hide filters" : "Show filters"}
                >
                  <Filter className="h-4 w-4" />
                  {showFilters ? "Hide Filters" : "Show Filters"}
                </Button>
                <Dialog open={isNewEventOpen} onOpenChange={setIsNewEventOpen}>
                  <DialogTrigger asChild>
                    <Button
                      className="bg-luxury-gold hover:bg-luxury-gold/90 text-white"
                      size="sm"
                      aria-label="Create new event"
                    >
                      <PlusCircle className="h-4 w-4 mr-1" /> New Event
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-semibold dark:text-gray-200">Create New Event</DialogTitle>
                      <DialogDescription className="dark:text-gray-400">
                        Add a new event to your calendar. Fill in the details below.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <Card className="p-4 bg-luxury-cream/50 dark:bg-gray-700/50">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="eventType" className="text-right dark:text-gray-200">Event Type*</Label>
                          <div className="col-span-3">
                            <Select
                              value={newEvent.related_table}
                              onValueChange={(value) => setNewEvent({ ...newEvent, related_table: value })}
                            >
                              <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                                <SelectValue placeholder="Select event type" />
                              </SelectTrigger>
                              <SelectContent className="dark:bg-gray-700 dark:text-gray-200">
                                {EVENT_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    <div className="flex items-center gap-2">
                                      {type.icon}
                                      <span>{type.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4 mt-4">
                          <Label htmlFor="title" className="text-right dark:text-gray-200">Title*</Label>
                          <Input
                            id="title"
                            value={newEvent.title}
                            onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                            className="col-span-3 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4 mt-4">
                          <Label htmlFor="description" className="text-right dark:text-gray-200">Description</Label>
                          <Textarea
                            id="description"
                            value={newEvent.description}
                            onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                            className="col-span-3 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                            rows={3}
                          />
                        </div>
                      </Card>
                      <Card className="p-4 bg-luxury-cream/50 dark:bg-gray-700/50">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <div className="text-right dark:text-gray-200">All Day</div>
                          <div className="col-span-3">
                            <Switch
                              checked={newEvent.all_day}
                              onCheckedChange={(checked) => setNewEvent({ ...newEvent, all_day: checked })}
                              aria-label="Toggle all day event"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4 mt-4">
                          <Label htmlFor="startDate" className="text-right dark:text-gray-200">Start*</Label>
                          <Input
                            id="startDate"
                            type={newEvent.all_day ? "date" : "datetime-local"}
                            value={newEvent.start_date}
                            onChange={(e) => setNewEvent({ ...newEvent, start_date: e.target.value })}
                            className="col-span-3 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                          />
                        </div>
                        {!newEvent.all_day && (
                          <div className="grid grid-cols-4 items-center gap-4 mt-4">
                            <Label htmlFor="endDate" className="text-right dark:text-gray-200">End</Label>
                            <Input
                              id="endDate"
                              type="datetime-local"
                              value={newEvent.end_date}
                              onChange={(e) => setNewEvent({ ...newEvent, end_date: e.target.value })}
                              className="col-span-3 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                            />
                          </div>
                        )}
                      </Card>
                      <Card className="p-4 bg-luxury-cream/50 dark:bg-gray-700/50">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="flat" className="text-right dark:text-gray-200">Flat</Label>
                          <div className="col-span-3">
                            <Select
                              value={newEvent.flat_id}
                              onValueChange={(value) => setNewEvent({ ...newEvent, flat_id: value })}
                            >
                              <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                                <SelectValue placeholder="Select flat" />
                              </SelectTrigger>
                              <SelectContent className="dark:bg-gray-700 dark:text-gray-200">
                                <SelectItem value="">None</SelectItem>
                                {flats.map((flat) => (
                                  <SelectItem key={flat.id} value={flat.id}>
                                    {flat.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4 mt-4">
                          <Label htmlFor="tenant" className="text-right dark:text-gray-200">Tenant</Label>
                          <div className="col-span-3">
                            <Select
                              value={newEvent.tenant_id}
                              onValueChange={(value) => setNewEvent({ ...newEvent, tenant_id: value })}
                            >
                              <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                                <SelectValue placeholder="Select tenant" />
                              </SelectTrigger>
                              <SelectContent className="dark:bg-gray-700 dark:text-gray-200">
                                <SelectItem value="">None</SelectItem>
                                {tenants.map((tenant) => (
                                  <SelectItem key={tenant.id} value={tenant.id}>
                                    {tenant.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-4 bg-luxury-cream/50 dark:bg-gray-700/50">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="recurrence" className="text-right dark:text-gray-200">Recurrence</Label>
                          <div className="col-span-3">
                            <Select
                              value={newEvent.recurrence}
                              onValueChange={(value) => setNewEvent({ ...newEvent, recurrence: value })}
                            >
                              <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                                <SelectValue placeholder="Select recurrence" />
                              </SelectTrigger>
                              <SelectContent className="dark:bg-gray-700 dark:text-gray-200">
                                {RECURRENCE_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4 mt-4">
                          <Label htmlFor="notification" className="text-right dark:text-gray-200">Notification</Label>
                          <div className="col-span-3">
                            <Select
                              value={String(newEvent.notification_before)}
                              onValueChange={(value) =>
                                setNewEvent({ ...newEvent, notification_before: Number(value) })
                              }
                            >
                              <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                                <SelectValue placeholder="Select notification time" />
                              </SelectTrigger>
                              <SelectContent className="dark:bg-gray-700 dark:text-gray-200">
                                {NOTIFICATION_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={String(option.value)}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </Card>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsNewEventOpen(false)}
                        className="dark:border-gray-600 dark:text-gray-200"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateEvent}
                        disabled={loading}
                        className="bg-luxury-gold hover:bg-luxury-gold/90 text-white"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Create Event
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {[
                { key: "upcomingRents", label: "Upcoming Rents", icon: <DollarSign className="h-5 w-5 text-red-500" />, bg: "bg-red-100" },
                { key: "pendingMaintenance", label: "Pending Maintenance", icon: <Wrench className="h-5 w-5 text-green-500" />, bg: "bg-green-100" },
                { key: "upcomingReminders", label: "Active Reminders", icon: <BellRing className="h-5 w-5 text-purple-500" />, bg: "bg-purple-100" },
                { key: "totalEvents", label: "Total Events", icon: <CalendarIcon className="h-5 w-5 text-blue-500" />, bg: "bg-blue-100" },
                { key: "eventsToday", label: "Events Today", icon: <Clock className="h-5 w-5 text-yellow-500" />, bg: "bg-yellow-100" },
              ].map(({ key, label, icon, bg }, index) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="bg-luxury-softwhite dark:bg-gray-700 border-luxury-cream dark:border-gray-600 rounded-lg hover:shadow-lg transition-shadow"
                >
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <div className={`rounded-full ${bg} p-2 mb-2`}>{icon}</div>
                    <div className="text-2xl font-bold dark:text-gray-200">
                      {statsLoading ? <Skeleton width={40} /> : stats[key]}
                    </div>
                    <div className="text-xs text-luxury-charcoal/70 dark:text-gray-400">{label}</div>
                  </CardContent>
                </motion.div>
              ))}
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mb-6 bg-luxury-cream/50 dark:bg-gray-700/50 p-4 rounded-lg shadow-inner"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                      <Label className="text-luxury-charcoal dark:text-gray-200">Flat</Label>
                      <Select value={filters.flat_id} onValueChange={(value) => handleFilterChange("flat_id", value)}>
                        <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                          <SelectValue placeholder="Select flat" />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-700 dark:text-gray-200">
                          <SelectItem value="all">All Flats</SelectItem>
                          {flats.map((flat) => (
                            <SelectItem key={flat.id} value={flat.id}>{flat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-luxury-charcoal dark:text-gray-200">Tenant</Label>
                      <Select value={filters.tenant_id} onValueChange={(value) => handleFilterChange("tenant_id", value)}>
                        <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                          <SelectValue placeholder="Select tenant" />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-700 dark:text-gray-200">
                          <SelectItem value="all">All Tenants</SelectItem>
                          {tenants.map((tenant) => (
                            <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-luxury-charcoal dark:text-gray-200">Event Type</Label>
                      <Select
                        value={filters.related_table}
                        onValueChange={(value) => handleFilterChange("related_table", value)}
                      >
                        <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                          <SelectValue placeholder="Select event type" />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-700 dark:text-gray-200">
                          <SelectItem value="all">All Types</SelectItem>
                          {EVENT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                {type.icon}
                                {type.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-luxury-charcoal dark:text-gray-200">Start Date</Label>
                      <Input
                        type="date"
                        value={filters.start_date}
                        onChange={(e) => handleFilterChange("start_date", e.target.value)}
                        className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                      />
                    </div>
                    <div>
                      <Label className="text-luxury-charcoal dark:text-gray-200">End Date</Label>
                      <Input
                        type="date"
                        value={filters.end_date}
                        onChange={(e) => handleFilterChange("end_date", e.target.value)}
                        className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button
                      variant="ghost"
                      onClick={resetFilters}
                      className="text-luxury-charcoal hover:bg-luxury-gold/10 dark:text-gray-200 dark:hover:bg-luxury-gold/20 rounded-full"
                      aria-label="Reset filters"
                    >
                      <RefreshCcw className="h-4 w-4 mr-1" /> Reset Filters
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {loading ? (
              <Skeleton height={600} className="rounded-lg" />
            ) : (
              <Calendar
                localizer={localizer}
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 600 }}
                view={view}
                onView={setView}
                date={currentDate}
                onNavigate={setCurrentDate}
                eventPropGetter={eventStyleGetter}
                components={{ toolbar: CustomToolbar }}
                className="bg-white dark:bg-gray-800 rounded-lg p-4"
                onSelectEvent={(event) => setSelectedEvent(event.resource)}
                eventContent={({ event }) => (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        {getEventTypeIcon(event.resource.related_table)}
                        <span>{event.title}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="dark:bg-gray-700 dark:text-gray-200">
                      <p><strong>{event.title}</strong></p>
                      <p>{event.allDay ? "All Day" : `${moment(event.start).format("h:mm A")} - ${moment(event.end).format("h:mm A")}`}</p>
                      {event.resource.flat_name && <p>Flat: {event.resource.flat_name}</p>}
                      {event.resource.tenant_name && <p>Tenant: {event.resource.tenant_name}</p>}
                    </TooltipContent>
                  </Tooltip>
                )}
              />
            )}

            {view === "agenda" && (
              <div className="mt-6 space-y-6">
                {sortedDates.length === 0 && !loading ? (
                  <div className="text-center text-luxury-charcoal/70 dark:text-gray-400 py-8">
                    No events found for the selected filters.
                  </div>
                ) : (
                  sortedDates.map((date) => (
                    <div key={date}>
                      <div className="text-lg font-semibold text-luxury-charcoal dark:text-gray-200 mb-2">
                        {moment(date).format("MMMM D, YYYY")}
                      </div>
                      <Separator className="bg-luxury-cream dark:bg-gray-600" />
                      {groupedEvents[date].map((event) => (
                        <Card
                          key={event.id}
                          className={`mt-2 bg-white dark:bg-gray-800 border-l-4 group hover:shadow-md transition-shadow`}
                          style={{
                            borderLeftColor: EVENT_TYPES.find((type) => type.value === event.resource.related_table)?.color || "#6b7280",
                          }}
                        >
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div>
                                <div className="font-medium text-luxury-charcoal dark:text-gray-200">
                                  {event.title}
                                </div>
                                <div className="text-sm text-luxury-charcoal/70 dark:text-gray-400">
                                  {event.allDay
                                    ? "All Day"
                                    : `${moment(event.start).format("h:mm A")} - ${moment(event.end).format("h:mm A")}`}
                                </div>
                                {event.resource.flat_name && (
                                  <div className="text-sm text-luxury-charcoal/70 dark:text-gray-400">
                                    Flat: {event.resource.flat_name}
                                  </div>
                                )}
                                {event.resource.tenant_name && (
                                  <div className="text-sm text-luxury-charcoal/70 dark:text-gray-400">
                                    Tenant: {event.resource.tenant_name}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedEvent(event.resource);
                                  setIsEditing(true);
                                }}
                                className="text-luxury-charcoal hover:text-luxury-gold dark:text-gray-200 dark:hover:text-luxury-gold"
                                aria-label="Edit event"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedEvent(event.resource);
                                  setConfirmDelete(true);
                                }}
                                className="text-luxury-charcoal hover:text-red-500 dark:text-gray-200 dark:hover:text-red-500"
                                aria-label="Delete event"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedEvent && !confirmDelete} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold dark:text-gray-200">
                {isEditing ? "Edit Event" : "Event Details"}
              </DialogTitle>
            </DialogHeader>
            {selectedEvent && (
              <div className="space-y-4">
                {isEditing ? (
                  <div className="grid gap-4 py-4">
                    <Card className="p-4 bg-luxury-cream/50 dark:bg-gray-700/50">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="editEventType" className="text-right dark:text-gray-200">Event Type*</Label>
                        <div className="col-span-3">
                          <Select
                            value={selectedEvent.related_table}
                            onValueChange={(value) => setSelectedEvent({ ...selectedEvent, related_table: value })}
                          >
                            <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                              <SelectValue placeholder="Select event type" />
                            </SelectTrigger>
                            <SelectContent className="dark:bg-gray-700 dark:text-gray-200">
                              {EVENT_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  <div className="flex items-center gap-2">
                                    {type.icon}
                                    <span>{type.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4 mt-4">
                        <Label htmlFor="editTitle" className="text-right dark:text-gray-200">Title*</Label>
                        <Input
                          id="editTitle"
                          value={selectedEvent.title}
                          onChange={(e) => setSelectedEvent({ ...selectedEvent, title: e.target.value })}
                          className="col-span-3 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4 mt-4">
                        <Label htmlFor="editDescription" className="text-right dark:text-gray-200">Description</Label>
                        <Textarea
                          id="editDescription"
                          value={selectedEvent.description}
                          onChange={(e) => setSelectedEvent({ ...selectedEvent, description: e.target.value })}
                          className="col-span-3 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                          rows={3}
                        />
                      </div>
                    </Card>
                    <Card className="p-4 bg-luxury-cream/50 dark:bg-gray-700/50">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <div className="text-right dark:text-gray-200">All Day</div>
                        <div className="col-span-3">
                          <Switch
                            checked={selectedEvent.all_day}
                            onCheckedChange={(checked) => setSelectedEvent({ ...selectedEvent, all_day: checked })}
                            aria-label="Toggle all day event"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4 mt-4">
                        <Label htmlFor="editStartDate" className="text-right dark:text-gray-200">Start*</Label>
                        <Input
                          id="editStartDate"
                          type={selectedEvent.all_day ? "date" : "datetime-local"}
                          value={selectedEvent.start_date}
                          onChange={(e) => setSelectedEvent({ ...selectedEvent, start_date: e.target.value })}
                          className="col-span-3 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                        />
                      </div>
                      {!selectedEvent.all_day && (
                        <div className="grid grid-cols-4 items-center gap-4 mt-4">
                          <Label htmlFor="editEndDate" className="text-right dark:text-gray-200">End</Label>
                          <Input
                            id="editEndDate"
                            type="datetime-local"
                            value={selectedEvent.end_date}
                            onChange={(e) => setSelectedEvent({ ...selectedEvent, end_date: e.target.value })}
                            className="col-span-3 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                          />
                        </div>
                      )}
                    </Card>
                    <Card className="p-4 bg-luxury-cream/50 dark:bg-gray-700/50">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="editFlat" className="text-right dark:text-gray-200">Flat</Label>
                        <div className="col-span-3">
                          <Select
                            value={selectedEvent.flat_id}
                            onValueChange={(value) => setSelectedEvent({ ...selectedEvent, flat_id: value })}
                          >
                            <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                              <SelectValue placeholder="Select flat" />
                            </SelectTrigger>
                            <SelectContent className="dark:bg-gray-700 dark:text-gray-200">
                              <SelectItem value="">None</SelectItem>
                              {flats.map((flat) => (
                                <SelectItem key={flat.id} value={flat.id}>
                                  {flat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4 mt-4">
                        <Label htmlFor="editTenant" className="text-right dark:text-gray-200">Tenant</Label>
                        <div className="col-span-3">
                          <Select
                            value={selectedEvent.tenant_id}
                            onValueChange={(value) => setSelectedEvent({ ...selectedEvent, tenant_id: value })}
                          >
                            <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                              <SelectValue placeholder="Select tenant" />
                            </SelectTrigger>
                            <SelectContent className="dark:bg-gray-700 dark:text-gray-200">
                              <SelectItem value="">None</SelectItem>
                              {tenants.map((tenant) => (
                                <SelectItem key={tenant.id} value={tenant.id}>
                                  {tenant.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-4 bg-luxury-cream/50 dark:bg-gray-700/50">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="editRecurrence" className="text-right dark:text-gray-200">Recurrence</Label>
                        <div className="col-span-3">
                          <Select
                            value={selectedEvent.recurrence}
                            onValueChange={(value) => setSelectedEvent({ ...selectedEvent, recurrence: value })}
                          >
                            <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                              <SelectValue placeholder="Select recurrence" />
                            </SelectTrigger>
                            <SelectContent className="dark:bg-gray-700 dark:text-gray-200">
                              {RECURRENCE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4 mt-4">
                        <Label htmlFor="editNotification" className="text-right dark:text-gray-200">Notification</Label>
                        <div className="col-span-3">
                          <Select
                            value={String(selectedEvent.notification_before)}
                            onValueChange={(value) =>
                              setSelectedEvent({ ...selectedEvent, notification_before: Number(value) })
                            }
                          >
                            <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                              <SelectValue placeholder="Select notification time" />
                            </SelectTrigger>
                            <SelectContent className="dark:bg-gray-700 dark:text-gray-200">
                              {NOTIFICATION_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={String(option.value)}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </Card>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      {getEventTypeIcon(selectedEvent.related_table || "general")}
                      <span className="font-medium text-luxury-charcoal dark:text-gray-200">{selectedEvent.title}</span>
                    </div>
                    {selectedEvent.description && (
                      <div className="text-luxury-charcoal/70 dark:text-gray-400">{selectedEvent.description}</div>
                    )}
                    <div className="text-luxury-charcoal/70 dark:text-gray-400">
                      <Clock className="h-4 w-4 inline mr-1" />
                      {selectedEvent.all_day
                        ? "All Day"
                        : `${moment(selectedEvent.start_date).format("MMMM D, YYYY h:mm A")} - ${moment(selectedEvent.end_date).format("MMMM D, YYYY h:mm A")}`}
                    </div>
                    {selectedEvent.flat_id && (
                      <div className="text-luxury-charcoal/70 dark:text-gray-400">
                        <Home className="h-4 w-4 inline mr-1" />
                        Flat: {flats.find((f) => f.id === selectedEvent.flat_id)?.name}
                      </div>
                    )}
                    {selectedEvent.tenant_id && (
                      <div className="text-luxury-charcoal/70 dark:text-gray-400">
                        <Users className="h-4 w-4 inline mr-1" />
                        Tenant: {tenants.find((t) => t.id === selectedEvent.tenant_id)?.name}
                      </div>
                    )}
                    {selectedEvent.recurrence !== "none" && (
                      <div className="text-luxury-charcoal/70 dark:text-gray-400">
                        <RefreshCcw className="h-4 w-4 inline mr-1" />
                        Recurrence: {selectedEvent.recurrence}
                      </div>
                    )}
                    {selectedEvent.notification_before !== 0 && (
                      <div className="text-luxury-charcoal/70 dark:text-gray-400">
                        <Bell className="h-4 w-4 inline mr-1" />
                        Notification: {NOTIFICATION_OPTIONS.find((opt) => opt.value === selectedEvent.notification_before)?.label}
                      </div>
                    )}
                    {relatedData && (
                      <Card className="p-4 bg-luxury-cream/50 dark:bg-gray-700/50">
                        <div className="text-lg font-semibold text-luxury-charcoal dark:text-gray-200 mb-2">Related Details</div>
                        {selectedEvent.related_table === "rents" && (
                          <>
                            <div className="text-luxury-charcoal/70 dark:text-gray-400">
                              Amount: {settings.default_currency || "$"} {relatedData.amount}
                            </div>
                            <div className="text-luxury-charcoal/70 dark:text-gray-400">
                              Due Date: {moment(relatedData.due_date).format("MMMM D, YYYY")}
                            </div>
                          </>
                        )}
                        {selectedEvent.related_table === "expenses" && (
                          <>
                            <div className="text-luxury-charcoal/70 dark:text-gray-400">
                              Amount: {settings.default_currency || "$"} {relatedData.amount}
                            </div>
                            <div className="text-luxury-charcoal/70 dark:text-gray-400">
                              Category: {relatedData.category || "N/A"}
                            </div>
                          </>
                        )}
                        {selectedEvent.related_table === "estimates" && (
                          <>
                            <div className="text-luxury-charcoal/70 dark:text-gray-400">
                              Amount: {settings.default_currency || "$"} {relatedData.amount}
                            </div>
                            <div className="text-luxury-charcoal/70 dark:text-gray-400">
                              Status: {relatedData.status}
                            </div>
                          </>
                        )}
                        {selectedEvent.related_table === "maintenance_requests" && (
                          <>
                            <div className="text-luxury-charcoal/70 dark:text-gray-400">
                              Status: {relatedData.status}
                            </div>
                            <div className="text-luxury-charcoal/70 dark:text-gray-400">
                              Priority: {relatedData.priority}
                            </div>
                          </>
                        )}
                        {selectedEvent.related_table === "reminders" && (
                          <>
                            <div className="text-luxury-charcoal/70 dark:text-gray-400">
                              Due Date: {moment(relatedData.due_date).format("MMMM D, YYYY")}
                            </div>
                            <div className="text-luxury-charcoal/70 dark:text-gray-400">
                              Status: {relatedData.status}
                            </div>
                          </>
                        )}
                      </Card>
                    )}
                    {notifications.length > 0 && (
                      <Card className="p-4 bg-luxury-cream/50 dark:bg-gray-700/50">
                        <div className="text-lg font-semibold text-luxury-charcoal dark:text-gray-200 mb-2">Notifications</div>
                        {notifications.map((notification) => (
                          <div key={notification.id} className="text-sm text-luxury-charcoal/70 dark:text-gray-400 mb-2">
                            <div className="flex items-center gap-2">
                              <Bell className="h-4 w-4" />
                              <span>{notification.message}</span>
                            </div>
                            <div className="text-xs">{moment(notification.created_at).format("MMMM D, YYYY h:mm A")}</div>
                            <div className="text-xs">{notification.read ? "Read" : "Unread"}</div>
                          </div>
                        ))}
                      </Card>
                    )}
                  </div>
                )}
                <DialogFooter>
                  {isEditing ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                        disabled={loading}
                        className="dark:border-gray-600 dark:text-gray-200"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleUpdateEvent}
                        disabled={loading}
                        className="bg-luxury-gold hover:bg-luxury-gold/90 text-white"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setSelectedEvent(null)}
                        className="dark:border-gray-600 dark:text-gray-200"
                      >
                        Close
                      </Button>
                      <Button
                        onClick={() => setIsEditing(true)}
                        className="bg-luxury-gold hover:bg-luxury-gold/90 text-white"
                      >
                        <Edit className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setConfirmDelete(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold dark:text-gray-200">Confirm Deletion</DialogTitle>
              <DialogDescription className="dark:text-gray-400">
                Are you sure you want to delete this event? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(false)}
                disabled={loading}
                className="dark:border-gray-600 dark:text-gray-200"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteEvent}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}