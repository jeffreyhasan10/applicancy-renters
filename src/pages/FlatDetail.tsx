import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Building2,
  Edit,
  FilePlus,
  Upload,
  Users2,
  Calendar,
  Banknote,
  Shield,
  Tag,
  FileText,
  Phone,
  Mail,
  Trash2,
  Wrench,
  Send,
  Link as LinkIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { typedSupabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea"; // Added for maintenance request description
import FlatForm from "@/components/forms/FlatForm";
import WhatsAppIntegration from "@/components/integrations/WhatsAppIntegration";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";

interface Flat {
  id: string;
  name: string;
  address: string;
  monthly_rent_target: number; // Schema: NOT NULL
  description: string | null;
  created_at: string;
  security_deposit: number | null;
  tenants: { id: string; name: string; phone: string; email?: string }[] | null;
  property_documents:
    | {
        id: string;
        file_path: string;
        name: string;
        uploaded_at: string | null;
      }[]
    | null;
  property_tags: { id: string; tag_name: string }[] | null;
}

interface TenantForm {
  name: string;
  phone: string;
  email?: string;
}

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  tenant?: { id: string; name: string } | null;
}

interface MaintenanceForm {
  title: string;
  description: string;
  priority: string;
  tenant_id: string | null;
}

interface Rent {
  id: string;
  tenant_id: string;
  due_date: string;
  amount: number;
  is_paid: boolean;
  paid_on: string | null;
  whatsapp_sent: boolean;
  tenant?: { id: string; name: string; phone: string };
  payment_links?: {
    id: string;
    payment_link: string;
    status: string;
    expires_at: string;
  }[];
}

interface PaymentLinkData {
  link: string;
  id: string;
  tenant_id: string;
}

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } },
};

const FlatDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [addTenantOpen, setAddTenantOpen] = useState(false);
  const [assignTenantOpen, setAssignTenantOpen] = useState(false);
  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [deleteDocOpen, setDeleteDocOpen] = useState(false);
  const [createMaintenanceOpen, setCreateMaintenanceOpen] = useState(false); // New state for maintenance dialog
  const [sendPaymentLinksOpen, setSendPaymentLinksOpen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false); // Confirmation for closing payment links
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [tenantForm, setTenantForm] = useState<TenantForm>({
    name: "",
    phone: "",
    email: "",
  });
  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceForm>({
    title: "",
    description: "",
    priority: "medium",
    tenant_id: null,
  });
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docName, setDocName] = useState<string>("");
  const [docType, setDocType] = useState<string>("other"); // New state for document type
  const [activeTab, setActiveTab] = useState("details");
  const [paymentLinksData, setPaymentLinksData] = useState<PaymentLinkData[]>(
    []
  );
  const [rentAmount, setRentAmount] = useState<string>("");
  const [rentDescription, setRentDescription] =
    useState<string>("Rent Payment");
  const [expiryDays, setExpiryDays] = useState<string>("7");
  const [page, setPage] = useState(1); // Pagination state
  const itemsPerPage = 10;

  // Refetch flat details when the component is mounted or any dialog is closed
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["flat", id] });
  }, [editOpen, addTenantOpen, assignTenantOpen, uploadDocOpen, deleteDocOpen, createMaintenanceOpen, sendPaymentLinksOpen]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setPage(1); // Reset pagination on tab change
  };

  // Fetch flat data
  const {
    data: flat,
    isLoading,
    error,
  } = useQuery<Flat, Error>({
    queryKey: ["flat", id],
    queryFn: async () => {
      if (!id) throw new Error("Flat ID is required");
      const { data, error } = await typedSupabase
        .from("flats")
        .select(
          `
          id, name, address, monthly_rent_target, description, created_at, security_deposit,
          tenants (id, name, phone, email),
          property_documents (id, file_path, name, uploaded_at, document_type),
          property_tags (id, tag_name)
        `
        )
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message || "Flat not found");
      if (!data) throw new Error("Flat not found");
      return {
        ...data,
        property_documents: data.property_documents || [],
      } as Flat;
    },
    enabled: !!id,
  });

  // Fetch available tenants
  const { data: availableTenants, isLoading: tenantsLoading } = useQuery<
    { id: string; name: string; phone: string }[]
  >({
    queryKey: ["available_tenants"],
    queryFn: async () => {
      const { data, error } = await typedSupabase
        .from("tenants")
        .select("id, name, phone")
        .is("flat_id", null)
        .eq("is_active", true);
      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  // Fetch maintenance requests with pagination
  const { data: maintenanceRequests, isLoading: maintenanceLoading } = useQuery<
    MaintenanceRequest[]
  >({
    queryKey: ["maintenance_requests", id, page],
    queryFn: async () => {
      const { data, error } = await typedSupabase
        .from("maintenance_requests")
        .select(
          `
          id, title, description, status, priority, created_at,
          tenant:tenants (id, name)
        `
        )
        .eq("flat_id", id)
        .range((page - 1) * itemsPerPage, page * itemsPerPage - 1)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch rents with pagination
  const { data: rents, isLoading: rentsLoading } = useQuery<Rent[]>({
    queryKey: ["rents", id, page],
    queryFn: async () => {
      const { data, error } = await typedSupabase
        .from("rents")
        .select(
          `
        id, tenant_id, due_date, amount, is_paid, paid_on, whatsapp_sent,
        tenant:tenants(id, name, phone, flat_id),
        payment_links(id, payment_link, status, expires_at)
      `
        )
        .eq("tenant.flat_id", id)
        .range((page - 1) * itemsPerPage, page * itemsPerPage - 1)
        .order("due_date", { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!id,
  });

  // Add tenant mutation
  const addTenantMutation = useMutation({
    mutationFn: async ({ name, phone, email }: TenantForm) => {
      const { data, error } = await typedSupabase
        .from("tenants")
        .insert({
          name,
          phone,
          email: email || null,
          flat_id: id,
          start_date: new Date().toISOString().split("T")[0],
          is_active: true,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flat", id] });
      queryClient.invalidateQueries({ queryKey: ["flats"] });
      toast({
        title: "Success",
        description: "Tenant added successfully",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      setAddTenantOpen(false);
      setTenantForm({ name: "", phone: "", email: "" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add tenant",
      });
    },
  });

  // Assign tenant mutation
  const assignTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const { error } = await typedSupabase
        .from("tenants")
        .update({
          flat_id: id,
          start_date: new Date().toISOString().split("T")[0],
          is_active: true,
        })
        .eq("id", tenantId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flat", id] });
      queryClient.invalidateQueries({ queryKey: ["flats"] });
      queryClient.invalidateQueries({ queryKey: ["available_tenants"] });
      toast({
        title: "Success",
        description: "Tenant assigned successfully",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      setAssignTenantOpen(false);
      setSelectedTenant("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to assign tenant",
      });
    },
  });

  // Unassign tenant mutation (new feature)
  const unassignTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      // Optional: Verify tenant exists
      const { data: tenant, error: fetchError } = await typedSupabase
        .from("tenants")
        .select("id")
        .eq("id", tenantId)
        .single();
      if (fetchError)
        throw new Error(`Failed to find tenant: ${fetchError.message}`);
      if (!tenant) throw new Error("Tenant not found");

      const { error } = await typedSupabase
        .from("tenants")
        .update({
          flat_id: null,
          is_active: false,
        })
        .eq("id", tenantId);
      if (error) throw new Error(error.message || "Failed to unassign tenant");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flat", id] });
      queryClient.invalidateQueries({ queryKey: ["available_tenants"] });
      toast({
        title: "Success",
        description: "Tenant unassigned successfully",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
    },
    onError: (error: Error) => {
      console.error("Unassign tenant error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to unassign tenant",
      });
    },
  });

  // Create maintenance request mutation
  const createMaintenanceMutation = useMutation({
    mutationFn: async ({
      title,
      description,
      priority,
      tenant_id,
    }: MaintenanceForm) => {
      const { data, error } = await typedSupabase
        .from("maintenance_requests")
        .insert({
          flat_id: id,
          tenant_id: tenant_id || null,
          title,
          description: description || null,
          status: "open",
          priority,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance_requests", id] });
      toast({
        title: "Success",
        description: "Maintenance request created successfully",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      setCreateMaintenanceOpen(false);
      setMaintenanceForm({
        title: "",
        description: "",
        priority: "medium",
        tenant_id: null,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create maintenance request",
      });
    },
  });

  // Upload document mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: async ({
      file,
      name,
      document_type,
    }: {
      file: File;
      name: string;
      document_type: string;
    }) => {
      if (!file) throw new Error("No file selected");
      const fileExt = file.name.split(".").pop();
      const fileName = `${id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await typedSupabase.storage
        .from("property_documents")
        .upload(fileName, file);
      if (uploadError) throw new Error(uploadError.message);

      const { data: insertData, error: insertError } = await typedSupabase
        .from("property_documents")
        .insert({
          flat_id: id,
          file_path: fileName,
          name: name || file.name,
          document_type,
          uploaded_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (insertError) throw new Error(insertError.message);
      return insertData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flat", id] });
      toast({
        title: "Success",
        description: "Document uploaded successfully",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      setUploadDocOpen(false);
      setDocFile(null);
      setDocName("");
      setDocType("other");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to upload document",
      });
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { data: doc, error: fetchError } = await typedSupabase
        .from("property_documents")
        .select("file_path")
        .eq("id", docId)
        .single();
      if (fetchError) throw new Error(fetchError.message);

      const { error: storageError } = await typedSupabase.storage
        .from("property_documents")
        .remove([doc.file_path]);
      if (storageError) throw new Error(storageError.message);

      const { error: deleteError } = await typedSupabase
        .from("property_documents")
        .delete()
        .eq("id", docId);
      if (deleteError) throw new Error(deleteError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flat", id] });
      toast({
        title: "Success",
        description: "Document deleted successfully",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      setDeleteDocOpen(false);
      setSelectedDocId(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete document",
      });
    },
  });

  // Create payment links mutation
  const createPaymentLinksMutation = useMutation({
    mutationFn: async ({
      amount,
      description,
      expiryDays,
    }: {
      amount: number;
      description: string;
      expiryDays: number;
    }) => {
      if (!flat?.tenants || flat.tenants.length === 0) {
        throw new Error("No tenants assigned to this flat");
      }

      const paymentLinks: PaymentLinkData[] = [];
      for (const tenant of flat.tenants) {
        if (!tenant.phone) {
          toast({
            variant: "destructive",
            title: "Warning",
            description: `Tenant ${tenant.name} has no phone number`,
          });
          continue;
        }

        const { data: rentData, error: rentError } = await typedSupabase
          .from("rents")
          .insert({
            tenant_id: tenant.id,
            amount,
            due_date: new Date().toISOString().split("T")[0],
            is_paid: false,
            whatsapp_sent: false,
            custom_message: description,
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (rentError) throw new Error(rentError.message);

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + expiryDays);

        const { data: linkData, error: linkError } = await typedSupabase
          .from("payment_links")
          .insert({
            tenant_id: tenant.id,
            rent_id: rentData.id,
            amount,
            description: description || null,
            expires_at: expiryDate.toISOString(),
            status: "active",
            payment_link: window.location.origin + "/payment-verification",
            generated_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (linkError) throw new Error(linkError.message);

        const paymentLink = `${
          window.location.origin
        }/payment-verification?id=${
          linkData.id
        }&amount=${amount}&name=${encodeURIComponent(tenant.name)}`;

        const { error: updateError } = await typedSupabase
          .from("payment_links")
          .update({ payment_link: paymentLink })
          .eq("id", linkData.id);
        if (updateError) throw new Error(updateError.message);

        await typedSupabase.from("whatsapp_messages").insert({
          tenant_id: tenant.id,
          rent_id: rentData.id,
          message: `Dear ${tenant.name}, please pay your rent of ₹${amount} for ${flat.name}. Use this link: ${paymentLink}`,
          recipient_phone: tenant.phone,
          sent_at: new Date().toISOString(),
          included_payment_link: true,
        });

        paymentLinks.push({
          link: paymentLink,
          id: linkData.id,
          tenant_id: tenant.id,
        });
      }

      if (paymentLinks.length === 0) {
        throw new Error("No valid tenants found for payment links");
      }

      return paymentLinks;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rents", id] });
      setPaymentLinksData(data);
      toast({
        title: "Success",
        description: "Payment links generated for all valid tenants",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      setSendPaymentLinksOpen(true);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to generate payment links",
      });
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const renderAvailabilityBadge = () => {
    if (!flat?.tenants || flat.tenants.length === 0) {
      return (
        <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100">
          Available
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100">
          Occupied
        </Badge>
      );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-luxury-softwhite to-luxury-cream px-4">
        <div className="flex flex-col items-center space-y-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          >
            <Building2 className="h-16 w-16 text-luxury-gold" />
          </motion.div>
          <p className="text-luxury-charcoal text-xl font-semibold tracking-wide">
            Loading property details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !flat) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <Card className="border-red-200 bg-red-50 shadow-lg rounded-xl max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600 text-xl font-semibold tracking-wide flex items-center">
              <svg
                className="h-6 w-6 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              Error Loading Property
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-6">
              {error?.message || "Property not found"}
            </p>
            <Link to="/flats">
              <Button
                variant="outline"
                className="w-full border-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/20"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Properties
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-8 bg-luxury-softwhite min-h-screen"
      role="main"
      aria-label="Property Details"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b border-luxury-cream pb-6">
        <div className="flex items-center mb-4 md:mb-0">
          <Link to="/flats" className="mr-4">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 border-luxury-cream hover:bg-luxury-gold/20 rounded-full"
              aria-label="Back to properties"
            >
              <ArrowLeft className="h-5 w-5 text-luxury-charcoal" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center">
              <h1 className="text-3xl font-semibold text-luxury-charcoal">
                {flat.name}
              </h1>
              {renderAvailabilityBadge()}
            </div>
            <p className="text-luxury-charcoal/70 text-sm mt-1">
              {flat.address}
            </p>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => setEditOpen(true)}
            className="border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal"
            aria-label="Edit property"
          >
            <Edit className="h-4 w-4 mr-2" /> Edit
          </Button>
          <Button
            className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
            onClick={() => handleTabChange("tenants")}
            aria-label="Manage tenants"
          >
            <Users2 className="h-4 w-4 mr-2" />
            {flat.tenants && flat.tenants.length > 0
              ? "Manage Tenants"
              : "Add Tenant"}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
        aria-label="Property tabs"
      >
        <TabsList className="grid grid-cols-5 mb-8 bg-luxury-cream/30 rounded-full border border-luxury-cream p-1">
          <TabsTrigger
            value="details"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="tenants"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal"
          >
            Tenants {flat.tenants?.length ? `(${flat.tenants.length})` : ""}
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal"
          >
            Documents{" "}
            {flat.property_documents?.length
              ? `(${flat.property_documents.length})`
              : "(0)"}
          </TabsTrigger>
          <TabsTrigger
            value="rents"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal"
          >
            Rent Collection
          </TabsTrigger>
          <TabsTrigger
            value="maintenance"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal"
          >
            Maintenance{" "}
            {maintenanceRequests?.length
              ? `(${maintenanceRequests.length})`
              : ""}
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <TabsContent value="details" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <Card className="bg-white shadow-md border border-luxury-cream rounded-lg overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl text-luxury-charcoal flex items-center">
                          <Building2 className="h-5 w-5 mr-2 text-luxury-gold" />
                          Property Details
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditOpen(true)}
                          className="text-luxury-charcoal hover:bg-luxury-gold/20"
                          aria-label="Edit property details"
                        >
                          <Edit className="h-4 w-4 mr-1" /> Edit
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:space-x-6">
                          <div className="mb-6 sm:mb-0">
                            <div className="h-32 w-32 rounded-xl bg-luxury-cream flex items-center justify-center mb-3 border border-luxury-cream/50 shadow-inner">
                              <Building2 className="h-16 w-16 text-luxury-gold" />
                            </div>
                          </div>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="border-l-4 border-luxury-gold/20 pl-3">
                              <p className="text-sm text-luxury-charcoal/60">
                                Monthly Rent
                              </p>
                              <p className="text-xl font-medium text-luxury-charcoal">
                                ₹{flat.monthly_rent_target.toLocaleString()}
                              </p>
                            </div>
                            <div className="border-l-4 border-luxury-gold/20 pl-3">
                              <p className="text-sm text-luxury-charcoal/60">
                                Security Deposit
                              </p>
                              <p className="text-xl font-medium text-luxury-charcoal">
                                {flat.security_deposit
                                  ? `₹${flat.security_deposit.toLocaleString()}`
                                  : "Not Set"}
                              </p>
                            </div>
                            <div className="border-l-4 border-luxury-gold/20 pl-3">
                              <p className="text-sm text-luxury-charcoal/60">
                                Property Added
                              </p>
                              <p className="text-lg font-medium text-luxury-charcoal">
                                {flat.created_at
                                  ? new Date(
                                      flat.created_at
                                    ).toLocaleDateString("en-US", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })
                                  : "N/A"}
                              </p>
                            </div>
                            <div className="border-l-4 border-luxury-gold/20 pl-3">
                              <p className="text-sm text-luxury-charcoal/60">
                                Status
                              </p>
                              <p className="text-lg font-medium text-luxury-charcoal flex items-center">
                                {flat.tenants && flat.tenants.length > 0 ? (
                                  <>
                                    <span className="h-2 w-2 rounded-full bg-amber-500 mr-2"></span>
                                    Occupied
                                  </>
                                ) : (
                                  <>
                                    <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2"></span>
                                    Available
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-luxury-cream pt-6">
                          <h3 className="text-lg font-medium text-luxury-charcoal mb-3 flex items-center">
                            <FileText className="h-4 w-4 mr-2 text-luxury-gold" />
                            Description
                          </h3>
                          <p className="text-luxury-charcoal/80 whitespace-pre-line">
                            {flat.description || "No description available"}
                          </p>
                        </div>

                        {flat.property_tags &&
                          flat.property_tags.length > 0 && (
                            <div className="border-t border-luxury-cream pt-6">
                              <h3 className="text-lg font-medium text-luxury-charcoal mb-3 flex items-center">
                                <Tag className="h-4 w-4 mr-2 text-luxury-gold" />
                                Property Features
                              </h3>
                              <div className="flex flex-wrap gap-2">
                                {flat.property_tags.map((tag) => (
                                  <Badge
                                    key={tag.id}
                                    variant="secondary"
                                    className="bg-luxury-gold/10 text-luxury-charcoal border border-luxury-gold/20 hover:bg-luxury-gold/20"
                                  >
                                    {tag.tag_name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <Card className="bg-white shadow-md border border-luxury-cream rounded-lg h-full">
                    <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite">
                      <CardTitle className="text-xl text-luxury-charcoal flex items-center">
                        <svg
                          className="h-5 w-5 mr-2 text-luxury-gold"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                        Quick Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center p-3 rounded-lg bg-luxury-cream/20 border border-luxury-cream">
                          <div className="h-10 w-10 rounded-full bg-luxury-gold/20 flex items-center justify-center mr-3">
                            <Users2 className="h-5 w-5 text-luxury-gold" />
                          </div>
                          <div>
                            <p className="text-sm text-luxury-charcoal/70">
                              Current Tenants
                            </p>
                            <p className="text-lg font-medium text-luxury-charcoal">
                              {flat.tenants?.length || 0}{" "}
                              {flat.tenants?.length === 1 ? "Person" : "People"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center p-3 rounded-lg bg-luxury-cream/20 border border-luxury-cream">
                          <div className="h-10 w-10 rounded-full bg-luxury-gold/20 flex items-center justify-center mr-3">
                            <Banknote className="h-5 w-5 text-luxury-gold" />
                          </div>
                          <div>
                            <p className="text-sm text-luxury-charcoal/70">
                              Monthly Income
                            </p>
                            <p className="text-lg font-medium text-luxury-charcoal">
                              ₹{flat.monthly_rent_target.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center p-3 rounded-lg bg-luxury-cream/20 border border-luxury-cream">
                          <div className="h-10 w-10 rounded-full bg-luxury-gold/20 flex items-center justify-center mr-3">
                            <FileText className="h-5 w-5 text-luxury-gold" />
                          </div>
                          <div>
                            <p className="text-sm text-luxury-charcoal/70">
                              Documents
                            </p>
                            <p className="text-lg font-medium text-luxury-charcoal">
                              {flat.property_documents?.length || 0}{" "}
                              {flat.property_documents?.length === 1
                                ? "File"
                                : "Files"}
                            </p>
                          </div>
                        </div>

                        {(!flat.tenants || flat.tenants.length === 0) && (
                          <Button
                            className="w-full bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80 mt-4"
                            onClick={() => setAddTenantOpen(true)}
                            aria-label="Add new tenant"
                          >
                            <Users2 className="h-4 w-4 mr-2" /> Add Tenant
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tenants" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <Card className="bg-white shadow-md border border-luxury-cream rounded-lg">
                    <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite border-b border-luxury-cream">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl text-luxury-charcoal flex items-center">
                          <Users2 className="h-5 w-5 mr-2 text-luxury-gold" />
                          Current Tenants
                        </CardTitle>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAddTenantOpen(true)}
                            className="border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal"
                            aria-label="Add new tenant"
                          >
                            <svg
                              className="h-4 w-4 mr-1"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                            New
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAssignTenantOpen(true)}
                            className="border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal"
                            aria-label="Assign existing tenant"
                          >
                            <Users2 className="h-4 w-4 mr-1" />
                            Assign
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {tenantsLoading ? (
                        <div className="space-y-4">
                          {[...Array(3)].map((_, i) => (
                            <div
                              key={i}
                              className="animate-pulse border border-luxury-cream rounded-lg p-4"
                            >
                              <div className="flex items-center">
                                <div className="h-12 w-12 bg-luxury-cream/50 rounded-full mr-4"></div>
                                <div className="flex-1 space-y-2">
                                  <div className="h-4 bg-luxury-cream/50 rounded w-3/4"></div>
                                  <div className="h-3 bg-luxury-cream/50 rounded w-1/2"></div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : flat.tenants && flat.tenants.length > 0 ? (
                        <ul className="space-y-6">
                          {flat.tenants
                            .slice(
                              (page - 1) * itemsPerPage,
                              page * itemsPerPage
                            )
                            .map((tenant) => (
                              <li
                                key={tenant.id}
                                className="flex flex-col sm:flex-row sm:items-center border border-luxury-cream rounded-lg p-4 hover:bg-luxury-cream/10 transition-colors"
                              >
                                <div className="flex items-center mb-4 sm:mb-0">
                                  <Avatar className="h-12 w-12 mr-4 bg-luxury-gold/20 text-luxury-charcoal border border-luxury-gold/30">
                                    <AvatarFallback>
                                      {getInitials(tenant.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <Link
                                      to={`/tenant/${tenant.id}`}
                                      className="text-luxury-charcoal hover:text-luxury-gold transition-colors"
                                    >
                                      <h3 className="font-medium text-lg">
                                        {tenant.name}
                                      </h3>
                                    </Link>
                                    <div className="flex items-center text-sm text-luxury-charcoal/70 mt-1">
                                      <Phone className="h-3 w-3 mr-1" />
                                      {tenant.phone}
                                    </div>
                                    {tenant.email && (
                                      <div className="flex items-center text-sm text-luxury-charcoal/70 mt-1">
                                        <Mail className="h-3 w-3 mr-1" />
                                        {tenant.email}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="sm:ml-auto flex space-x-2">
                                  <Link to={`/tenant/${tenant.id}`}>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal"
                                      aria-label={`View details for ${tenant.name}`}
                                    >
                                      View Details
                                    </Button>
                                  </Link>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      unassignTenantMutation.mutate(tenant.id)
                                    }
                                    className="border-luxury-cream hover:bg-red-100 text-red-600"
                                    disabled={unassignTenantMutation.isPending}
                                    aria-label={`Unassign ${tenant.name}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <div className="text-center py-16 border border-dashed border-luxury-cream rounded-lg">
                          <Users2 className="h-16 w-16 text-luxury-charcoal/30 mx-auto mb-4" />
                          <h3 className="text-xl font-medium text-luxury-charcoal mb-3">
                            No tenants assigned
                          </h3>
                          <p className="text-luxury-charcoal/70 mb-6 max-w-md mx-auto">
                            This property currently has no tenants. Add a new
                            tenant or assign an existing one.
                          </p>
                          <div className="flex justify-center space-x-4">
                            <Button
                              onClick={() => setAddTenantOpen(true)}
                              className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                              aria-label="Add new tenant"
                            >
                              <svg
                                className="h-4 w-4 mr-2"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 4v16m8-8H4"
                                />
                              </svg>
                              Add New Tenant
                            </Button>
                            <Button
                              onClick={() => setAssignTenantOpen(true)}
                              variant="outline"
                              className="border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal"
                              aria-label="Assign existing tenant"
                            >
                              <Users2 className="h-4 w-4 mr-2" />
                              Assign Existing Tenant
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                    {flat.tenants && flat.tenants.length > itemsPerPage && (
                      <CardFooter className="p-6 border-t border-luxury-cream flex justify-between">
                        <Button
                          variant="outline"
                          disabled={page === 1}
                          onClick={() => setPage((p) => p - 1)}
                          className="border-luxury-cream hover:bg-luxury-gold/20"
                          aria-label="Previous page"
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          disabled={flat.tenants.length <= page * itemsPerPage}
                          onClick={() => setPage((p) => p + 1)}
                          className="border-luxury-cream hover:bg-luxury-gold/20"
                          aria-label="Next page"
                        >
                          Next
                        </Button>
                      </CardFooter>
                    )}
                  </Card>
                </div>

                <div>
                  <Card className="bg-white shadow-md border border-luxury-cream rounded-lg">
                    <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite">
                      <CardTitle className="text-xl text-luxury-charcoal flex items-center">
                        <svg
                          className="h-5 w-5 mr-2 text-luxury-gold"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6h16M4 12h16m-7 6h7"
                          />
                        </svg>
                        Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <Button
                          onClick={() => setAddTenantOpen(true)}
                          className="w-full bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80 justify-start"
                          aria-label="Add new tenant"
                        >
                          <svg
                            className="h-4 w-4 mr-2"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                          Add New Tenant
                        </Button>
                        <Button
                          onClick={() => setAssignTenantOpen(true)}
                          variant="outline"
                          className="w-full border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal justify-start"
                          aria-label="Assign existing tenant"
                        >
                          <Users2 className="h-4 w-4 mr-2" />
                          Assign Existing Tenant
                        </Button>
                        <Button
                          onClick={() => handleTabChange("rents")}
                          variant="outline"
                          className="w-full border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal justify-start"
                          aria-label="Manage rent collection"
                        >
                          <Banknote className="h-4 w-4 mr-2" />
                          Manage Rent Collection
                        </Button>
                        <Button
                          onClick={() => handleTabChange("maintenance")}
                          variant="outline"
                          className="w-full border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal justify-start"
                          aria-label="View maintenance requests"
                        >
                          <Wrench className="h-4 w-4 mr-2" />
                          Maintenance Requests
                        </Button>
                      </div>

                      {flat.tenants && flat.tenants.length > 0 && (
                        <div className="mt-8 border-t border-luxury-cream pt-6">
                          <h3 className="text-lg font-medium text-luxury-charcoal mb-4">
                            Quick Stats
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-luxury-cream/20 rounded-lg border border-luxury-cream">
                              <p className="text-sm text-luxury-charcoal/70">
                                Tenants
                              </p>
                              <p className="text-2xl font-semibold text-luxury-charcoal">
                                {flat.tenants.length}
                              </p>
                            </div>
                            <div className="text-center p-3 bg-luxury-cream/20 rounded-lg border border-luxury-cream">
                              <p className="text-sm text-luxury-charcoal/70">
                                Occupancy
                              </p>
                              <p className="text-2xl font-semibold text-luxury-charcoal">
                                100%
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="documents" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <Card className="bg-white shadow-md border border-luxury-cream rounded-lg">
                    <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite border-b border-luxury-cream">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl text-luxury-charcoal flex items-center">
                          <FileText className="h-5 w-5 mr-2 text-luxury-gold" />
                          Property Documents
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUploadDocOpen(true)}
                          className="border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal"
                          aria-label="Upload document"
                        >
                          <Upload className="h-4 w-4 mr-1" /> Upload
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {flat.property_documents &&
                      flat.property_documents.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                          {flat.property_documents
                            .slice(
                              (page - 1) * itemsPerPage,
                              page * itemsPerPage
                            )
                            .map((doc) => (
                              <div
                                key={doc.id}
                                className="border border-luxury-cream rounded-lg p-4 hover:bg-luxury-cream/10 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <div className="h-10 w-10 rounded bg-luxury-gold/10 flex items-center justify-center mr-4">
                                      <svg
                                        className="h-5 w-5 text-luxury-gold"
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
                                    </div>
                                    <div>
                                      <h3 className="font-medium text-luxury-charcoal">
                                        {doc.name}
                                      </h3>
                                      <p className="text-sm text-luxury-charcoal/70">
                                        Type: {doc.document_type}
                                      </p>
                                      <p className="text-sm text-luxury-charcoal/70">
                                        {doc.uploaded_at
                                          ? new Date(
                                              doc.uploaded_at
                                            ).toLocaleDateString("en-US", {
                                              day: "numeric",
                                              month: "short",
                                              year: "numeric",
                                            })
                                          : "Date not available"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex space-x-2">
                                    <a
                                      href={
                                        typedSupabase.storage
                                          .from("property_documents")
                                          .getPublicUrl(doc.file_path).data
                                          .publicUrl
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-3 py-1.5 bg-luxury-gold/10 text-luxury-charcoal hover:bg-luxury-gold/20 rounded border border-luxury-gold/30 transition-colors"
                                      aria-label={`View document ${doc.name}`}
                                    >
                                      <svg
                                        className="h-4 w-4 mr-1"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                        />
                                      </svg>
                                      View
                                    </a>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedDocId(doc.id);
                                        setDeleteDocOpen(true);
                                      }}
                                      className="text-red-600 hover:bg-red-100"
                                      aria-label={`Delete document ${doc.name}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="text-center py-16 border border-dashed border-luxury-cream rounded-lg">
                          <Upload className="h-16 w-16 text-luxury-charcoal/30 mx-auto mb-4" />
                          <h3 className="text-xl font-medium text-luxury-charcoal mb-3">
                            No documents uploaded
                          </h3>
                          <p className="text-luxury-charcoal/70 mb-6 max-w-md mx-auto">
                            Upload important property documents like lease
                            agreements, inspection reports, and more.
                          </p>
                          <Button
                            onClick={() => setUploadDocOpen(true)}
                            className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                            aria-label="Upload new document"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Document
                          </Button>
                        </div>
                      )}
                    </CardContent>
                    {flat.property_documents &&
                      flat.property_documents.length > itemsPerPage && (
                        <CardFooter className="p-6 border-t border-luxury-cream flex justify-between">
                          <Button
                            variant="outline"
                            disabled={page === 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="border-luxury-cream hover:bg-luxury-gold/20"
                            aria-label="Previous page"
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            disabled={
                              flat.property_documents.length <=
                              page * itemsPerPage
                            }
                            onClick={() => setPage((p) => p + 1)}
                            className="border-luxury-cream hover:bg-luxury-gold/20"
                            aria-label="Next page"
                          >
                            Next
                          </Button>
                        </CardFooter>
                      )}
                  </Card>
                </div>

                <div>
                  <Card className="bg-white shadow-md border border-luxury-cream rounded-lg">
                    <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite">
                      <CardTitle className="text-xl text-luxury-charcoal flex items-center">
                        <svg
                          className="h-5 w-5 mr-2 text-luxury-gold"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        Document Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <Button
                          onClick={() => setUploadDocOpen(true)}
                          className="w-full bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80 justify-start"
                          aria-label="Upload new document"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload New Document
                        </Button>

                        <div className="border-t border-luxury-cream my-6 pt-6">
                          <h3 className="text-lg font-medium text-luxury-charcoal mb-4">
                            Document Categories
                          </h3>
                          <div className="space-y-3">
                            <div
                              className="flex items-center p-3 rounded-lg bg-luxury-cream/20 border border-luxury-cream cursor-pointer hover:bg-luxury-cream/30 transition-colors"
                              onClick={() => {
                                setDocType("lease_agreement");
                                setUploadDocOpen(true);
                              }}
                            >
                              <div className="w-8 h-8 bg-luxury-gold/20 rounded flex items-center justify-center mr-3">
                                <svg
                                  className="h-4 w-4 text-luxury-gold"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                  />
                                </svg>
                              </div>
                              <span className="text-luxury-charcoal">
                                Lease Agreements
                              </span>
                            </div>
                            <div
                              className="flex items-center p-3 rounded-lg bg-luxury-cream/20 border border-luxury-cream cursor-pointer hover:bg-luxury-cream/30 transition-colors"
                              onClick={() => {
                                setDocType("photo");
                                setUploadDocOpen(true);
                              }}
                            >
                              <div className="w-8 h-8 bg-luxury-gold/20 rounded flex items-center justify-center mr-3">
                                <svg
                                  className="h-4 w-4 text-luxury-gold"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                  />
                                </svg>
                              </div>
                              <span className="text-luxury-charcoal">
                                Property Photos
                              </span>
                            </div>
                            <div
                              className="flex items-center p-3 rounded-lg bg-luxury-cream/20 border border-luxury-cream cursor-pointer hover:bg-luxury-cream/30 transition-colors"
                              onClick={() => {
                                setDocType("inspection_report");
                                setUploadDocOpen(true);
                              }}
                            >
                              <div className="w-8 h-8 bg-luxury-gold/20 rounded flex items-center justify-center mr-3">
                                <svg
                                  className="h-4 w-4 text-luxury-gold"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                              </div>
                              <span className="text-luxury-charcoal">
                                Inspection Reports
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="rents" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <Card className="bg-white shadow-md border border-luxury-cream rounded-lg">
                    <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite border-b border-luxury-cream">
                      <CardTitle className="text-xl text-luxury-charcoal flex items-center">
                        <Banknote className="h-5 w-5 mr-2 text-luxury-gold" />
                        Rent Collection
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      {rentsLoading ? (
                        <div className="space-y-4">
                          {[...Array(3)].map((_, i) => (
                            <div
                              key={i}
                              className="animate-pulse border border-luxury-cream rounded-lg p-4"
                            >
                              <div className="space-y-2">
                                <div className="h-4 bg-luxury-cream/50 rounded w-3/4"></div>
                                <div className="h-3 bg-luxury-cream/50 rounded w-1/2"></div>
                                <div className="h-3 bg-luxury-cream/50 rounded w-1/3"></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : rents && rents.length > 0 ? (
                        <ul className="space-y-6">
                          {rents.map((rent) => (
                            <li
                              key={rent.id}
                              className="border border-luxury-cream rounded-lg p-4 hover:bg-luxury-cream/10 transition-colors"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                                <div>
                                  <h3 className="font-medium text-luxury-charcoal">
                                    {rent.tenant?.name || "Unknown Tenant"}
                                  </h3>
                                  <p className="text-sm text-luxury-charcoal/70">
                                    Due:{" "}
                                    {rent.due_date
                                      ? new Date(
                                          rent.due_date
                                        ).toLocaleDateString()
                                      : "N/A"}
                                  </p>
                                  <p className="text-sm text-luxury-charcoal/70">
                                    Amount: ₹{rent.amount.toLocaleString()}
                                  </p>
                                  {rent.payment_links &&
                                    rent.payment_links.length > 0 && (
                                      <div className="mt-2">
                                        <p className="text-sm text-luxury-charcoal/70">
                                          Payment Link:
                                        </p>
                                        {rent.payment_links.map((link) => (
                                          <div
                                            key={link.id}
                                            className="flex items-center space-x-2 mt-1"
                                          >
                                            <a
                                              href={link.payment_link}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-luxury-gold hover:underline text-sm truncate max-w-xs"
                                              aria-label="Open payment link"
                                            >
                                              {link.payment_link.substring(
                                                0,
                                                30
                                              )}
                                              ...
                                            </a>
                                            <Badge
                                              variant={
                                                link.status === "active"
                                                  ? "default"
                                                  : link.status === "completed"
                                                  ? "secondary"
                                                  : "destructive"
                                              }
                                              className={
                                                link.status === "active"
                                                  ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                                                  : link.status === "completed"
                                                  ? "bg-blue-50 text-blue-600 border-blue-200"
                                                  : "bg-red-50 text-red-600 border-red-200"
                                              }
                                            >
                                              {link.status}
                                            </Badge>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                </div>
                                <div className="flex items-center space-x-2 mt-4 sm:mt-0">
                                  <Badge
                                    variant={
                                      rent.is_paid ? "default" : "destructive"
                                    }
                                    className={
                                      rent.is_paid
                                        ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                                        : "bg-red-50 text-red-600 border-red-200"
                                    }
                                  >
                                    {rent.is_paid ? "Paid" : "Unpaid"}
                                  </Badge>
                                  {rent.is_paid && rent.paid_on && (
                                    <p className="text-sm text-luxury-charcoal/70">
                                      Paid on:{" "}
                                      {new Date(
                                        rent.paid_on
                                      ).toLocaleDateString()}
                                    </p>
                                  )}
                                  {rent.whatsapp_sent && (
                                    <Badge className="bg-luxury-gold/20 text-luxury-charcoal">
                                      WhatsApp Sent
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-center py-16 border border-dashed border-luxury-cream rounded-lg">
                          <Banknote className="h-16 w-16 text-luxury-charcoal/30 mx-auto mb-4" />
                          <h3 className="text-xl font-medium text-luxury-charcoal mb-3">
                            No rent records
                          </h3>
                          <p className="text-luxury-charcoal/70 mb-6 max-w-md mx-auto">
                            No rent collection records found for this property.
                          </p>
                          <Button
                            onClick={() => setSendPaymentLinksOpen(true)}
                            className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                            aria-label="Create rent invoice"
                          >
                            <FilePlus className="h-4 w-4 mr-2" />
                            Create Rent Invoice
                          </Button>
                        </div>
                      )}
                    </CardContent>
                    {rents && rents.length > itemsPerPage && (
                      <CardFooter className="p-6 border-t border-luxury-cream flex justify-between">
                        <Button
                          variant="outline"
                          disabled={page === 1}
                          onClick={() => setPage((p) => p - 1)}
                          className="border-luxury-cream hover:bg-luxury-gold/20"
                          aria-label="Previous page"
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          disabled={rents.length <= page * itemsPerPage}
                          onClick={() => setPage((p) => p + 1)}
                          className="border-luxury-cream hover:bg-luxury-gold/20"
                          aria-label="Next page"
                        >
                          Next
                        </Button>
                      </CardFooter>
                    )}
                  </Card>
                </div>

                <div>
                  <Card className="bg-white shadow-md border border-luxury-cream rounded-lg">
                    <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite">
                      <CardTitle className="text-xl text-luxury-charcoal flex items-center">
                        <Banknote className="h-5 w-5 mr-2 text-luxury-gold" />
                        Rent Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <Button
                          onClick={() => setSendPaymentLinksOpen(true)}
                          className="w-full bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80 justify-start"
                          aria-label="Create rent invoice"
                        >
                          <FilePlus className="h-4 w-4 mr-2" />
                          Create Rent Invoice
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal justify-start"
                          disabled
                          aria-label="View payment history (coming soon)"
                        >
                          <svg
                            className="h-4 w-4 mr-2"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                          View Payment History
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="maintenance" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <Card className="bg-white shadow-md border border-luxury-cream rounded-lg">
                    <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite border-b border-luxury-cream">
                      <CardTitle className="text-xl text-luxury-charcoal flex items-center">
                        <Wrench className="h-5 w-5 mr-2 text-luxury-gold" />
                        Maintenance Requests
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      {maintenanceLoading ? (
                        <div className="space-y-4">
                          {[...Array(3)].map((_, i) => (
                            <div
                              key={i}
                              className="animate-pulse border border-luxury-cream rounded-lg p-4"
                            >
                              <div className="space-y-2">
                                <div className="h-4 bg-luxury-cream/50 rounded w-3/4"></div>
                                <div className="h-3 bg-luxury-cream/50 rounded w-1/2"></div>
                                <div className="h-3 bg-luxury-cream/50 rounded w-1/3"></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : maintenanceRequests &&
                        maintenanceRequests.length > 0 ? (
                        <ul className="space-y-6">
                          {maintenanceRequests
                            .slice(
                              (page - 1) * itemsPerPage,
                              page * itemsPerPage
                            )
                            .map((request) => (
                              <li
                                key={request.id}
                                className="border border-luxury-cream rounded-lg p-4 hover:bg-luxury-cream/10 transition-colors"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                                  <div>
                                    <h3 className="font-medium text-luxury-charcoal">
                                      {request.title}
                                    </h3>
                                    {request.description && (
                                      <p className="text-sm text-luxury-charcoal/70 mt-1">
                                        {request.description}
                                      </p>
                                    )}
                                    <p className="text-sm text-luxury-charcoal/70 mt-1">
                                      Reported:{" "}
                                      {request.created_at
                                        ? new Date(
                                            request.created_at
                                          ).toLocaleDateString()
                                        : "N/A"}
                                    </p>
                                    <p className="text-sm text-luxury-charcoal/70 mt-1">
                                      Tenant:{" "}
                                      {request.tenant?.name ||
                                        "Property Manager"}
                                    </p>
                                  </div>
                                  <div className="flex items-center space-x-2 mt-4 sm:mt-0">
                                    <Badge
                                      variant={
                                        request.status === "open"
                                          ? "default"
                                          : request.status === "in_progress"
                                          ? "secondary"
                                          : "outline"
                                      }
                                      className={
                                        request.status === "open"
                                          ? "bg-amber-50 text-amber-600 border-amber-200"
                                          : request.status === "in_progress"
                                          ? "bg-blue-50 text-blue-600 border-blue-200"
                                          : "bg-emerald-50 text-emerald-600 border-emerald-200"
                                      }
                                    >
                                      {request.status.replace("_", " ")}
                                    </Badge>
                                    <Badge
                                      variant={
                                        request.priority === "high"
                                          ? "destructive"
                                          : request.priority === "medium"
                                          ? "default"
                                          : "secondary"
                                      }
                                      className={
                                        request.priority === "high"
                                          ? "bg-red-50 text-red-600 border-red-200"
                                          : request.priority === "medium"
                                          ? "bg-orange-50 text-orange-600 border-orange-200"
                                          : "bg-green-50 text-green-600 border-green-200"
                                      }
                                    >
                                      {request.priority}
                                    </Badge>
                                  </div>
                                </div>
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <div className="text-center py-16 border border-dashed border-luxury-cream rounded-lg">
                          <Wrench className="h-16 w-16 text-luxury-charcoal/30 mx-auto mb-4" />
                          <h3 className="text-xl font-medium text-luxury-charcoal mb-3">
                            No maintenance requests
                          </h3>
                          <p className="text-luxury-charcoal/70 mb-6 max-w-md mx-auto">
                            No maintenance requests have been reported for this
                            property.
                          </p>
                          <Button
                            onClick={() => setCreateMaintenanceOpen(true)}
                            className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                            aria-label="Create maintenance request"
                          >
                            <Wrench className="h-4 w-4 mr-2" />
                            Create Request
                          </Button>
                        </div>
                      )}
                    </CardContent>
                    {maintenanceRequests &&
                      maintenanceRequests.length > itemsPerPage && (
                        <CardFooter className="p-6 border-t border-luxury-cream flex justify-between">
                          <Button
                            variant="outline"
                            disabled={page === 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="border-luxury-cream hover:bg-luxury-gold/20"
                            aria-label="Previous page"
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            disabled={
                              maintenanceRequests.length <= page * itemsPerPage
                            }
                            onClick={() => setPage((p) => p + 1)}
                            className="border-luxury-cream hover:bg-luxury-gold/20"
                            aria-label="Next page"
                          >
                            Next
                          </Button>
                        </CardFooter>
                      )}
                  </Card>
                </div>

                <div>
                  <Card className="bg-white shadow-md border border-luxury-cream rounded-lg">
                    <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite">
                      <CardTitle className="text-xl text-luxury-charcoal flex items-center">
                        <Wrench className="h-5 w-5 mr-2 text-luxury-gold" />
                        Maintenance Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <Button
                          onClick={() => setCreateMaintenanceOpen(true)}
                          className="w-full bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80 justify-start"
                          aria-label="Create new maintenance request"
                        >
                          <Wrench className="h-4 w-4 mr-2" />
                          Create New Request
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>

      {/* Edit Flat Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-white border border-luxury-cream max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-luxury-charcoal flex items-center text-xl">
              <Edit className="h-5 w-5 mr-2 text-luxury-gold" />
              Edit Property
            </DialogTitle>
            <DialogDescription className="text-luxury-charcoal/70">
              Update the details for {flat?.name}.
            </DialogDescription>
          </DialogHeader>
          {flat ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                // Add logic to handle form submission
                const updatedFlat = {
                  ...flat,
                  monthly_rent_target: +flat.monthly_rent_target,
                  security_deposit: flat.security_deposit
                    ? +flat.security_deposit
                    : null,
                  description: flat.description || "",
                  property_tags: flat.property_tags || [],
                };

                // Call mutation or API to save changes
                queryClient.setQueryData(["flat", id], updatedFlat);
                toast({
                  title: "Success",
                  description: "Property updated successfully",
                  className: "bg-luxury-gold text-luxury-charcoal border-none",
                });
                setEditOpen(false);
              }}
              className="space-y-6"
            >
              <div>
                <Label htmlFor="monthly-rent" className="text-luxury-charcoal">
                  Monthly Rent
                </Label>
                <Input
                  id="monthly-rent"
                  type="number"
                  value={flat.monthly_rent_target}
                  onChange={(e) =>
                    queryClient.setQueryData(["flat", id], {
                      ...flat,
                      monthly_rent_target: +e.target.value,
                    })
                  }
                  className="border-luxury-cream focus:ring-luxury-gold"
                  placeholder="Enter monthly rent"
                  required
                />
              </div>
              <div>
                <Label
                  htmlFor="security-deposit"
                  className="text-luxury-charcoal"
                >
                  Security Deposit
                </Label>
                <Input
                  id="security-deposit"
                  type="number"
                  value={flat.security_deposit || ""}
                  onChange={(e) =>
                    queryClient.setQueryData(["flat", id], {
                      ...flat,
                      security_deposit: +e.target.value,
                    })
                  }
                  className="border-luxury-cream focus:ring-luxury-gold"
                  placeholder="Enter security deposit"
                />
              </div>
              <div>
                <Label htmlFor="description" className="text-luxury-charcoal">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={flat.description || ""}
                  onChange={(e) =>
                    queryClient.setQueryData(["flat", id], {
                      ...flat,
                      description: e.target.value,
                    })
                  }
                  className="border-luxury-cream focus:ring-luxury-gold"
                  placeholder="Enter property description"
                />
              </div>
              <div>
                <Label
                  htmlFor="property-features"
                  className="text-luxury-charcoal"
                >
                  Property Features
                </Label>
                <Input
                  id="property-features"
                  value={
                    flat.property_tags?.map((tag) => tag.tag_name).join(", ") ||
                    ""
                  }
                  onChange={(e) =>
                    queryClient.setQueryData(["flat", id], {
                      ...flat,
                      property_tags: e.target.value
                        .split(",")
                        .map((tag) => ({ id: "", tag_name: tag.trim() })),
                    })
                  }
                  className="border-luxury-cream focus:ring-luxury-gold"
                  placeholder="Enter features separated by commas"
                />
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
                  type="submit"
                  className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <p className="text-luxury-charcoal/70">
              Loading property details...
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Tenant Dialog */}
      <Dialog open={addTenantOpen} onOpenChange={setAddTenantOpen}>
        <DialogContent className="bg-white border border-luxury-cream max-w-md">
          <DialogHeader>
            <DialogTitle className="text-luxury-charcoal flex items-center text-xl">
              <Users2 className="h-5 w-5 mr-2 text-luxury-gold" />
              Add New Tenant
            </DialogTitle>
            <DialogDescription className="text-luxury-charcoal/70">
              Add a new tenant to {flat.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tenant-name" className="text-luxury-charcoal">
                Name
              </Label>
              <Input
                id="tenant-name"
                value={tenantForm.name}
                onChange={(e) =>
                  setTenantForm({ ...tenantForm, name: e.target.value })
                }
                className="border-luxury-cream focus:ring-luxury-gold"
                placeholder="Enter tenant name"
                required
                aria-required="true"
              />
            </div>
            <div>
              <Label htmlFor="tenant-phone" className="text-luxury-charcoal">
                Phone
              </Label>
              <Input
                id="tenant-phone"
                value={tenantForm.phone}
                onChange={(e) =>
                  setTenantForm({ ...tenantForm, phone: e.target.value })
                }
                className="border-luxury-cream focus:ring-luxury-gold"
                placeholder="Enter phone number"
                type="tel"
                required
                aria-required="true"
              />
            </div>
            <div>
              <Label htmlFor="tenant-email" className="text-luxury-charcoal">
                Email (Optional)
              </Label>
              <Input
                id="tenant-email"
                value={tenantForm.email}
                onChange={(e) =>
                  setTenantForm({ ...tenantForm, email: e.target.value })
                }
                className="border-luxury-cream focus:ring-luxury-gold"
                placeholder="Enter email address"
                type="email"
              />
            </div>
          </div>
          <DialogFooter className="flex space-x-2 sm:space-x-0">
            <Button
              variant="outline"
              onClick={() => {
                setAddTenantOpen(false);
                setTenantForm({ name: "", phone: "", email: "" });
              }}
              className="border-luxury-cream text-luxury-charcoal hover:bg-luxury-gold/20"
              aria-label="Cancel adding tenant"
            >
              Cancel
            </Button>
            <Button
              onClick={() => addTenantMutation.mutate(tenantForm)}
              disabled={
                addTenantMutation.isPending ||
                !tenantForm.name ||
                !tenantForm.phone
              }
              className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
              aria-label="Add tenant"
            >
              {addTenantMutation.isPending ? "Adding..." : "Add Tenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Tenant Dialog */}
      <Dialog open={assignTenantOpen} onOpenChange={setAssignTenantOpen}>
        <DialogContent className="bg-white border border-luxury-cream max-w-md">
          <DialogHeader>
            <DialogTitle className="text-luxury-charcoal flex items-center text-xl">
              <Users2 className="h-5 w-5 mr-2 text-luxury-gold" />
              Assign Existing Tenant
            </DialogTitle>
            <DialogDescription className="text-luxury-charcoal/70">
              Assign an existing tenant to {flat.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="select-tenant" className="text-luxury-charcoal">
                Select Tenant
              </Label>
              <Select
                value={selectedTenant}
                onValueChange={setSelectedTenant}
                disabled={tenantsLoading || !availableTenants?.length}
              >
                <SelectTrigger
                  id="select-tenant"
                  className="border-luxury-cream focus:ring-luxury-gold"
                  aria-label="Select tenant to assign"
                >
                  <SelectValue placeholder="Choose a tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenantsLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading tenants...
                    </SelectItem>
                  ) : availableTenants && availableTenants.length > 0 ? (
                    availableTenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name} ({tenant.phone})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-tenants" disabled>
                      No available tenants
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex space-x-2 sm:space-x-0">
            <Button
              variant="outline"
              onClick={() => {
                setAssignTenantOpen(false);
                setSelectedTenant("");
              }}
              className="border-luxury-cream text-luxury-charcoal hover:bg-luxury-gold/20"
              aria-label="Cancel assigning tenant"
            >
              Cancel
            </Button>
            <Button
              onClick={() => assignTenantMutation.mutate(selectedTenant)}
              disabled={assignTenantMutation.isPending || !selectedTenant}
              className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
              aria-label="Assign tenant"
            >
              {assignTenantMutation.isPending
                ? "Assigning..."
                : "Assign Tenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={uploadDocOpen} onOpenChange={setUploadDocOpen}>
        <DialogContent className="bg-white border border-luxury-cream max-w-md">
          <DialogHeader>
            <DialogTitle className="text-luxury-charcoal flex items-center text-xl">
              <Upload className="h-5 w-5 mr-2 text-luxury-gold" />
              Upload Document
            </DialogTitle>
            <DialogDescription className="text-luxury-charcoal/70">
              Upload a document for {flat.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="doc-name" className="text-luxury-charcoal">
                Document Name
              </Label>
              <Input
                id="doc-name"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className="border-luxury-cream focus:ring-luxury-gold"
                placeholder="Enter document name"
                required
                aria-required="true"
              />
            </div>
            <div>
              <Label htmlFor="doc-type" className="text-luxury-charcoal">
                Document Type
              </Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger
                  id="doc-type"
                  className="border-luxury-cream focus:ring-luxury-gold"
                  aria-label="Select document type"
                >
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lease_agreement">
                    Lease Agreement
                  </SelectItem>
                  <SelectItem value="photo">Property Photo</SelectItem>
                  <SelectItem value="inspection_report">
                    Inspection Report
                  </SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="doc-file" className="text-luxury-charcoal">
                File
              </Label>
              <Input
                id="doc-file"
                type="file"
                onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                className="border-luxury-cream focus:ring-luxury-gold"
                required
                aria-required="true"
              />
            </div>
          </div>
          <DialogFooter className="flex space-x-2 sm:space-x-0">
            <Button
              variant="outline"
              onClick={() => {
                setUploadDocOpen(false);
                setDocFile(null);
                setDocName("");
                setDocType("other");
              }}
              className="border-luxury-cream text-luxury-charcoal hover:bg-luxury-gold/20"
              aria-label="Cancel uploading document"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                docFile &&
                uploadDocumentMutation.mutate({
                  file: docFile,
                  name: docName,
                  document_type: docType,
                })
              }
              disabled={
                uploadDocumentMutation.isPending || !docFile || !docName
              }
              className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
              aria-label="Upload document"
            >
              {uploadDocumentMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Document Dialog */}
      <Dialog open={deleteDocOpen} onOpenChange={setDeleteDocOpen}>
        <DialogContent className="bg-white border border-luxury-cream max-w-md">
          <DialogHeader>
            <DialogTitle className="text-luxury-charcoal flex items-center text-xl">
              <Trash2 className="h-5 w-5 mr-2 text-red-600" />
              Delete Document
            </DialogTitle>
            <DialogDescription className="text-luxury-charcoal/70">
              Are you sure you want to delete this document? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex space-x-2 sm:space-x-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDocOpen(false);
                setSelectedDocId(null);
              }}
              className="border-luxury-cream text-luxury-charcoal hover:bg-luxury-gold/20"
              aria-label="Cancel deleting document"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                selectedDocId && deleteDocumentMutation.mutate(selectedDocId)
              }
              disabled={deleteDocumentMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-700"
              aria-label="Confirm delete document"
            >
              {deleteDocumentMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Maintenance Request Dialog */}
      <Dialog
        open={createMaintenanceOpen}
        onOpenChange={setCreateMaintenanceOpen}
      >
        <DialogContent className="bg-white border border-luxury-cream max-w-md">
          <DialogHeader>
            <DialogTitle className="text-luxury-charcoal flex items-center text-xl">
              <Wrench className="h-5 w-5 mr-2 text-luxury-gold" />
              Create Maintenance Request
            </DialogTitle>
            <DialogDescription className="text-luxury-charcoal/70">
              Submit a new maintenance request for {flat.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="maint-title" className="text-luxury-charcoal">
                Title
              </Label>
              <Input
                id="maint-title"
                value={maintenanceForm.title}
                onChange={(e) =>
                  setMaintenanceForm({
                    ...maintenanceForm,
                    title: e.target.value,
                  })
                }
                className="border-luxury-cream focus:ring-luxury-gold"
                placeholder="Enter request title"
                required
                aria-required="true"
              />
            </div>
            <div>
              <Label
                htmlFor="maint-description"
                className="text-luxury-charcoal"
              >
                Description (Optional)
              </Label>
              <Textarea
                id="maint-description"
                value={maintenanceForm.description}
                onChange={(e) =>
                  setMaintenanceForm({
                    ...maintenanceForm,
                    description: e.target.value,
                  })
                }
                className="border-luxury-cream focus:ring-luxury-gold"
                placeholder="Describe the issue"
              />
            </div>
            <div>
              <Label htmlFor="maint-priority" className="text-luxury-charcoal">
                Priority
              </Label>
              <Select
                value={maintenanceForm.priority}
                onValueChange={(value) =>
                  setMaintenanceForm({ ...maintenanceForm, priority: value })
                }
              >
                <SelectTrigger
                  id="maint-priority"
                  className="border-luxury-cream focus:ring-luxury-gold"
                  aria-label="Select priority"
                >
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="maint-tenant" className="text-luxury-charcoal">
                Assign to Tenant (Optional)
              </Label>
              <Select
                value={maintenanceForm.tenant_id || ""}
                onValueChange={(value) =>
                  setMaintenanceForm({
                    ...maintenanceForm,
                    tenant_id: value === "" ? null : value,
                  })
                }
              >
                <SelectTrigger
                  id="maint-tenant"
                  className="border-luxury-cream focus:ring-luxury-gold"
                  aria-label="Select tenant for maintenance request"
                >
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {flat.tenants?.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex space-x-2 sm:space-x-0">
            <Button
              variant="outline"
              onClick={() => {
                setCreateMaintenanceOpen(false);
                setMaintenanceForm({
                  title: "",
                  description: "",
                  priority: "medium",
                  tenant_id: null,
                });
              }}
              className="border-luxury-cream text-luxury-charcoal hover:bg-luxury-gold/20"
              aria-label="Cancel creating maintenance request"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMaintenanceMutation.mutate(maintenanceForm)}
              disabled={
                createMaintenanceMutation.isPending || !maintenanceForm.title
              }
              className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
              aria-label="Create maintenance request"
            >
              {createMaintenanceMutation.isPending
                ? "Creating..."
                : "Create Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Payment Links Dialog */}
      <Dialog
        open={sendPaymentLinksOpen}
        onOpenChange={setSendPaymentLinksOpen}
      >
        <DialogContent className="bg-white border border-luxury-cream max-w-md">
          <DialogHeader>
            <DialogTitle className="text-luxury-charcoal flex items-center text-xl">
              <Send className="h-5 w-5 mr-2 text-luxury-gold" />
              Generate Payment Links
            </DialogTitle>
            <DialogDescription className="text-luxury-charcoal/70">
              Create payment links for tenants of {flat.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rent-amount" className="text-luxury-charcoal">
                Rent Amount
              </Label>
              <Input
                id="rent-amount"
                type="number"
                value={rentAmount}
                onChange={(e) => setRentAmount(e.target.value)}
                className="border-luxury-cream focus:ring-luxury-gold"
                placeholder="Enter rent amount"
                required
                aria-required="true"
              />
            </div>
            <div>
              <Label
                htmlFor="rent-description"
                className="text-luxury-charcoal"
              >
                Description
              </Label>
              <Input
                id="rent-description"
                value={rentDescription}
                onChange={(e) => setRentDescription(e.target.value)}
                className="border-luxury-cream focus:ring-luxury-gold"
                placeholder="Enter description"
                required
                aria-required="true"
              />
            </div>
            <div>
              <Label htmlFor="expiry-days" className="text-luxury-charcoal">
                Link Expiry (Days)
              </Label>
              <Input
                id="expiry-days"
                type="number"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                className="border-luxury-cream focus:ring-luxury-gold"
                placeholder="Enter expiry days"
                min="1"
                required
                aria-required="true"
              />
            </div>
          </div>
          <DialogFooter className="flex space-x-2 sm:space-x-0">
            <Button
              variant="outline"
              onClick={() => {
                setSendPaymentLinksOpen(false);
                setRentAmount("");
                setRentDescription("Rent Payment");
                setExpiryDays("7");
              }}
              className="border-luxury-cream text-luxury-charcoal hover:bg-luxury-gold/20"
              aria-label="Cancel generating payment links"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                createPaymentLinksMutation.mutate({
                  amount: Number(rentAmount),
                  description: rentDescription,
                  expiryDays: Number(expiryDays),
                })
              }
              disabled={
                createPaymentLinksMutation.isPending ||
                !rentAmount ||
                !rentDescription ||
                !expiryDays ||
                Number(expiryDays) < 1
              }
              className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
              aria-label="Generate payment links"
            >
              {createPaymentLinksMutation.isPending
                ? "Generating..."
                : "Generate Links"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Links Confirmation Card */}
      {paymentLinksData.length > 0 && (
        <Card className="bg-white shadow-md border border-luxury-cream rounded-lg mt-6">
          <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite">
            <CardTitle className="text-xl text-luxury-charcoal flex items-center">
              <Send className="h-5 w-5 mr-2 text-luxury-gold" />
              Send Payment Links via WhatsApp
            </CardTitle>
            <CardDescription className="text-luxury-charcoal/70">
              Review and send payment links to tenants
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {paymentLinksData.map((linkData) => {
              const tenant = flat?.tenants?.find(
                (t) => t.id === linkData.tenant_id
              );
              return (
                <div
                  key={linkData.id}
                  className="mb-4 p-4 border border-luxury-cream rounded-lg"
                >
                  <p className="text-luxury-charcoal font-medium">
                    Tenant: {tenant?.name || "Unknown"}
                  </p>
                  <p className="text-luxury-charcoal/70 text-sm mt-1">
                    Phone: {tenant?.phone || "N/A"}
                  </p>
                  <div className="flex items-center mt-1">
                    <p className="text-luxury-charcoal/70 text-sm mr-2">
                      Link:
                    </p>
                    <a
                      href={linkData.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-luxury-gold hover:underline text-sm truncate max-w-xs"
                      aria-label="Open payment link"
                    >
                      {linkData.link}
                    </a>
                  </div>
                  {tenant?.phone ? (
                    <WhatsAppIntegration
                      paymentLink={linkData.link}
                      tenantId={linkData.tenant_id}
                      phone={tenant.phone}
                      onError={(error) =>
                        toast({
                          variant: "destructive",
                          title: "WhatsApp Error",
                          description: error.message,
                        })
                      }
                    />
                  ) : (
                    <p className="text-red-600 text-sm mt-2">
                      Cannot send WhatsApp message: No phone number
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
          <CardFooter className="p-6 border-t border-luxury-cream">
            <Button
              variant="outline"
              onClick={() => setConfirmCloseOpen(true)}
              className="w-full border-luxury-cream text-luxury-charcoal hover:bg-luxury-gold/20"
              aria-label="Close payment links"
            >
              Close
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Confirm Close Payment Links Dialog */}
      <Dialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <DialogContent className="bg-white border border-luxury-cream max-w-md">
          <DialogHeader>
            <DialogTitle className="text-luxury-charcoal flex items-center text-xl">
              <Trash2 className="h-5 w-5 mr-2 text-red-600" />
              Confirm Close
            </DialogTitle>
            <DialogDescription className="text-luxury-charcoal/70">
              Are you sure you want to close? Any unsent payment links will be
              discarded.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex space-x-2 sm:space-x-0">
            <Button
              variant="outline"
              onClick={() => setConfirmCloseOpen(false)}
              className="border-luxury-cream text-luxury-charcoal hover:bg-luxury-gold/20"
              aria-label="Cancel closing payment links"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setPaymentLinksData([]);
                setSendPaymentLinksOpen(false);
                setRentAmount("");
                setRentDescription("Rent Payment");
                setExpiryDays("7");
                setConfirmCloseOpen(false);
              }}
              className="bg-red-600 text-white hover:bg-red-700"
              aria-label="Confirm close payment links"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FlatDetail;
