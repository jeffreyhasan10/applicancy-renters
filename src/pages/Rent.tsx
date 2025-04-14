import { useState, useEffect } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { typedSupabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import RentForm from "@/components/forms/RentForm";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { Label } from "@/components/ui/label";

export default function Rent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [customMessageModalOpen, setCustomMessageModalOpen] = useState(false);
  const [selectedRent, setSelectedRent] = useState<any>(null);
  const [customMessageText, setCustomMessageText] = useState("");
  const [selectedRents, setSelectedRents] = useState<string[]>([]);
  const [sortField, setSortField] = useState("due_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [filters, setFilters] = useState({
    flatId: "",
    tenantId: "",
    status: "",
    dateRange: { from: null as Date | null, to: null as Date | null },
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch flats with tenant count
  const { data: flatsWithTenants = [], isLoading: isFlatsLoading } = useQuery({
    queryKey: ["flats_with_tenants"],
    queryFn: async () => {
      const { data, error } = await typedSupabase
        .from("flats")
        .select(
          `
          id,
          name,
          address,
          monthly_rent_target,
          tenants:tenants!flat_id(count)
        `
        );
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

  // Fetch rent data
  const { data: rentData = { data: [], count: 0 }, isLoading } = useQuery({
    queryKey: ["rents", filters, sortField, sortOrder, page],
    queryFn: async () => {
      let query = typedSupabase
        .from("rents")
        .select(
          `
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
          notes,
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
          )
        `,
          { count: "exact" }
        )
        .range((page - 1) * rowsPerPage, page * rowsPerPage - 1)
        .order(sortField, { ascending: sortOrder === "asc" });

      // Apply filters
      if (filters.flatId) query = query.eq("flat_id", filters.flatId);
      if (filters.tenantId) query = query.eq("tenant_id", filters.tenantId);
      if (filters.status) query = query.eq("is_paid", filters.status === "paid");
      if (filters.dateRange.from)
        query = query.gte("due_date", format(filters.dateRange.from, "yyyy-MM-dd"));
      if (filters.dateRange.to)
        query = query.lte("due_date", format(filters.dateRange.to, "yyyy-MM-dd"));

      const { data, error, count } = await query;

      if (error) {
        console.error("Error fetching rent data:", error);
        throw error;
      }

      return {
        data: data
          .filter((rent) => rent.flats)
          .map((rent) => {
            const flat = flatsWithTenants.find((f) => f.id === rent.flat_id);
            return {
              id: rent.id,
              tenant_id: rent.tenant_id,
              flat_id: rent.flat_id,
              tenant: rent.tenants?.name || "No Tenant",
              phone: rent.tenants?.phone || "",
              flatName: rent.flats?.name || "Unknown",
              flatAddress: rent.flats?.address || "",
              tenantCount: flat?.tenant_count || 0,
              dueDate: rent.due_date ? new Date(rent.due_date).toLocaleDateString() : "N/A",
              amount: rent.amount,
              monthlyRentTarget: rent.flats?.monthly_rent_target || null,
              status: rent.is_paid ? "paid" : "pending",
              paidOn: rent.paid_on ? new Date(rent.paid_on).toLocaleDateString() : null,
              whatsappSent: rent.whatsapp_sent,
              customMessage: rent.custom_message,
              lastReminderDate: rent.last_reminder_date
                ? new Date(rent.last_reminder_date).toLocaleDateString()
                : null,
              notes: rent.notes,
            };
          }),
        count: count || 0,
      };
    },
  });

  // Real-time subscription for rents
  useEffect(() => {
    let subscription: any = null;

    try {
      if (typeof typedSupabase.channel === "function") {
        subscription = typedSupabase
          .channel("rents_changes")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "rents" },
            () => {
              queryClient.invalidateQueries({ queryKey: ["rents"] });
            }
          )
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
      } else {
        console.warn("Real-time subscriptions not supported by this Supabase client.");
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
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [queryClient, toast]);

  // Real-time subscription for tenants (to update tenant counts)
  useEffect(() => {
    let subscription: any = null;

    try {
      if (typeof typedSupabase.channel === "function") {
        subscription = typedSupabase
          .channel("tenants_changes")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "tenants" },
            () => {
              queryClient.invalidateQueries({ queryKey: ["flats_with_tenants"] });
            }
          )
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
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [queryClient, toast]);

  // Mutation to delete a rent record
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

  // Mutation to mark as paid
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

      const { error: transactionError } = await typedSupabase
        .from("payment_transactions")
        .insert({
          rent_id: id,
          tenant_id: rentData.tenant_id,
          amount: rentData.amount,
          payment_date: currentDate,
          payment_method: "cash",
          transaction_reference: `Manual-${Date.now()}`,
          status: "paid",
        });

      if (transactionError) throw transactionError;

      const { error } = await typedSupabase
        .from("rents")
        .update({
          is_paid: true,
          paid_on: currentDate,
        })
        .eq("id", id);

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

  // Bulk mark as paid
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

      const { error } = await typedSupabase
        .from("rents")
        .update({
          is_paid: true,
          paid_on: currentDate,
        })
        .in("id", ids);

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
    customMessage: string | null
  ) => {
    let message =
      customMessage ||
      `Hi ${tenantName}, your rent payment of ₹${amount.toLocaleString()} is due on ${dueDate}. Please make the payment at your earliest convenience.`;

    const formattedNumber = phone.startsWith("+") ? phone.substring(1) : phone;
    const whatsappMessage = encodeURIComponent(message);
    const whatsappURL = `https://wa.me/${formattedNumber}?text=${whatsappMessage}`;

    try {
      await typedSupabase.from("whatsapp_messages").insert({
        tenant_id: tenantId,
        message,
        recipient_phone: phone,
        sent_at: new Date().toISOString(),
        rent_id: rentId,
        status: "pending",
      });

      await typedSupabase
        .from("rents")
        .update({
          whatsapp_sent: true,
          last_reminder_date: new Date().toISOString().slice(0, 10),
        })
        .eq("id", rentId);

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
        rent.customMessage
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
      Notes: rent.notes || "N/A",
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

  // Calculate statistics
  const calculateStats = (data: any[] = []) => {
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
  };

  const stats = calculateStats(rentData.data);
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
    setCustomMessageText(rent.customMessage || "");
    setCustomMessageModalOpen(true);
  };

  const saveCustomMessage = async () => {
    if (!selectedRent) return;

    try {
      await typedSupabase
        .from("rents")
        .update({ custom_message: customMessageText })
        .eq("id", selectedRent.id);

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

  if (isLoading || isFlatsLoading) {
    return <div className="flex justify-center items-center h-64">Loading rent data...</div>;
  }

  return (
    <>
      <PageHeader
        title="Rent Management"
        description="Track and manage rent payments"
        onActionClick={() => setRecordModalOpen(true)}
        actionLabel="Record Payment"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Total Collection</CardTitle>
            <CardDescription>Overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <IndianRupee className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-2xl font-bold">₹{stats.totalCollection.toLocaleString()}</span>
              <span className="ml-2 text-sm text-gray-500">
                of ₹{stats.targetCollection.toLocaleString()}
              </span>
            </div>
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="bg-green-500 h-full rounded-full"
                style={{
                  width:
                    stats.targetCollection > 0
                      ? `${(stats.totalCollection / stats.targetCollection) * 100}%`
                      : "0%",
                }}
              ></div>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">
                {stats.paidCount}/{stats.paidCount + stats.pendingCount} Payments
              </span>
              <span className="text-xs text-gray-500">
                {stats.targetCollection > 0
                  ? `${((stats.totalCollection / stats.targetCollection) * 100).toFixed(1)}%`
                  : "0%"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Pending Collection</CardTitle>
            <CardDescription>Overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <IndianRupee className="h-5 w-5 text-amber-600 mr-2" />
              <span className="text-2xl font-bold">₹{stats.pendingCollection.toLocaleString()}</span>
              <span className="ml-2 text-sm text-gray-500">{stats.pendingCount} tenants</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full"
              onClick={bulkSendReminders}
              disabled={
                selectedRents.length === 0 ||
                !selectedRents.some((id) =>
                  rentData.data.find((r) => r.id === id && r.status === "pending")
                )
              }
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Send Selected Reminders
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Export Data</CardTitle>
            <CardDescription>Export rent data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" size="sm" className="w-full" onClick={() => exportData("xlsx")}>
              <Download className="h-4 w-4 mr-2" />
              Export as Excel
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={() => exportData("csv")}>
              <Download className="h-4 w-4 mr-2" />
              Export as CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rent Transactions</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["rents"] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
              </TabsList>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Input
                    placeholder="Search flats, tenants, or IDs..."
                    className="pl-10 pr-3 py-2"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Search className="absolute top-2.5 left-3 h-4 w-4 text-gray-400" />
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">
                      <Filter className="h-4 w-4 mr-2" />
                      Filters
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-4">
                      <div>
                        <Label>Flat</Label>
                        <Select
                          value={filters.flatId}
                          onValueChange={(value) =>
                            setFilters((prev) => ({ ...prev, flatId: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select flat" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All Flats</SelectItem>
                            {flatsWithTenants.map((flat) => (
                              <SelectItem key={flat.id} value={flat.id}>
                                {flat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Tenant</Label>
                        <Select
                          value={filters.tenantId}
                          onValueChange={(value) =>
                            setFilters((prev) => ({ ...prev, tenantId: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select tenant" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All Tenants</SelectItem>
                            {tenants.map((tenant) => (
                              <SelectItem key={tenant.id} value={tenant.id}>
                                {tenant.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select
                          value={filters.status}
                          onValueChange={(value) =>
                            setFilters((prev) => ({ ...prev, status: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All Statuses</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Date Range</Label>
                        <Calendar
                          mode="range"
                          selected={{
                            from: filters.dateRange.from || undefined,
                            to: filters.dateRange.to || undefined,
                          }}
                          onSelect={(range) =>
                            setFilters((prev) => ({
                              ...prev,
                              dateRange: { from: range?.from || null, to: range?.to || null },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {["all", "paid", "pending"].map((tab) => (
              <TabsContent key={tab} value={tab}>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <Checkbox
                            checked={selectedRents.length === rentData.data.length}
                            onCheckedChange={toggleSelectAll}
                          />
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort("flatName")}
                        >
                          Flat {sortField === "flatName" && <ChevronDown className="inline h-4 w-4" />}
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort("tenantCount")}
                        >
                          Tenants{" "}
                          {sortField === "tenantCount" && <ChevronDown className="inline h-4 w-4" />}
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort("tenant")}
                        >
                          Tenant {sortField === "tenant" && <ChevronDown className="inline h-4 w-4" />}
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort("due_date")}
                        >
                          Due Date {sortField === "due_date" && <ChevronDown className="inline h-4 w-4" />}
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort("amount")}
                        >
                          Amount {sortField === "amount" && <ChevronDown className="inline h-4 w-4" />}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Target Rent
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Payment Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rentData.data
                        .filter(
                          (rent) =>
                            (tab === "all" || rent.status === tab) &&
                            (rent.flatName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              rent.tenant.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              rent.phone.includes(searchQuery) ||
                              rent.flat_id.includes(searchQuery))
                        )
                        .map((rent) => (
                          <tr key={rent.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Checkbox
                                checked={selectedRents.includes(rent.id)}
                                onCheckedChange={() => toggleSelectRent(rent.id)}
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {rent.flatName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {rent.tenantCount}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {rent.tenant}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {rent.dueDate}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              ₹{rent.amount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              ₹{rent.monthlyRentTarget?.toLocaleString() || "N/A"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  rent.status === "paid"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {rent.status === "paid" ? "Paid" : "Pending"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {rent.paidOn || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2">
                                {rent.tenant !== "No Tenant" && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() =>
                                      sendReminder(
                                        rent.id,
                                        rent.tenant_id,
                                        rent.tenant,
                                        rent.phone,
                                        rent.amount,
                                        rent.dueDate,
                                        rent.customMessage
                                      )
                                    }
                                    title="Send Reminder"
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
                                  >
                                    <CreditCard className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => deleteRentMutation.mutate(rent.id)}
                                  title="Delete Rent Record"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                {rent.status !== "paid" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => markAsPaidMutation.mutate(rent.id)}
                                    title="Mark as Paid"
                                  >
                                    Mark as Paid
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <div>
                    {selectedRents.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => bulkMarkAsPaidMutation.mutate(selectedRents)}
                        disabled={
                          !selectedRents.some((id) =>
                            rentData.data.find((r) => r.id === id && r.status === "pending")
                          )
                        }
                      >
                        Mark {selectedRents.length} as Paid
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span>
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => p + 1)}
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

      {/* Custom message modal */}
      {customMessageModalOpen && selectedRent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Custom Reminder Message</h2>
            <p className="text-sm text-gray-600 mb-4">
              Customize the WhatsApp message for {selectedRent.tenant}
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-md p-3 mb-4 h-32"
              value={customMessageText}
              onChange={(e) => setCustomMessageText(e.target.value)}
              placeholder="Type your custom message here..."
            ></textarea>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setCustomMessageModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveCustomMessage}>Save Message</Button>
            </div>
          </div>
        </div>
      )}

      <RentForm open={recordModalOpen} onOpenChange={setRecordModalOpen} />
    </>
  );
}