import { ArrowLeft, Building2, CalendarDays, Download, Edit, FilePlus, IndianRupee, Package2, Phone, Send, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { typedSupabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Database } from "@/integrations/supabase/types";
import WhatsAppIntegration from "@/components/integrations/WhatsAppIntegration";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Tenant = Database['public']['Tables']['tenants']['Row'] & {
  flat?: {
    name: string;
    address: string;
  } | null;
  rents?: any[];
  documents?: string[];
  tenant_photo?: string | null;
};

export default function TenantDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignFlatOpen, setAssignFlatOpen] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [assignFurnitureOpen, setAssignFurnitureOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "" });
  const [selectedFlat, setSelectedFlat] = useState("");
  const [paymentForm, setPaymentForm] = useState({ amount: "", paidOn: "" });
  const [selectedFurniture, setSelectedFurniture] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);

  // Fetch tenant data
  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ['tenant', id],
    queryFn: async () => {
      if (!id) throw new Error("Tenant ID is required");
      const { data, error } = await typedSupabase
        .from('tenants')
        .select(`
          *,
          flat:flats (
            name,
            address
          ),
          rents (
            id,
            amount,
            due_date,
            is_paid,
            paid_on
          ),
          documents,
          tenant_photo,
          tenant_furniture (
            furniture_item_id,
            furniture_items (
              id,
              name
            )
          )
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      if (!data) throw new Error("Tenant not found");
      return data as Tenant & { tenant_furniture?: { furniture_item_id: string; furniture_items: { id: string; name: string } }[] };
    },
    enabled: !!id,
  });

  // Fetch flats for assignment
  const { data: flats } = useQuery({
    queryKey: ['flats'],
    queryFn: async () => {
      const { data, error } = await typedSupabase.from('flats').select('id, name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch furniture items
  const { data: furnitureItems } = useQuery({
    queryKey: ['furniture_items'],
    queryFn: async () => {
      const { data, error } = await typedSupabase.from('furniture_items').select('id, name');
      if (error) throw error;
      return data;
    },
  });

  // Edit tenant mutation
  const editTenant = useMutation({
    mutationFn: async ({ name, phone, email }: { name: string; phone: string; email: string }) => {
      const { error } = await typedSupabase
        .from('tenants')
        .update({ name, phone, email })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
      toast({ title: "Success", description: "Tenant updated successfully" });
      setEditOpen(false);
    },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Failed to update tenant" }),
  });

  // Assign flat mutation
  const assignFlat = useMutation({
    mutationFn: async (flatId: string) => {
      const { error } = await typedSupabase
        .from('tenants')
        .update({ flat_id: flatId })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
      toast({ title: "Success", description: "Flat assigned successfully" });
      setAssignFlatOpen(false);
    },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Failed to assign flat" }),
  });

  // Record payment mutation
  const recordPayment = useMutation({
    mutationFn: async ({ amount, paidOn }: { amount: number; paidOn: string }) => {
      const pendingRent = tenant?.rents?.find(rent => !rent.is_paid);
      if (!pendingRent) throw new Error("No pending rent found");
      const { error } = await typedSupabase
        .from('rents')
        .update({ is_paid: true, paid_on: paidOn, amount })
        .eq('id', pendingRent.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
      toast({ title: "Success", description: "Payment recorded successfully" });
      setRecordPaymentOpen(false);
    },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Failed to record payment" }),
  });

  // Assign furniture mutation
  const assignFurniture = useMutation({
    mutationFn: async (furnitureItemId: string) => {
      const { error } = await typedSupabase
        .from('tenant_furniture')
        .insert({ tenant_id: id, furniture_item_id: furnitureItemId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
      toast({ title: "Success", description: "Furniture assigned successfully" });
      setAssignFurnitureOpen(false);
    },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Failed to assign furniture" }),
  });

  // Upload document mutation
  const uploadDocument = useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await typedSupabase.storage
        .from('tenant-documents')
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = typedSupabase.storage
        .from('tenant-documents')
        .getPublicUrl(fileName);

      const newDocuments = [...(tenant?.documents || []), urlData.publicUrl];
      const { error: updateError } = await typedSupabase
        .from('tenants')
        .update({ documents: newDocuments })
        .eq('id', id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
      toast({ title: "Success", description: "Document uploaded successfully" });
      setUploadDocOpen(false);
      setDocFile(null);
    },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Failed to upload document" }),
  });

  // Export rent history
  const exportRentHistory = () => {
    const csv = [
      ["Month", "Due Date", "Amount", "Status", "Paid On"],
      ...(tenant?.rents?.map(rent => [
        new Date(rent.due_date).toLocaleString('default', { month: 'long', year: 'numeric' }),
        new Date(rent.due_date).toLocaleDateString(),
        rent.amount,
        rent.is_paid ? "Paid" : "Pending",
        rent.paid_on ? new Date(rent.paid_on).toLocaleDateString() : "-",
      ]) || []),
    ]
      .map(row => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rent_history_${tenant?.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Success", description: "Rent history exported" });
  };

  if (isLoading) {
    return <div>Loading tenant details...</div>;
  }

  if (error || !tenant) {
    return (
      <div className="p-4">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Tenant</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{(error as Error)?.message || "Tenant not found"}</p>
            <Link to="/tenants">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tenants
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formattedRents = tenant.rents?.map(rent => ({
    id: rent.id,
    month: new Date(rent.due_date).toLocaleString('default', { month: 'long', year: 'numeric' }),
    dueDate: new Date(rent.due_date).toLocaleDateString(),
    amount: rent.amount,
    status: rent.is_paid ? "paid" : "pending",
    paidOn: rent.paid_on ? new Date(rent.paid_on).toLocaleDateString() : "-",
  })) || [];

  const totalPaid = formattedRents
    .filter(rent => rent.status === "paid")
    .reduce((sum, rent) => sum + rent.amount, 0);

  const pendingAmount = formattedRents
    .filter(rent => rent.status !== "paid")
    .reduce((sum, rent) => sum + rent.amount, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center mb-6">
        <Link to="/tenants" className="mr-4">
          <Button variant="outline" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{tenant.name}</h1>
          <p className="text-gray-500">Tenant Details</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Personal Info</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditForm({ name: tenant.name, phone: tenant.phone, email: tenant.email || "" });
                  setEditOpen(true);
                }}
              >
                <Edit className="h-4 w-4 mr-1" /> Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center mb-4">
              {tenant.tenant_photo ? (
                <img
                  src={tenant.tenant_photo}
                  alt={`${tenant.name}'s photo`}
                  className="h-24 w-24 rounded-full object-cover mb-2"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                  <span className="text-3xl font-medium text-gray-600">
                    {tenant.name.split(" ").map(n => n[0]).join("")}
                  </span>
                </div>
              )}
              <h3 className="text-lg font-medium">{tenant.name}</h3>
              <span className={`px-2 mt-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                tenant.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
              }`}>
                {tenant.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center">
                <Phone className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm">{tenant.phone}</span>
              </div>
              {tenant.email && (
                <div className="flex items-center">
                  <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm">{tenant.email}</span>
                </div>
              )}
              <div className="flex items-center">
                <CalendarDays className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm">Joined on {new Date(tenant.start_date).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                className="w-full gap-1"
                onClick={() => setWhatsappOpen(true)}
              >
                <Send className="h-4 w-4" /> Send WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Flat Details</CardTitle>
          </CardHeader>
          <CardContent>
            {tenant.flat ? (
              <div className="flex items-center mb-4">
                <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-blue-100 rounded-full mr-3">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium">{tenant.flat.name}</h3>
                  <p className="text-sm text-gray-500">{tenant.flat.address}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <Building2 className="h-10 w-10 text-gray-300 mb-2" />
                <p className="text-gray-500">No flat assigned</p>
                <Button
                  variant="outline"
                  className="mt-3"
                  size="sm"
                  onClick={() => setAssignFlatOpen(true)}
                >
                  Assign Flat
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Total Paid</p>
                <p className="text-xl font-semibold text-green-600">₹{totalPaid.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">
                  for {formattedRents.filter(r => r.status === "paid").length} payments
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Pending</p>
                <p className="text-xl font-semibold text-gray-900">₹{pendingAmount.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {pendingAmount === 0 ? "All paid" : `${formattedRents.filter(r => r.status !== "paid").length} pending`}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <Button
                className="w-full gap-1"
                onClick={() => setRecordPaymentOpen(true)}
                disabled={pendingAmount === 0}
              >
                <IndianRupee className="h-4 w-4" /> Record Payment
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rent">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rent">Rent History</TabsTrigger>
          <TabsTrigger value="furniture">Assigned Furniture</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="rent">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Rent History</CardTitle>
                <Button variant="outline" size="sm" onClick={exportRentHistory}>
                  <Download className="h-4 w-4 mr-1" /> Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {formattedRents.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-gray-500">No rent history available</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {formattedRents.map((rent) => (
                        <tr key={rent.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{rent.month}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rent.dueDate}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{rent.amount.toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              rent.status === "paid" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}>
                              {rent.status.charAt(0).toUpperCase() + rent.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rent.paidOn}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="furniture">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Assigned Furniture</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAssignFurnitureOpen(true)}
                >
                  <Package2 className="h-4 w-4 mr-1" /> Assign More
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tenant.tenant_furniture && tenant.tenant_furniture.length > 0 ? (
                <ul className="space-y-2">
                  {tenant.tenant_furniture.map((item) => (
                    <li key={item.furniture_item_id} className="text-sm">
                      {item.furniture_items.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-10">
                  <p className="text-gray-500">No furniture assigned yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Documents</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUploadDocOpen(true)}
                >
                  <FilePlus className="h-4 w-4 mr-1" /> Upload
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tenant.documents && tenant.documents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tenant.documents.map((doc, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <a
                        href={doc}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm truncate">{doc.split("/").pop()}</span>
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 border border-dashed rounded-lg">
                  <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-sm font-medium text-gray-900 mb-1">No documents uploaded</h3>
                  <p className="text-xs text-gray-500">Click to upload</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Tenant Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => editTenant.mutate(editForm)}
              disabled={editTenant.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Flat Modal */}
      <Dialog open={assignFlatOpen} onOpenChange={setAssignFlatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Flat</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="flat">Select Flat</Label>
            <Select value={selectedFlat} onValueChange={setSelectedFlat}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a flat" />
              </SelectTrigger>
              <SelectContent>
                {flats?.map((flat) => (
                  <SelectItem key={flat.id} value={flat.id}>
                    {flat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignFlatOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => assignFlat.mutate(selectedFlat)}
              disabled={!selectedFlat || assignFlat.isPending}
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Modal */}
      <Dialog open={recordPaymentOpen} onOpenChange={setRecordPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="paidOn">Paid On</Label>
              <Input
                id="paidOn"
                type="date"
                value={paymentForm.paidOn}
                onChange={(e) => setPaymentForm({ ...paymentForm, paidOn: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordPaymentOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => recordPayment.mutate({
                amount: parseFloat(paymentForm.amount),
                paidOn: paymentForm.paidOn,
              })}
              disabled={!paymentForm.amount || !paymentForm.paidOn || recordPayment.isPending}
            >
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Furniture Modal */}
      <Dialog open={assignFurnitureOpen} onOpenChange={setAssignFurnitureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Furniture</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="furniture">Select Furniture</Label>
            <Select value={selectedFurniture} onValueChange={setSelectedFurniture}>
              <SelectTrigger>
                <SelectValue placeholder="Choose furniture" />
              </SelectTrigger>
              <SelectContent>
                {furnitureItems?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignFurnitureOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => assignFurniture.mutate(selectedFurniture)}
              disabled={!selectedFurniture || assignFurniture.isPending}
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Modal */}
      <Dialog open={uploadDocOpen} onOpenChange={setUploadDocOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="document">Select Document</Label>
            <Input
              id="document"
              type="file"
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDocOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => docFile && uploadDocument.mutate(docFile)}
              disabled={!docFile || uploadDocument.isPending}
            >
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {whatsappOpen && (
        <Card className="mt-6 p-4">
          <CardHeader>
            <CardTitle>Send WhatsApp Message</CardTitle>
          </CardHeader>
          <CardContent>
            <WhatsAppIntegration tenantId={id} phone={tenant.phone} />
          </CardContent>
          <div className="flex justify-end p-4 pt-0">
            <Button variant="outline" onClick={() => setWhatsappOpen(false)}>
              Close
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}