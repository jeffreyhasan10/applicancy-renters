import { useState, useEffect, useMemo } from "react";
import {
  CreditCard,
  Download,
  IndianRupee,
  Search,
  Trash2,
  MessageSquare,
  Filter,
  ChevronDown,
  RefreshCw,
  X,
  Calendar as CalendarIcon,
} from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { typedSupabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import RentForm from "@/components/forms/RentForm";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { Label } from "@/components/ui/label";
import { generateRentReminderMessage } from "@/utils/messageTemplates";

interface RentResponse {
  id: string;
  tenant_id: string;
  flat_id: string;
  amount: number;
  due_date: string;
  is_paid: boolean;
  paid_on: string | null;
  whatsapp_sent: boolean;
  custom_message: string | null;
  created_at: string;
  payment_frequency: 'one_time' | 'monthly' | null;
  reminder_day: number | null;
  last_reminder_date: string | null;
  tenants: {
    id: string;
    name: string;
    phone: string;
    flat_id: string;
  } | null;
  flats: {
    id: string;
    name: string;
    address: string;
    monthly_rent_target: number;
  } | null;
  calendar_events: {
    id: string;
    start_date: string;
    end_date: string;
  } | null;
}

interface RentWithUI extends Omit<RentResponse, 'tenants' | 'flats' | 'calendar_events'> {
  tenant: string;
  phone: string;
  flatName: string;
  flatAddress: string;
  tenantCount: number;
  dueDate: string;
  dueMonth: string;
  monthlyRentTarget: number | null;
  status: "paid" | "pending";
  paidOn: string | null;
  whatsappSent: boolean;
  customMessage: string | null;
  lastReminderDate: string | null;
  calendarStartDate: string | null;
  calendarEndDate: string | null;
  calendarMonth: string | null;
}

export default function Rent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [customMessageModalOpen, setCustomMessageModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [selectedRent, setSelectedRent] = useState<RentResponse | null>(null);
  const [customMessageText, setCustomMessageText] = useState("");
  const [selectedRents, setSelectedRents] = useState<string[]>([]);
  const [sortField, setSortField] = useState("due_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [filters, setFilters] = useState({
    flatId: "all",
    tenantId: "all",
    status: "all",
    paymentFrequency: "all",
    month: "all",
    dateRange: { from: null as Date | null, to: null as Date | null },
    calendarEventRange: { from: null as Date | null, to: null as Date | null },
    amountRange: { min: null as number | null, max: null as number | null },
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate available months for filter
  const availableMonths = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const months = eachMonthOfInterval({
      start: new Date(currentYear, 0, 1),
      end: new Date(currentYear, 11, 31),
    });
    return months.map((month) => ({
      value: month.getMonth().toString(),
      label: format(month, "MMMM"),
    }));
  }, []);

  // Fetch flats with tenant count
  const { data: flatsWithTenants = [], isLoading: isFlatsLoading } = useQuery({
    queryKey: ["flats_with_tenants"],
    queryFn: async () => {
      const { data, error } = await typedSupabase.from("flats").select(`
        id,
        name,
        address,
        monthly_rent_target,
        tenants:tenants!flat_id(count)
      `);
      if (error) throw error;
      return data.map((flat) => ({
        id: flat.id,
        name: flat.name,
        address: flat.address,
        monthly_rent_target: flat.monthly_rent_target,
        tenant_count: flat.tenants[0]?.count || 0,
      }));
    },
  });

  // Fetch tenants for filter
  const { data: tenants = [] } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await typedSupabase.from("tenants").select("id, name, flat_id");
      if (error) throw error;
      return data;
    },
  });

  // Fetch rent data with calendar events
  const { data: rentData = { data: [], count: 0 }, isLoading } = useQuery<{ data: RentWithUI[]; count: number }>({
    queryKey: ["rents", filters, sortField, sortOrder, page],
    queryFn: async () => {
      let query = typedSupabase.from("rents").select(`
        id,
        tenant_id,
        flat_id,
        due_date,
        amount,
        is_paid,
        paid_on,
        whatsapp_sent,
        custom_message,
        last_reminder_date,
        payment_frequency,
        created_at,
        reminder_day,
        tenants (
          id,
          name,
          phone,
          flat_id
        ),
        flats (
          id,
          name,
          address,
          monthly_rent_target
        ),
        calendar_events (
          id,
          start_date,
          end_date
        )
      `, { count: "exact" })
        .range((page - 1) * rowsPerPage, page * rowsPerPage - 1)
        .order(sortField, { ascending: sortOrder === "asc" });

      // Apply filters
      if (filters.flatId !== "all") query = query.eq("flat_id", filters.flatId);
      if (filters.tenantId !== "all") query = query.eq("tenant_id", filters.tenantId);
      if (filters.status !== "all") query = query.eq("is_paid", filters.status === "paid");
      if (filters.paymentFrequency !== "all") query = query.eq("payment_frequency", filters.paymentFrequency);
      
      // Month filter
      if (filters.month !== "all") {
        const month = parseInt(filters.month);
        const year = new Date().getFullYear();
        const startDate = startOfMonth(new Date(year, month, 1));
        const endDate = endOfMonth(new Date(year, month, 1));
        query = query.gte("due_date", format(startDate, "yyyy-MM-dd"));
        query = query.lte("due_date", format(endDate, "yyyy-MM-dd"));
      }

      if (filters.dateRange.from) query = query.gte("due_date", format(filters.dateRange.from, "yyyy-MM-dd"));
      if (filters.dateRange.to) query = query.lte("due_date", format(filters.dateRange.to, "yyyy-MM-dd"));
      if (filters.calendarEventRange.from) query = query.gte("calendar_events.start_date", format(filters.calendarEventRange.from, "yyyy-MM-dd"));
      if (filters.calendarEventRange.to) query = query.lte("calendar_events.end_date", format(filters.calendarEventRange.to, "yyyy-MM-dd"));
      if (filters.amountRange.min !== null) query = query.gte("amount", filters.amountRange.min);
      if (filters.amountRange.max !== null) query = query.lte("amount", filters.amountRange.max);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        data: (data as RentResponse[])
          .filter((rent) => rent.flats)
          .map((rent) => {
            const flat = flatsWithTenants.find((f) => f.id === rent.flat_id);
            const dueDate = rent.due_date ? new Date(rent.due_date) : null;
            const paidOn = rent.paid_on ? new Date(rent.paid_on) : null;
            const lastReminderDate = rent.last_reminder_date ? new Date(rent.last_reminder_date) : null;
            const calendarStartDate = rent.calendar_events?.start_date ? new Date(rent.calendar_events.start_date) : null;
            const calendarEndDate = rent.calendar_events?.end_date ? new Date(rent.calendar_events.end_date) : null;

            const rentWithUI: RentWithUI = {
              ...rent,
              tenant: rent.tenants?.name || "No Tenant",
              phone: rent.tenants?.phone || "",
              flatName: rent.flats?.name || "Unknown",
              flatAddress: rent.flats?.address || "",
              tenantCount: flat?.tenant_count || 0,
              dueDate: dueDate ? format(dueDate, "MMM dd, yyyy") : "N/A",
              dueMonth: dueDate ? format(dueDate, "MMMM yyyy") : "N/A",
              monthlyRentTarget: rent.flats?.monthly_rent_target || null,
              status: rent.is_paid ? "paid" : "pending",
              paidOn: paidOn ? format(paidOn, "MMM dd, yyyy") : null,
              whatsappSent: rent.whatsapp_sent,
              customMessage: rent.custom_message,
              lastReminderDate: lastReminderDate ? format(lastReminderDate, "MMM dd, yyyy") : null,
              calendarStartDate: calendarStartDate ? format(calendarStartDate, "MMM dd, yyyy") : null,
              calendarEndDate: calendarEndDate ? format(calendarEndDate, "MMM dd, yyyy") : null,
              calendarMonth: calendarStartDate ? format(calendarStartDate, "MMMM yyyy") : null,
            };

            return rentWithUI;
          }),
        count: count || 0,
      };
    },
  });

  // Real-time subscriptions
  useEffect(() => {
    let subscription: any = null;
    try {
      if (typeof typedSupabase.channel === "function") {
        subscription = typedSupabase
          .channel("rents_changes")
          .on("postgres_changes", { event: "*", schema: "public", table: "rents" }, () => {
            queryClient.invalidateQueries({ queryKey: ["rents"] });
          })
          .subscribe((status: string, err: any) => {
            if (status === "SUBSCRIBED") {
              console.log("Real-time subscription active for rents");
            }
            if (err) {
              console.error("Subscription error:", err);
              toast({
                variant: "destructive",
                title: "Real-time Error",
                description: "Failed to subscribe to real-time updates.",
              });
            }
          });
      }
    } catch (error: any) {
      console.error("Error setting up real-time subscription:", error);
      toast({
        variant: "destructive",
        title: "Real-time Error",
        description: "Failed to initialize real-time updates.",
      });
    }
    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [queryClient, toast]);

  useEffect(() => {
    let subscription: any = null;
    try {
      if (typeof typedSupabase.channel === "function") {
        subscription = typedSupabase
          .channel("tenants_changes")
          .on("postgres_changes", { event: "*", schema: "public", table: "tenants" }, () => {
            queryClient.invalidateQueries({ queryKey: ["flats_with_tenants"] });
          })
          .subscribe((status: string, err: any) => {
            if (status === "SUBSCRIBED") {
              console.log("Real-time subscription active for tenants");
            }
            if (err) {
              console.error("Subscription error:", err);
              toast({
                variant: "destructive",
                title: "Real-time Error",
                description: "Failed to subscribe to tenant updates.",
              });
            }
          });
      }
    } catch (error: any) {
      console.error("Error setting up tenants real-time subscription:", error);
    }
    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [queryClient, toast]);

  useEffect(() => {
    let subscription: any = null;
    try {
      if (typeof typedSupabase.channel === "function") {
        subscription = typedSupabase
          .channel("calendar_events_changes")
          .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, () => {
            queryClient.invalidateQueries({ queryKey: ["rents"] });
          })
          .subscribe((status: string, err: any) => {
            if (status === "SUBSCRIBED") {
              console.log("Real-time subscription active for calendar events");
            }
            if (err) {
              console.error("Subscription error:", err);
              toast({
                variant: "destructive",
                title: "Real-time Error",
                description: "Failed to subscribe to calendar event updates.",
              });
            }
          });
      }
    } catch (error: any) {
      console.error("Error setting up calendar events real-time subscription:", error);
    }
    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [queryClient, toast]);

  // Mutations
  const deleteRentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await typedSupabase.from("rents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rents"] });
      toast({
        title: "Rent record deleted",
        description: "The rent record has been deleted successfully.",
      });
      setSelectedRents((prev) => prev.filter((rentId) => rentId !== id));
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete rent record.",
      });
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const currentDate = new Date().toISOString().slice(0, 10);
      const { data: rentData, error: rentError } = await typedSupabase
        .from("rents")
        .select("amount, tenant_id, flat_id")
        .eq("id", id)
        .single();

      if (rentError) throw rentError;

      const { data: tenantData, error: tenantError } = await typedSupabase
        .from("tenants")
        .select("flat_id")
        .eq("id", rentData.tenant_id)
        .single();

      if (tenantError || !tenantData || tenantData.flat_id !== rentData.flat_id) {
        throw new Error("Tenant is not associated with the selected flat.");
      }

      const { error } = await typedSupabase.from("rents").update({
        is_paid: true,
        paid_on: currentDate,
      }).eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rents"] });
      toast({
        title: "Marked as Paid",
        description: "The rent record has been marked as paid.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to mark as paid.",
      });
    },
  });

  const bulkMarkAsPaidMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const currentDate = new Date().toISOString().slice(0, 10);
      const { data: rents, error: rentsError } = await typedSupabase
        .from("rents")
        .select("id, amount, tenant_id, flat_id")
        .in("id", ids);

      if (rentsError) throw rentsError;

      for (const rent of rents) {
        const { data: tenantData, error: tenantError } = await typedSupabase
          .from("tenants")
          .select("flat_id")
          .eq("id", rent.tenant_id)
          .single();

        if (tenantError || !tenantData || tenantData.flat_id !== rent.flat_id) {
          throw new Error(`Invalid tenant-flat association for rent ${rent.id}`);
        }

        await typedSupabase.from("payment_transactions").insert({
          rent_id: rent.id,
          tenant_id: rent.tenant_id,
          amount: rent.amount,
          payment_date: currentDate,
          payment_method: "cash",
          transaction_reference: `Bulk-${Date.now()}`,
          status: "paid",
        });
      }

      const { error } = await typedSupabase.from("rents").update({
        is_paid: true,
        paid_on: currentDate,
      }).in("id", ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rents"] });
      setSelectedRents([]);
      toast({
        title: "Bulk Mark as Paid",
        description: "Selected rent records have been marked as paid.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to mark rents as paid.",
      });
    },
  });

  // Send reminder
  const sendReminder = async (
    rentId: string,
    tenantId: string,
    tenantName: string,
    phone: string,
    amount: number,
    dueDate: string,
    customMessage: string | null,
    flatName: string
  ) => {
    let message = customMessage || generateRentReminderMessage({
      tenantName,
      flatName,
      amount,
      dueDate,
      months: [format(new Date(dueDate), "MMMM yyyy")],
    });

    const formattedNumber = phone.startsWith("+") ? phone.substring(1) : phone;
    const whatsappMessage = encodeURIComponent(message);
    const whatsappURL = `https://wa.me/${formattedNumber}?text=${whatsappMessage}`;

    try {
      await typedSupabase.from("whatsapp_messages").insert({
        tenant_id: tenantId,
        flat_id: rentId.split("-")[0],
        rent_id: rentId,
        message,
        recipient_phone: phone,
        sent_at: new Date().toISOString(),
        status: "pending",
      });

      await typedSupabase.from("rents").update({
        whatsapp_sent: true,
        last_reminder_date: new Date().toISOString().slice(0, 10),
      }).eq("id", rentId);

      window.open(whatsappURL, "_blank");

      toast({
        title: "Reminder sent",
        description: "The payment reminder has been sent successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send reminder.",
      });
    }
  };

  // Bulk send reminders
  const bulkSendReminders = async () => {
    const pendingRents = rentData.data.filter(
      (rent) => selectedRents.includes(rent.id) && rent.status === "pending"
    );
    for (const rent of pendingRents) {
      await sendReminder(
        rent.id,
        rent.tenant_id,
        rent.tenant,
        rent.phone,
        rent.amount,
        rent.dueDate,
        rent.customMessage,
        rent.flatName
      );
    }
    setSelectedRents([]);
    toast({
      title: "Reminders Sent",
      description: "Reminders have been sent to selected tenants.",
    });
  };

  // Export data
  const exportData = (format: "xlsx" | "csv") => {
    const dataToExport = rentData.data.map((rent) => ({
      Flat: rent.flatName,
      Address: rent.flatAddress,
      Tenants: rent.tenantCount,
      Tenant: rent.tenant,
      Phone: rent.phone,
      "Due Date": rent.dueDate,
      Amount: rent.amount,
      "Target Rent": rent.monthlyRentTarget || "N/A",
      Status: rent.status === "paid" ? "Paid" : "Pending",
      "Payment Date": rent.paidOn || "N/A",
      "Reminder Sent": rent.whatsappSent ? "Yes" : "No",
      "Last Reminder": rent.lastReminderDate || "N/A",
      Notes: rent.customMessage || "N/A",
      "Calendar Event Start": rent.calendarStartDate || "N/A",
      "Calendar Event End": rent.calendarEndDate || "N/A",
      "Payment Frequency": rent.paymentFrequency,
    }));

    if (format === "xlsx") {
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Rent Data");
      XLSX.writeFile(workbook, "RentData.xlsx");
    } else {
      const csv = Papa.unparse(dataToExport);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "RentData.csv");
      link.click();
      URL.revokeObjectURL(url);
    }

    toast({
      title: "Export Successful",
      description: `Rent data has been exported as ${format.toUpperCase()}.`,
    });
  };

  // Calculate statistics with fallback
  const calculateStats = useMemo(() => {
    const data = rentData?.data || [];
    const totalTarget = data.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalPaid = data
      .filter((item) => item.status === "paid")
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    const pendingAmount = data
      .filter((item) => item.status === "pending")
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    const pendingCount = data.filter((item) => item.status === "pending").length;
    const paidCount = data.filter((item) => item.status === "paid").length;

    return {
      totalCollection: totalPaid,
      targetCollection: totalTarget,
      pendingCollection: pendingAmount,
      pendingCount,
      paidCount,
    };
  }, [rentData?.data]);

  const totalPages = Math.ceil((rentData.count || 0) / rowsPerPage);

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  // Handle selection
  const toggleSelectRent = (id: string) => {
    setSelectedRents((prev) =>
      prev.includes(id) ? prev.filter((rentId) => rentId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRents.length === rentData.data.length) {
      setSelectedRents([]);
    } else {
      setSelectedRents(rentData.data.map((rent) => rent.id));
    }
  };

  // Custom message modal
  const openCustomMessageModal = (rent: any) => {
    setSelectedRent(rent);
    const month = format(new Date(rent.due_date), "MMMM");
    const dueDate = format(new Date(rent.due_date), "dd MMM yyyy");
    const amount = rent.amount.toLocaleString();
    
    const defaultMessage = `Dear Customer,
Greetings!

Upcoming payment of your monthly furniture rent for month of ${month} is due on *${dueDate}*

Payment due is *Rs ${amount}*

Please pay the rent to avoid any miss payment.

Thank you
*Applicancy Renters*`;

    setCustomMessageText(rent.custom_message || defaultMessage);
    setCustomMessageModalOpen(true);
  };

  const saveCustomMessage = async () => {
    if (!selectedRent) return;

    try {
      await typedSupabase.from("rents").update({ custom_message: customMessageText }).eq("id", selectedRent.id);
      queryClient.invalidateQueries({ queryKey: ["rents"] });
      toast({
        title: "Message Saved",
        description: "Custom message has been saved successfully.",
      });
      setCustomMessageModalOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save custom message.",
      });
    }
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      flatId: "all",
      tenantId: "all",
      status: "all",
      paymentFrequency: "all",
      month: "all",
      dateRange: { from: null, to: null },
      calendarEventRange: { from: null, to: null },
      amountRange: { min: null, max: null },
    });
    setFilterModalOpen(false);
    setPage(1);
  };

  // Validate amount range
  const isValidAmountRange = () => {
    if (filters.amountRange.min !== null && filters.amountRange.min < 0) return false;
    if (filters.amountRange.max !== null && filters.amountRange.max < 0) return false;
    if (
      filters.amountRange.min !== null &&
      filters.amountRange.max !== null &&
      filters.amountRange.min > filters.amountRange.max
    ) return false;
    return true;
  };

  // Render loading state
  if (isLoading || isFlatsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600 text-lg">Loading rent data...</span>
      </div>
    );
  }

  // Render error state if data is not available
  if (!rentData || !calculateStats) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="text-red-600 text-lg">Error loading rent data. Please try again.</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full overflow-x-hidden">
      <PageHeader
        title="Rent Management"
        description="Track and manage rent payments with ease"
        onActionClick={() => setRecordModalOpen(true)}
        actionLabel="Record Payment"
        className="mb-8 text-gray-900"
      />

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-luxury bg-gradient-to-br from-luxury-softwhite to-luxury-pearl hover:shadow-card-hover transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-luxury-charcoal">Total Collection</CardTitle>
            <CardDescription className="text-luxury-slate">Overview of collected rent</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <IndianRupee className="h-6 w-6 text-success mr-3" />
              <span className="text-2xl font-bold text-luxury-charcoal">
                ₹{calculateStats.totalCollection.toLocaleString()}
              </span>
              <span className="ml-2 text-sm text-luxury-slate">
                of ₹{calculateStats.targetCollection.toLocaleString()}
              </span>
            </div>
            <div className="mt-3 h-2 bg-luxury-pearl rounded-full overflow-hidden">
              <div
                className="bg-success h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(calculateStats.totalCollection / calculateStats.targetCollection) * 100}%`,
                }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-luxury bg-gradient-to-br from-luxury-softwhite to-luxury-pearl hover:shadow-card-hover transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-luxury-charcoal">Pending Collection</CardTitle>
            <CardDescription className="text-luxury-slate">Outstanding rent payments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <IndianRupee className="h-6 w-6 text-warning mr-3" />
              <span className="text-2xl font-bold text-luxury-charcoal">
                ₹{calculateStats.pendingCollection.toLocaleString()}
              </span>
              <span className="ml-2 text-sm text-luxury-slate">{calculateStats.pendingCount} tenants</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full transition-all duration-200 hover:bg-warning/10 border-warning text-warning hover:text-warning focus:ring-2 focus:ring-warning/20"
              onClick={bulkSendReminders}
              disabled={
                selectedRents.length === 0 ||
                !selectedRents.some((id) => rentData.data.find((r) => r.id === id && r.status === "pending"))
              }
              aria-label="Send selected reminders"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Send Selected Reminders
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-luxury bg-gradient-to-br from-luxury-softwhite to-luxury-pearl hover:shadow-card-hover transition-all duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-luxury-charcoal">Export Data</CardTitle>
            <CardDescription className="text-luxury-slate">Download rent data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full transition-all duration-200 hover:bg-luxury-gold/10 border-luxury-gold text-luxury-charcoal hover:text-luxury-charcoal focus:ring-2 focus:ring-luxury-gold/20"
              onClick={() => exportData("xlsx")}
              aria-label="Export as Excel"
            >
              <Download className="h-4 w-4 mr-2" />
              Export as Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full transition-all duration-200 hover:bg-luxury-gold/10 border-luxury-gold text-luxury-charcoal hover:text-luxury-charcoal focus:ring-2 focus:ring-luxury-gold/20"
              onClick={() => exportData("csv")}
              aria-label="Export as CSV"
            >
              <Download className="h-4 w-4 mr-2" />
              Export as CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card className="shadow-luxury bg-white border border-luxury-pearl">
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle className="text-xl font-semibold text-luxury-charcoal">Rent Transactions</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="transition-all duration-200 hover:bg-luxury-gold/10 border-luxury-gold text-luxury-charcoal"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["rents"] })}
            aria-label="Refresh data"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <TabsList className="w-full sm:w-auto bg-gray-100 rounded-lg">
                <TabsTrigger value="all" className="flex-1 sm:flex-none data-[state=active]:bg-white data-[state=active]:shadow-sm">All</TabsTrigger>
                <TabsTrigger value="paid" className="flex-1 sm:flex-none data-[state=active]:bg-white data-[state=active]:shadow-sm">Paid</TabsTrigger>
                <TabsTrigger value="pending" className="flex-1 sm:flex-none data-[state=active]:bg-white data-[state=active]:shadow-sm">Pending</TabsTrigger>
              </TabsList>

              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Input
                    placeholder="Search flats, tenants, or IDs..."
                    className="pl-10 pr-3 py-2 rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Search className="absolute top-1/2 left-3 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>

                <Dialog open={filterModalOpen} onOpenChange={setFilterModalOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="transition-all duration-200 hover:bg-indigo-50 border-indigo-300 text-indigo-700 flex items-center gap-2"
                      aria-label="Open filters"
                    >
                      <Filter className="h-4 w-4" />
                      Filters
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[90vw] sm:max-w-[600px] max-h-[80vh] overflow-y-auto rounded-lg bg-white shadow-2xl p-6">
                    <DialogHeader className="relative">
                      <DialogTitle className="text-xl font-semibold text-gray-900">
                        Filter Rent Transactions
                      </DialogTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setFilterModalOpen(false)}
                        className="absolute right-0 top-0 hover:bg-gray-100 rounded-full"
                        aria-label="Close filter modal"
                      >
                        <X className="h-5 w-5 text-gray-600" />
                      </Button>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-6 py-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Month</Label>
                        <Select
                          value={filters.month}
                          onValueChange={(value) => setFilters((prev) => ({ ...prev, month: value }))}
                        >
                          <SelectTrigger className="rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500">
                            <SelectValue placeholder="Select month" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Months</SelectItem>
                            {availableMonths.map((month) => (
                              <SelectItem key={month.value} value={month.value}>
                                {month.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Flat</Label>
                        <Select
                          value={filters.flatId}
                          onValueChange={(value) => setFilters((prev) => ({ ...prev, flatId: value }))}
                        >
                          <SelectTrigger className="rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500">
                            <SelectValue placeholder="Select flat" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Flats</SelectItem>
                            {flatsWithTenants.map((flat) => (
                              <SelectItem key={flat.id} value={flat.id}>
                                {flat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Tenant</Label>
                        <Select
                          value={filters.tenantId}
                          onValueChange={(value) => setFilters((prev) => ({ ...prev, tenantId: value }))}
                        >
                          <SelectTrigger className="rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500">
                            <SelectValue placeholder="Select tenant" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Tenants</SelectItem>
                            {tenants.map((tenant) => (
                              <SelectItem key={tenant.id} value={tenant.id}>
                                {tenant.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Status</Label>
                        <Select
                          value={filters.status}
                          onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
                        >
                          <SelectTrigger className="rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Payment Frequency</Label>
                        <Select
                          value={filters.paymentFrequency}
                          onValueChange={(value) => setFilters((prev) => ({ ...prev, paymentFrequency: value }))}
                        >
                          <SelectTrigger className="rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500">
                            <SelectValue placeholder="Select payment frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Frequencies</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Due Date Range</Label>
                        <Calendar
                          mode="range"
                          selected={{ from: filters.dateRange.from || undefined, to: filters.dateRange.to || undefined }}
                          onSelect={(range) => setFilters((prev) => ({
                            ...prev,
                            dateRange: { from: range?.from || null, to: range?.to || null },
                          }))}
                          className="rounded-lg border border-gray-200 shadow-sm w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Calendar Event Date Range</Label>
                        <Calendar
                          mode="range"
                          selected={{
                            from: filters.calendarEventRange.from || undefined,
                            to: filters.calendarEventRange.to || undefined,
                          }}
                          onSelect={(range) => setFilters((prev) => ({
                            ...prev,
                            calendarEventRange: { from: range?.from || null, to: range?.to || null },
                          }))}
                          className="rounded-lg border border-gray-200 shadow-sm w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Amount Range</Label>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="flex-1">
                            <Input
                              type="number"
                              placeholder="Min amount"
                              value={filters.amountRange.min || ""}
                              onChange={(e) => setFilters((prev) => ({
                                ...prev,
                                amountRange: { ...prev.amountRange, min: e.target.value ? Number(e.target.value) : null },
                              }))}
                              className={`rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500 ${
                                filters.amountRange.min !== null && filters.amountRange.min < 0 ? "border-red-500" : ""
                              }`}
                            />
                            {filters.amountRange.min !== null && filters.amountRange.min < 0 && (
                              <p className="text-red-500 text-xs mt-1">Amount cannot be negative</p>
                            )}
                          </div>
                          <div className="flex-1">
                            <Input
                              type="number"
                              placeholder="Max amount"
                              value={filters.amountRange.max || ""}
                              onChange={(e) => setFilters((prev) => ({
                                ...prev,
                                amountRange: { ...prev.amountRange, max: e.target.value ? Number(e.target.value) : null },
                              }))}
                              className={`rounded-lg border-gray-300 focus:ring-2 focus:ring-indigo-500 ${
                                filters.amountRange.max !== null && filters.amountRange.max < 0 ? "border-red-500" : ""
                              }`}
                            />
                            {filters.amountRange.max !== null && filters.amountRange.max < 0 && (
                              <p className="text-red-500 text-xs mt-1">Amount cannot be negative</p>
                            )}
                            {filters.amountRange.min !== null &&
                              filters.amountRange.max !== null &&
                              filters.amountRange.min > filters.amountRange.max && (
                                <p className="text-red-500 text-xs mt-1">Min amount cannot exceed max amount</p>
                              )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button
                        variant="outline"
                        onClick={resetFilters}
                        className="transition-all duration-200 hover:bg-gray-50 border-gray-300 text-gray-700"
                        aria-label="Reset filters"
                      >
                        Reset
                      </Button>
                      <Button
                        onClick={() => setFilterModalOpen(false)}
                        disabled={!isValidAmountRange()}
                        className="transition-all duration-200 bg-indigo-600 hover:bg-indigo-700 text-white"
                        aria-label="Apply filters"
                      >
                        Apply Filters
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {["all", "paid", "pending"].map((tab) => (
              <TabsContent key={tab} value={tab}>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 max-h-[60vh] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                  <table className="w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr className="whitespace-nowrap">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">
                          <Checkbox
                            checked={selectedRents.length === rentData.data.length}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all rents"
                          />
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleSort("dueMonth")}
                        >
                          Month {sortField === "dueMonth" && <ChevronDown className="inline h-4 w-4" />}
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleSort("flatName")}
                        >
                          Flat {sortField === "flatName" && <ChevronDown className="inline h-4 w-4" />}
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleSort("tenantCount")}
                        >
                          Tenants {sortField === "tenantCount" && <ChevronDown className="inline h-4 w-4" />}
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleSort("tenant")}
                        >
                          Tenant {sortField === "tenant" && <ChevronDown className="inline h-4 w-4" />}
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleSort("due_date")}
                        >
                          Due Date {sortField === "due_date" && <ChevronDown className="inline h-4 w-4" />}
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleSort("amount")}
                        >
                          Amount {sortField === "amount" && <ChevronDown className="inline h-4 w-4" />}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Target Rent
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Payment Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Calendar Start
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Calendar End
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Frequency
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rentData.data
                        .filter((rent) =>
                          (tab === "all" || rent.status === tab) &&
                          (rent.flatName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            rent.tenant.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            rent.phone.includes(searchQuery) ||
                            rent.flat_id.includes(searchQuery))
                        )
                        .map((rent, index) => (
                          <tr
                            key={rent.id}
                            className={`hover:bg-gray-50 transition-colors duration-150 ${index % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
                          >
                            <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-inherit">
                              <Checkbox
                                checked={selectedRents.includes(rent.id)}
                                onCheckedChange={() => toggleSelectRent(rent.id)}
                                aria-label={`Select rent for ${rent.tenant}`}
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              {rent.dueMonth}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 line-clamp-1">{rent.flatName}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{rent.tenantCount}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 line-clamp-1">{rent.tenant}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{rent.dueDate}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">₹{rent.amount.toLocaleString()}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">₹{rent.monthlyRentTarget?.toLocaleString() || "N/A"}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  rent.status === "paid" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {rent.status === "paid" ? "Paid" : "Pending"}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{rent.paidOn || "-"}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{rent.calendarStartDate || "-"}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{rent.calendarEndDate || "-"}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{rent.paymentFrequency}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                              <div className="flex gap-2">
                                {rent.tenant !== "No Tenant" && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => sendReminder(
                                      rent.id,
                                      rent.tenant_id,
                                      rent.tenant,
                                      rent.phone,
                                      rent.amount,
                                      rent.dueDate,
                                      rent.customMessage,
                                      rent.flatName
                                    )}
                                    title="Send Reminder"
                                    className="hover:bg-indigo-50 border-indigo-300 text-indigo-600"
                                    aria-label={`Send reminder to ${rent.tenant}`}
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                  </Button>
                                )}
                                {rent.tenant !== "No Tenant" && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => openCustomMessageModal(rent)}
                                    title="Custom Message"
                                    className="hover:bg-indigo-50 border-indigo-300 text-indigo-600"
                                    aria-label={`Edit custom message for ${rent.tenant}`}
                                  >
                                    <CreditCard className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => deleteRentMutation.mutate(rent.id)}
                                  title="Delete Rent Record"
                                  className="hover:bg-red-700"
                                  aria-label={`Delete rent record for ${rent.tenant}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                {rent.status !== "paid" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => markAsPaidMutation.mutate(rent.id)}
                                    title="Mark as Paid"
                                    className="hover:bg-indigo-50 border-indigo-300 text-indigo-600"
                                    aria-label={`Mark as paid for ${rent.tenant}`}
                                  >
                                    Mark Paid
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {rentData.data
                    .filter((rent) =>
                      (tab === "all" || rent.status === tab) &&
                      (rent.flatName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        rent.tenant.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        rent.phone.includes(searchQuery) ||
                        rent.flat_id.includes(searchQuery))
                    )
                    .map((rent) => (
                      <Card key={rent.id} className="shadow-sm">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between mb-4">
                            <Checkbox
                              checked={selectedRents.includes(rent.id)}
                              onCheckedChange={() => toggleSelectRent(rent.id)}
                              aria-label={`Select rent for ${rent.tenant}`}
                            />
                            <span
                              className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                rent.status === "paid" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {rent.status === "paid" ? "Paid" : "Pending"}
                            </span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <p><strong>Month:</strong> {rent.dueMonth}</p>
                            <p><strong>Flat:</strong> {rent.flatName}</p>
                            <p><strong>Tenant:</strong> {rent.tenant}</p>
                            <p><strong>Due Date:</strong> {rent.dueDate}</p>
                            <p><strong>Amount:</strong> ₹{rent.amount.toLocaleString()}</p>
                            <p><strong>Target Rent:</strong> ₹{rent.monthlyRentTarget?.toLocaleString() || "N/A"}</p>
                            <p><strong>Payment Date:</strong> {rent.paidOn || "-"}</p>
                            <p><strong>Frequency:</strong> {rent.paymentFrequency}</p>
                          </div>
                          <div className="flex gap-2 mt-4">
                            {rent.tenant !== "No Tenant" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => sendReminder(
                                  rent.id,
                                  rent.tenant_id,
                                  rent.tenant,
                                  rent.phone,
                                  rent.amount,
                                  rent.dueDate,
                                  rent.customMessage,
                                  rent.flatName
                                )}
                                className="flex-1"
                                aria-label={`Send reminder to ${rent.tenant}`}
                              >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Reminder
                              </Button>
                            )}
                            {rent.status !== "paid" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => markAsPaidMutation.mutate(rent.id)}
                                className="flex-1"
                                aria-label={`Mark as paid for ${rent.tenant}`}
                              >
                                Mark Paid
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
                  <div className="w-full sm:w-auto">
                    {selectedRents.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => bulkMarkAsPaidMutation.mutate(selectedRents)}
                        disabled={
                          !selectedRents.some((id) => rentData.data.find((r) => r.id === id && r.status === "pending"))
                        }
                        className="w-full sm:w-auto"
                        aria-label={`Mark ${selectedRents.length} rents as paid`}
                      >
                        Mark {selectedRents.length} as Paid
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                      aria-label="Previous page"
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
                    <Button
                      variant="outline"
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      aria-label="Next page"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Custom Message Modal */}
      <Dialog open={customMessageModalOpen} onOpenChange={setCustomMessageModalOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-[500px] rounded-lg bg-white shadow-2xl p-6">
          <DialogHeader className="relative">
            <DialogTitle className="text-xl font-semibold text-gray-900">Custom Reminder Message</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCustomMessageModalOpen(false)}
              className="absolute right-0 top-0 hover:bg-gray-100 rounded-full"
              aria-label="Close custom message modal"
            >
              <X className="h-5 w-5 text-gray-600" />
            </Button>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">
              Customize the WhatsApp message for {selectedRent?.tenants?.name || "tenant"}
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 h-32 focus:ring-2 focus:ring-indigo-500 resize-none"
              value={customMessageText}
              onChange={(e) => setCustomMessageText(e.target.value)}
              placeholder="Type your custom message here..."
              aria-label="Custom message text"
            ></textarea>
            <p className="text-xs text-gray-500">
              Note: The message will be sent with the same format as the default reminder.
            </p>
          </div>
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setCustomMessageModalOpen(false)}
              aria-label="Cancel custom message"
            >
              Cancel
            </Button>
            <Button
              onClick={saveCustomMessage}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              aria-label="Save custom message"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <RentForm open={recordModalOpen} onOpenChange={setRecordModalOpen} />
    </div>
  );
}