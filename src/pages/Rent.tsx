import { CreditCard, Download, IndianRupee, Search, Trash2, MessageSquare } from "lucide-react";
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
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { typedSupabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import RentForm from "@/components/forms/RentForm";
import * as XLSX from "xlsx"; // Import for Excel export

export default function Rent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch rent data from the database with improved join
  const { data: rentData = [], isLoading } = useQuery({
    queryKey: ["rents"],
    queryFn: async () => {
      const { data, error } = await typedSupabase
        .from("rents")
        .select(`
          id,
          tenant_id,
          due_date,
          amount,
          is_paid,
          paid_on,
          whatsapp_sent,
          custom_message,
          tenants (
            id,
            name,
            phone,
            flat_id,
            flats (
              id,
              name,
              address
            )
          )
        `);

      if (error) {
        console.error("Error fetching rent data:", error);
        throw error;
      }

      return data.map((rent) => ({
        id: rent.id,
        tenant_id: rent.tenant_id,
        tenant: rent.tenants?.name || "Unknown",
        phone: rent.tenants?.phone || "",
        flat_id: rent.tenants?.flat_id || null,
        flatName: rent.tenants?.flats?.name || "Unknown",
        flatAddress: rent.tenants?.flats?.address || "",
        dueDate: rent.due_date ? new Date(rent.due_date).toLocaleDateString() : "N/A",
        amount: rent.amount,
        status: rent.is_paid ? "paid" : "pending",
        paidOn: rent.paid_on ? new Date(rent.paid_on).toLocaleDateString() : null,
        whatsappSent: rent.whatsapp_sent,
        customMessage: rent.custom_message,
      }));
    },
  });

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
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete rent record.",
      });
    },
  });

  // Mutation to mark a rent record as paid
  const markAsPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      // First create a payment transaction record
      const currentDate = new Date().toISOString().slice(0, 10);
      const { data: rentData, error: rentError } = await typedSupabase
        .from("rents")
        .select("amount, tenant_id")
        .eq("id", id)
        .single();
      
      if (rentError) throw rentError;
      
      // Create payment transaction record
      const { error: transactionError } = await typedSupabase
        .from("payment_transactions")
        .insert({
          rent_id: id,
          tenant_id: rentData.tenant_id,
          amount: rentData.amount,
          payment_date: currentDate,
          payment_method: "cash", // Default, can be updated in a more advanced form
          transaction_reference: `Manual-${Date.now()}`,
        });
      
      if (transactionError) throw transactionError;
      
      // Update rent record
      const { error } = await typedSupabase
        .from("rents")
        .update({ 
          is_paid: true, 
          paid_on: currentDate 
        })
        .eq("id", id);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rents"] });
      toast({
        title: "Marked as Paid",
        description: "The rent record has been marked as paid and payment transaction recorded.",
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

  // Function to send a reminder with custom message support
  const sendReminder = async (rentId, tenantId, tenantName, phone, amount, dueDate, customMessage = null) => {
    // Get any custom message for this rent or use the default message
    let message;
    if (customMessage) {
      message = customMessage;
    } else {
      message = `Hi ${tenantName}, your rent payment of ₹${amount.toLocaleString()} is due on ${dueDate}. Please make the payment at your earliest convenience.`;
    }
    
    const formattedNumber = phone.startsWith("+") ? phone.substring(1) : phone;
    const whatsappMessage = encodeURIComponent(message);
    const whatsappURL = `https://wa.me/${formattedNumber}?text=${whatsappMessage}`;

    try {
      // Record the WhatsApp message
      await typedSupabase.from("whatsapp_messages").insert({
        tenant_id: tenantId,
        message,
        recipient_phone: phone,
      });
      
      // Update the rent record to indicate a reminder was sent
      await typedSupabase
        .from("rents")
        .update({ 
          whatsapp_sent: true,
          last_reminder_date: new Date().toISOString().slice(0, 10)
        })
        .eq("id", rentId);
        
      // Open WhatsApp
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

  // Function to send reminders to all tenants with pending payments
  const sendRemindersToAll = async () => {
    const pendingRents = rentData.filter((rent) => rent.status === "pending");
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
    toast({
      title: "Reminders Sent",
      description: "Reminders have been sent to all tenants with pending payments.",
    });
  };

  // Function to export data as Excel with improved data
  const exportDataAsExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      rentData.map((rent) => ({
        Tenant: rent.tenant,
        "Flat": rent.flatName,
        "Address": rent.flatAddress,
        "Phone": rent.phone,
        "Due Date": rent.dueDate,
        Amount: rent.amount,
        Status: rent.status === "paid" ? "Paid" : "Pending",
        "Payment Date": rent.paidOn || "N/A",
        "Reminder Sent": rent.whatsappSent ? "Yes" : "No"
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rent Data");
    XLSX.writeFile(workbook, "RentData.xlsx");
    toast({
      title: "Export Successful",
      description: "Rent data has been exported as an Excel file.",
    });
  };

  // Calculate statistics
  const calculateStats = (data) => {
    const totalTarget = data.reduce((sum, item) => sum + item.amount, 0);
    const totalPaid = data.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
    const pendingAmount = data.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amount, 0);
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

  const stats = calculateStats(rentData);

  // Filter rent data based on search query with improved fields
  const filteredRentData = rentData.filter(
    (rent) =>
      rent.tenant.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rent.flatName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rent.phone && rent.phone.includes(searchQuery))
  );

  // Function to open custom message modal
  const [customMessageModalOpen, setCustomMessageModalOpen] = useState(false);
  const [selectedRent, setSelectedRent] = useState(null);
  const [customMessageText, setCustomMessageText] = useState("");

  const openCustomMessageModal = (rent) => {
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
        
      // Update local data
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

  if (isLoading) {
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
              <span className="ml-2 text-sm text-gray-500">of ₹{stats.targetCollection.toLocaleString()}</span>
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
                {stats.paidCount}/{stats.paidCount + stats.pendingCount} Payments received
              </span>
              <span className="text-xs text-gray-500">
                {stats.targetCollection > 0
                  ? `${((stats.totalCollection / stats.targetCollection) * 100).toFixed(1)}% collected`
                  : "0% collected"}
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
              onClick={sendRemindersToAll}
              disabled={stats.pendingCount === 0}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Send Reminder to All
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Export Data</CardTitle>
            <CardDescription>Export rent data as Excel</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" className="w-full" onClick={exportDataAsExcel}>
              <Download className="h-4 w-4 mr-2" />
              Export as Excel
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
              </TabsList>

              <div className="relative w-64">
                <Input
                  placeholder="Search tenants or flats..."
                  className="pl-10 pr-3 py-2"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>

            <TabsContent value="all">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tenant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Flat
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
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
                    {filteredRentData.map((rent) => (
                      <tr key={rent.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {rent.tenant}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {rent.flatName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rent.dueDate}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₹{rent.amount.toLocaleString()}
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
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openCustomMessageModal(rent)}
                              title="Custom Message"
                            >
                              <CreditCard className="h-4 w-4" />
                            </Button>
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
            </TabsContent>
            
            <TabsContent value="paid">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  {/* Same table structure but filtered for paid entries */}
                  <thead className="bg-gray-50">
                    {/* Same header as above */}
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tenant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Flat
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
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
                    {filteredRentData
                      .filter((rent) => rent.status === "paid")
                      .map((rent) => (
                        <tr key={rent.id} className="hover:bg-gray-50">
                          {/* Same cell structure as above */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {rent.tenant}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {rent.flatName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rent.dueDate}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ₹{rent.amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Paid
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {rent.paidOn || "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => deleteRentMutation.mutate(rent.id)}
                              title="Delete Rent Record"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
            
            <TabsContent value="pending">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  {/* Same table structure but filtered for pending entries */}
                  <thead className="bg-gray-50">
                    {/* Same header as above */}
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tenant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Flat
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRentData
                      .filter((rent) => rent.status === "pending")
                      .map((rent) => (
                        <tr key={rent.id} className="hover:bg-gray-50">
                          {/* Same cell structure as above */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {rent.tenant}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {rent.flatName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rent.dueDate}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ₹{rent.amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800">
                              Pending
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
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
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => openCustomMessageModal(rent)}
                                title="Custom Message"
                              >
                                <CreditCard className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => deleteRentMutation.mutate(rent.id)}
                                title="Delete Rent Record"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => markAsPaidMutation.mutate(rent.id)}
                                title="Mark as Paid"
                              >
                                Mark as Paid
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modal for custom message */}
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