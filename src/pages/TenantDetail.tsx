import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Download,
  Edit,
  FilePlus,
  IndianRupee,
  Package2,
  Phone,
  Send,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { typedSupabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import WhatsAppIntegration from "@/components/integrations/WhatsAppIntegration";

interface Tenant {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  start_date: string;
  is_active: boolean;
  tenant_photo: string | null;
  flat?: {
    name: string;
    address: string;
  } | null;
  rents?: {
    id: string;
    amount: number;
    due_date: string;
    is_paid: boolean;
    paid_on: string | null;
  }[];
  tenant_furniture?: {
    furniture_item_id: string;
    furniture_items: { id: string; name: string };
  }[];
}

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
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
  const [docName, setDocName] = useState("");

  // Fetch tenant data
  const {
    data: tenant,
    isLoading,
    error,
  } = useQuery<Tenant, Error>({
    queryKey: ["tenant", id],
    queryFn: async () => {
      if (!id) throw new Error("Tenant ID is required");
      const { data, error } = await typedSupabase
        .from("tenants")
        .select(
          `
          id, name, phone, email, start_date, is_active, tenant_photo,
          flat:flats (name, address),
          rents (id, amount, due_date, is_paid, paid_on),
          property_documents (id, file_path, name),
          tenant_furniture (furniture_item_id, furniture_items (id, name))
        `
        )
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message || "Tenant not found");
      if (!data) throw new Error("Tenant not found");
      return data as Tenant;
    },
    enabled: !!id,
  });

  // Refetch tenant details when the component is mounted or any dialog is closed
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["tenant", id] });
  }, [editOpen, assignFlatOpen, recordPaymentOpen, uploadDocOpen, assignFurnitureOpen]);

  // Fetch flats for assignment
  const { data: flats } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["flats"],
    queryFn: async () => {
      const { data, error } = await typedSupabase
        .from("flats")
        .select("id, name");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  // Fetch furniture items
  const { data: furnitureItems } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["furniture_items"],
    queryFn: async () => {
      const { data, error } = await typedSupabase
        .from("furniture_items")
        .select("id, name");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  // Edit tenant mutation
  const editTenant = useMutation({
    mutationFn: async ({
      name,
      phone,
      email,
    }: {
      name: string;
      phone: string;
      email: string;
    }) => {
      const { error } = await typedSupabase
        .from("tenants")
        .update({ name, phone, email })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant", id] });
      toast({
        title: "Success",
        description: "Tenant updated successfully",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      setEditOpen(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update tenant",
      });
    },
  });

  // Assign flat mutation
  const assignFlat = useMutation({
    mutationFn: async (flatId: string) => {
      const { error } = await typedSupabase
        .from("tenants")
        .update({ flat_id: flatId })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant", id] });
      queryClient.invalidateQueries({ queryKey: ["flats"] });
      toast({
        title: "Success",
        description: "Flat assigned successfully",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      setAssignFlatOpen(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to assign flat",
      });
    },
  });

  // Record payment mutation
  const recordPayment = useMutation({
    mutationFn: async ({
      amount,
      paidOn,
    }: {
      amount: number;
      paidOn: string;
    }) => {
      const pendingRent = tenant?.rents?.find((rent) => !rent.is_paid);
      if (!pendingRent) throw new Error("No pending rent found");
      const { error } = await typedSupabase
        .from("rents")
        .update({ is_paid: true, paid_on: paidOn, amount })
        .eq("id", pendingRent.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant", id] });
      toast({
        title: "Success",
        description: "Payment recorded successfully",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      setRecordPaymentOpen(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to record payment",
      });
    },
  });

  // Assign furniture mutation
  const assignFurniture = useMutation({
    mutationFn: async (furnitureItemId: string) => {
      const { error } = await typedSupabase
        .from("tenant_furniture")
        .insert({
          tenant_id: id,
          furniture_item_id: furnitureItemId,
          rent_part: 0,
        });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant", id] });
      toast({
        title: "Success",
        description: "Furniture assigned successfully",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      setAssignFurnitureOpen(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to assign furniture",
      });
    },
  });

  // Upload document mutation
  const uploadDocument = useMutation({
    mutationFn: async ({ file, name }: { file: File; name: string }) => {
      const fileExt = file.name.split(".").pop();
      const fileName = `${id}/${Date.now()}.${fileExt}`;
      try {
        const { error: uploadError } = await typedSupabase.storage
          .from("property_documents")
          .upload(fileName, file, { cacheControl: "3600", upsert: false });
        if (uploadError)
          throw new Error(`Storage error: ${uploadError.message}`);

        const { error: insertError } = await typedSupabase
          .from("property_documents")
          .insert({
            tenant_id: id,
            file_path: fileName,
            name: name || file.name,
            document_type: "other",
            uploaded_at: new Date().toISOString(),
          });
        if (insertError)
          throw new Error(`Database error: ${insertError.message}`);
      } catch (err: any) {
        console.error("Upload error:", err);
        throw new Error(err.message || "Failed to upload document");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant", id] });
      toast({
        title: "Success",
        description: "Document uploaded successfully",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      setUploadDocOpen(false);
      setDocFile(null);
      setDocName("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to upload document",
      });
    },
  });

  // Export rent history
  const exportRentHistory = () => {
    const csv = [
      ["Month", "Due Date", "Amount", "Status", "Paid On"],
      ...(tenant?.rents?.map((rent) => [
        new Date(rent.due_date).toLocaleString("default", {
          month: "long",
          year: "numeric",
        }),
        new Date(rent.due_date).toLocaleDateString(),
        rent.amount,
        rent.is_paid ? "Paid" : "Pending",
        rent.paid_on ? new Date(rent.paid_on).toLocaleDateString() : "-",
      ]) || []),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rent_history_${tenant?.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Success",
      description: "Rent history exported",
      className: "bg-luxury-gold text-luxury-charcoal border-none",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Building2 className="h-12 w-12 text-gray-400 animate-spin" />
          <p className="text-gray-600 text-lg font-semibold">
            Loading tenant details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="p-4">
        <Card className="border-red-200 bg-red-50 shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="text-red-600 text-xl font-semibold tracking-wide">
              Error Loading Tenant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">
              {error?.message || "Tenant not found"}
            </p>
            <Link to="/tenants">
              <Button
                variant="outline"
                className="mt-4 border-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/20"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tenants
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formattedRents =
    tenant.rents?.map((rent) => ({
      id: rent.id,
      month: new Date(rent.due_date).toLocaleString("default", {
        month: "long",
        year: "numeric",
      }),
      dueDate: new Date(rent.due_date).toLocaleDateString(),
      amount: rent.amount,
      status: rent.is_paid ? "paid" : "pending",
      paidOn: rent.paid_on ? new Date(rent.paid_on).toLocaleDateString() : "-",
    })) || [];

  const totalPaid = formattedRents
    .filter((rent) => rent.status === "paid")
    .reduce((sum, rent) => sum + rent.amount, 0);

  const pendingAmount = formattedRents
    .filter((rent) => rent.status !== "paid")
    .reduce((sum, rent) => sum + rent.amount, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 bg-luxury-softwhite min-h-screen">
      <div className="flex items-center mb-6">
        <Link to="/tenants" className="mr-4">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-luxury-cream hover:bg-luxury-gold/20"
          >
            <ArrowLeft className="h-4 w-4 text-luxury-charcoal" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-luxury-charcoal">
            {tenant.name}
          </h1>
          <p className="text-luxury-charcoal/70">Tenant Details</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="bg-white shadow-lg border border-luxury-cream">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-luxury-charcoal">
                Personal Info
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditForm({
                    name: tenant.name,
                    phone: tenant.phone,
                    email: tenant.email || "",
                  });
                  setEditOpen(true);
                }}
                className="text-luxury-charcoal hover:bg-luxury-gold/20"
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
                <div className="h-24 w-24 rounded-full bg-luxury-cream flex items-center justify-center mb-2">
                  <span className="text-3xl font-medium text-luxury-charcoal">
                    {tenant.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                </div>
              )}
              <h3 className="text-lg font-medium text-luxury-charcoal">
                {tenant.name}
              </h3>
              <span
                className={`px-2 mt-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  tenant.is_active
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {tenant.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center">
                <Phone className="h-4 w-4 text-luxury-charcoal/50 mr-2" />
                <span className="text-sm text-luxury-charcoal">
                  {tenant.phone}
                </span>
              </div>
              {tenant.email && (
                <div className="flex items-center">
                  <svg
                    className="h-4 w-4 text-luxury-charcoal/50 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="text-sm text-luxury-charcoal">
                    {tenant.email}
                  </span>
                </div>
              )}
              <div className="flex items-center">
                <CalendarDays className="h-4 w-4 text-luxury-charcoal/50 mr-2" />
                <span className="text-sm text-luxury-charcoal">
                  Joined on {new Date(tenant.start_date).toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                className="w-full gap-1 border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal"
                onClick={() => setWhatsappOpen(true)}
              >
                <Send className="h-4 w-4" /> Send WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-lg border border-luxury-cream">
          <CardHeader>
            <CardTitle className="text-luxury-charcoal">Flat Details</CardTitle>
          </CardHeader>
          <CardContent>
            {tenant.flat ? (
              <div className="flex items-center mb-4">
                <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-luxury-gold/10 rounded-full mr-3">
                  <Building2 className="h-5 w-5 text-luxury-gold" />
                </div>
                <div>
                  <h3 className="font-medium text-luxury-charcoal">
                    {tenant.flat.name}
                  </h3>
                  <p className="text-sm text-luxury-charcoal/70">
                    {tenant.flat.address}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <Building2 className="h-10 w-10 text-luxury-charcoal/30 mb-2" />
                <p className="text-luxury-charcoal/70">No flat assigned</p>
                <Button
                  variant="outline"
                  className="mt-3 border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal"
                  size="sm"
                  onClick={() => setAssignFlatOpen(true)}
                >
                  Assign Flat
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white shadow-lg border border-luxury-cream">
          <CardHeader>
            <CardTitle className="text-luxury-charcoal">
              Payment Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-luxury-cream p-3 rounded-lg">
                <p className="text-xs text-luxury-charcoal/70 mb-1">
                  Total Paid
                </p>
                <p className="text-xl font-semibold text-emerald-600">
                  ₹{totalPaid.toLocaleString()}
                </p>
                <p className="text-xs text-luxury-charcoal/70 mt-1">
                  for {formattedRents.filter((r) => r.status === "paid").length}{" "}
                  payments
                </p>
              </div>
              <div className="bg-luxury-cream p-3 rounded-lg">
                <p className="text-xs text-luxury-charcoal/70 mb-1">Pending</p>
                <p className="text-xl font-semibold text-luxury-charcoal">
                  ₹{pendingAmount.toLocaleString()}
                </p>
                <p className="text-xs text-luxury-charcoal/70 mt-1">
                  {pendingAmount === 0
                    ? "All paid"
                    : `${
                        formattedRents.filter((r) => r.status !== "paid").length
                      } pending`}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <Button
                className="w-full gap-1 bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
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
        <TabsList className="grid w-full grid-cols-3 bg-luxury-cream/50">
          <TabsTrigger value="rent" className="text-luxury-charcoal">
            Rent History
          </TabsTrigger>
          <TabsTrigger value="furniture" className="text-luxury-charcoal">
            Assigned Furniture
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-luxury-charcoal">
            Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rent">
          <Card className="bg-white shadow-lg border border-luxury-cream">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-luxury-charcoal">
                  Rent History
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportRentHistory}
                  className="border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal"
                >
                  <Download className="h-4 w-4 mr-1" /> Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {formattedRents.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-luxury-charcoal/70">
                    No rent history available
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-luxury-cream">
                    <thead>
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-luxury-charcoal uppercase tracking-wider">
                          Month
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-luxury-charcoal uppercase tracking-wider">
                          Due Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-luxury-charcoal uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-luxury-charcoal uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-luxury-charcoal uppercase tracking-wider">
                          Paid On
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-luxury-cream">
                      {formattedRents.map((rent) => (
                        <tr key={rent.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-luxury-charcoal">
                            {rent.month}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-luxury-charcoal/70">
                            {rent.dueDate}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-luxury-charcoal">
                            ₹{rent.amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                rent.status === "paid"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {rent.status.charAt(0).toUpperCase() +
                                rent.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-luxury-charcoal/70">
                            {rent.paidOn}
                          </td>
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
          <Card className="bg-white shadow-lg border border-luxury-cream">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-luxury-charcoal">
                  Assigned Furniture
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAssignFurnitureOpen(true)}
                  className="border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal"
                >
                  <Package2 className="h-4 w-4 mr-1" /> Assign More
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tenant.tenant_furniture && tenant.tenant_furniture.length > 0 ? (
                <ul className="space-y-2">
                  {tenant.tenant_furniture.map((item) => (
                    <li
                      key={item.furniture_item_id}
                      className="text-sm text-luxury-charcoal"
                    >
                      {item.furniture_items.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-10">
                  <p className="text-luxury-charcoal/70">
                    No furniture assigned yet
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card className="bg-white shadow-lg border border-luxury-cream">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-luxury-charcoal">
                  Documents
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUploadDocOpen(true)}
                  className="border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal"
                >
                  <FilePlus className="h-4 w-4 mr-1" /> Upload
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tenant.property_documents &&
              tenant.property_documents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tenant.property_documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="border border-luxury-cream rounded-lg p-4"
                    >
                      <a
                        href={
                          typedSupabase.storage
                            .from("property_documents")
                            .getPublicUrl(doc.file_path).data.publicUrl
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-2 text-luxury-gold hover:text-luxury-gold/80"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="text-sm truncate text-luxury-charcoal">
                          {doc.name}
                        </span>
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 border border-dashed border-luxury-cream rounded-lg">
                  <Upload className="h-10 w-10 text-luxury-charcoal/50 mx-auto mb-3" />
                  <h3 className="text-sm font-medium text-luxury-charcoal mb-1">
                    No documents uploaded
                  </h3>
                  <p className="text-xs text-luxury-charcoal/70">
                    Click to upload
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* WhatsApp Modal */}
      <WhatsAppIntegration
        open={whatsappOpen}
        onOpenChange={setWhatsappOpen}
        recipient={tenant}
      />

      {/* Edit Tenant Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-white border border-luxury-cream">
          <DialogHeader>
            <DialogTitle className="text-luxury-charcoal">
              Edit Tenant
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-luxury-charcoal">
                Name
              </Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                className="border-luxury-cream focus:ring-luxury-gold focus:border-luxury-gold"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-luxury-charcoal">
                Phone
              </Label>
              <Input
                id="phone"
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm({ ...editForm, phone: e.target.value })
                }
                className="border-luxury-cream focus:ring-luxury-gold focus:border-luxury-gold"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-luxury-charcoal">
                Email (Optional)
              </Label>
              <Input
                id="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
                className="border-luxury-cream focus:ring-luxury-gold focus:border-luxury-gold"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              className="border-luxury-cream text-luxury-charcoal hover:bg-luxury-gold/20"
            >
              Cancel
            </Button>
            <Button
              onClick={() => editTenant.mutate(editForm)}
              disabled={
                !editForm.name || !editForm.phone || editTenant.isPending
              }
              className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Flat Modal */}
      <Dialog open={assignFlatOpen} onOpenChange={setAssignFlatOpen}>
        <DialogContent className="bg-white border border-luxury-cream">
          <DialogHeader>
            <DialogTitle className="text-luxury-charcoal">
              Assign Flat
            </DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="flat" className="text-luxury-charcoal">
              Select Flat
            </Label>
            <Select value={selectedFlat} onValueChange={setSelectedFlat}>
              <SelectTrigger className="border-luxury-cream focus:ring-luxury-gold focus:border-luxury-gold">
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
            {flats?.length === 0 && (
              <p className="text-sm text-luxury-charcoal/70 mt-2">
                No flats available. Create a flat first.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignFlatOpen(false)}
              className="border-luxury-cream text-luxury-charcoal hover:bg-luxury-gold/20"
            >
              Cancel
            </Button>
            <Button
              onClick={() => assignFlat.mutate(selectedFlat)}
              disabled={!selectedFlat || assignFlat.isPending}
              className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Modal */}
      <Dialog open={recordPaymentOpen} onOpenChange={setRecordPaymentOpen}>
        <DialogContent className="bg-white border border-luxury-cream">
          <DialogHeader>
            <DialogTitle className="text-luxury-charcoal">
              Record Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount" className="text-luxury-charcoal">
                Amount (₹)
              </Label>
              <Input
                id="amount"
                type="number"
                value={paymentForm.amount}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, amount: e.target.value })
                }
                className="border-luxury-cream focus:ring-luxury-gold focus:border-luxury-gold"
              />
            </div>
            <div>
              <Label htmlFor="paidOn" className="text-luxury-charcoal">
                Paid On
              </Label>
              <Input
                id="paidOn"
                type="date"
                value={paymentForm.paidOn}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, paidOn: e.target.value })
                }
                className="border-luxury-cream focus:ring-luxury-gold focus:border-luxury-gold"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRecordPaymentOpen(false);
                setPaymentForm({ amount: "", paidOn: "" });
              }}
              className="border-luxury-cream text-luxury-charcoal hover:bg-luxury-gold/20"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                recordPayment.mutate({
                  amount: parseFloat(paymentForm.amount) || 0,
                  paidOn: paymentForm.paidOn,
                })
              }
              disabled={
                !paymentForm.amount ||
                !paymentForm.paidOn ||
                recordPayment.isPending
              }
              className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
            >
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Furniture Modal */}
      <Dialog open={assignFurnitureOpen} onOpenChange={setAssignFurnitureOpen}>
        <DialogContent className="bg-white border border-luxury-cream">
          <DialogHeader>
            <DialogTitle className="text-luxury-charcoal">
              Assign Furniture
            </DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="furniture" className="text-luxury-charcoal">
              Select Furniture
            </Label>
            <Select
              value={selectedFurniture}
              onValueChange={setSelectedFurniture}
            >
              <SelectTrigger className="border-luxury-cream focus:ring-luxury-gold focus:border-luxury-gold">
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
            {furnitureItems?.length === 0 && (
              <p className="text-sm text-luxury-charcoal/70 mt-2">
                No furniture items available. Add items first.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignFurnitureOpen(false)}
              className="border-luxury-cream text-luxury-charcoal hover:bg-luxury-gold/20"
            >
              Cancel
            </Button>
            <Button
              onClick={() => assignFurniture.mutate(selectedFurniture)}
              disabled={!selectedFurniture || assignFurniture.isPending}
              className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Modal */}
      <Dialog open={uploadDocOpen} onOpenChange={setUploadDocOpen}>
        <DialogContent className="bg-white border border-luxury-cream">
          <DialogHeader>
            <DialogTitle className="text-luxury-charcoal">
              Upload Document
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="docName" className="text-luxury-charcoal">
                Document Name
              </Label>
              <Input
                id="docName"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="e.g., ID Proof"
                className="border-luxury-cream focus:ring-luxury-gold focus:border-luxury-gold"
              />
            </div>
            <div>
              <Label htmlFor="document" className="text-luxury-charcoal">
                Select Document
              </Label>
              <Input
                id="document"
                type="file"
                onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                className="border-luxury-cream focus:ring-luxury-gold focus:border-luxury-gold"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadDocOpen(false);
                setDocFile(null);
                setDocName("");
              }}
              className="border-luxury-cream text-luxury-charcoal hover:bg-luxury-gold/20"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                docFile &&
                uploadDocument.mutate({
                  file: docFile,
                  name: docName || docFile.name,
                })
              }
              disabled={!docFile || uploadDocument.isPending}
              className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
            >
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
