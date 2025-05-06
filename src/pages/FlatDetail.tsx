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
  Sofa,
  FileText,
  Phone,
  Mail,
  Trash2,
  Wrench,
  Send,
  Link as LinkIcon,
  Filter,
  DollarSign,
  Copy,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ArrowUpDown,
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
import { Textarea } from "@/components/ui/textarea";
import FlatForm from "@/components/forms/FlatForm";
import WhatsAppIntegration from "@/components/integrations/WhatsAppIntegration";
import FurnitureManager from "@/components/furniture/FurnitureManager";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, subDays, addMonths, subMonths, startOfMonth, endOfMonth, isSameMonth, isSameDay } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { Database } from "@/integrations/supabase/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Flat = Database["public"]["Tables"]["flats"]["Row"];
type MaintenanceRequest = Database["public"]["Tables"]["maintenance_requests"]["Row"];
type Expense = Database["public"]["Tables"]["expenses"]["Row"] & {
  receipt?: {
    file_path: string;
  };
};
type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
type RentType = Database["public"]["Tables"]["rents"]["Row"] & {
  tenant?: {
    id: string;
    name: string;
    phone: string | null;
  };
  payment_links?: Array<{
    id: string;
    payment_link: string;
    status: string | null;
  }>;
};

interface FurnitureItem {
  id: string;
  name: string;
  unit_rent: number;
  condition: string;
  total_quantity: number;
  available_quantity: number;
  purchase_date: string;
  purchase_price: number;
  category: string;
  is_appliance: boolean;
  flat_id: string;
  created_at: string;
}

interface FurnitureForm {
  name: string;
  unit_rent: string;
}

interface TenantFurnitureForm {
  furniture_item_id: string;
  category: string;
  assigned_quantity: string;
  purchase_price: string;
  purchase_date: string;
  condition: string;
}
interface TenantForm {
  name: string;
  phone: string;
  email?: string;
}

interface ExpenseFilter {
  startDate: string;
  endDate: string;
  category: string;
  minAmount: string;
  maxAmount: string;
}

interface RentWithRelations extends Omit<RentType, 'tenant' | 'payment_links'> {
  tenant?: {
    id: string;
    name: string;
    phone: string | null;
  };
  payment_links?: Array<{
    id: string;
    payment_link: string;
    status: string | null;
  }>;
}

interface PaymentLinkData {
  link: string;
  id: string;
  tenant_id: string;
}

interface ExpenseForm {
  title: string;
  amount: string;
  date: string;
  category: string;
  description?: string;
  receipt?: File;
}

interface FlatWithRelations {
  id: string;
  name: string;
  address: string;
  monthly_rent_target: number;
  created_at: string;
  description: string | null;
  security_deposit: number;
  tenants?: Tenant[];
  property_documents?: PropertyDocument[];
  property_photos?: PropertyPhoto[];
  property_tags?: {
    id: string;
    tag_name: string;
  }[];
}

interface PropertyDocument {
  id: string;
  name: string;
  document_type: string;
  file_path: string;
  uploaded_at: string | null;
}

interface PropertyPhoto {
  id: string;
  file_path: string;
  description: string | null;
  uploaded_at: string | null;
}

interface MaintenanceForm {
  title: string;
  description: string;
  priority: string;
  tenant_id: string | null;
}

interface RentStatistics {
  totalRents: number;
  paidRents: number;
  unpaidRents: number;
  collectionPercentage: number;
  monthlyStats: {
    [key: string]: {
      total: number;
      paid: number;
      unpaid: number;
      percentage: number;
    };
  };
}

interface MonthlyRentSummary {
  month: string;
  total: number;
  paid: number;
  unpaid: number;
  percentage: number;
}

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } },
};

const FlatDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const itemsPerPage = 10;
  
  // State declarations
  const [activeTab, setActiveTab] = useState("details");
  const [page, setPage] = useState(1);
  const [editOpen, setEditOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [addTenantOpen, setAddTenantOpen] = useState(false);
  const [assignTenantOpen, setAssignTenantOpen] = useState(false);
  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [deleteDocOpen, setDeleteDocOpen] = useState(false);
  const [createMaintenanceOpen, setCreateMaintenanceOpen] = useState(false);
  const [sendPaymentLinksOpen, setSendPaymentLinksOpen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [addFurnitureOpen, setAddFurnitureOpen] = useState(false);
  const [addTenantFurnitureOpen, setAddTenantFurnitureOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docName, setDocName] = useState<string>("");
  const [docType, setDocType] = useState<string>("other");
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>({
    title: "",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    category: "",
    description: "",
  });
  const [expenseReceipt, setExpenseReceipt] = useState<File | null>(null);
  const [rentAmount, setRentAmount] = useState<string>("");
  const [rentDescription, setRentDescription] = useState<string>("Rent Payment");
  const [expiryDays, setExpiryDays] = useState<string>("7");
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string | null>(null);
  const [paymentLinksData, setPaymentLinksData] = useState<PaymentLinkData[]>([]);
  const [rentStatusFilter, setRentStatusFilter] = useState("all");
  const [tenantPhoto, setTenantPhoto] = useState<File | null>(null);
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
  const [furnitureForm, setFurnitureForm] = useState<FurnitureForm>({
    name: "",
    unit_rent: "",
  });
  const [tenantFurnitureForm, setTenantFurnitureForm] = useState<TenantFurnitureForm>({
    furniture_item_id: "",
    category: "",
    assigned_quantity: "1",
    purchase_price: "",
    purchase_date: format(new Date(), "yyyy-MM-dd"),
    condition: "new",
  });
  const [selectedYear, setSelectedYear] = useState<string>(format(new Date(), "yyyy"));
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [dateRange, setDateRange] = useState<{start: string; end: string}>({
    start: format(subMonths(new Date(), 11), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });
  const [deleteRecordOpen, setDeleteRecordOpen] = useState(false);
  const [deleteRentOpen, setDeleteRentOpen] = useState(false);
  const [selectedRentId, setSelectedRentId] = useState<string | null>(null);

  // Tab change handler
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setPage(1);
  };

  // Fetch flat data first
  const {
    data: flat,
    isLoading,
    error,
  } = useQuery<FlatWithRelations>({
    queryKey: ["flat", id],
    queryFn: async () => {
      if (!id) throw new Error("Flat ID is required");
      const { data, error } = await typedSupabase
        .from("flats")
        .select(`
          *,
          tenants (*),
          property_documents (*),
          property_photos (*)
        `)
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message || "Flat not found");
      if (!data) throw new Error("Flat not found");
      return {
        ...data,
        tenants: data.tenants || [],
        property_documents: data.property_documents || [],
        property_photos: data.property_photos || [],
        description: data.description || null,
        security_deposit: data.security_deposit || 0,
      };
    },
    enabled: !!id,
  });

  // Then use flat in effects
  useEffect(() => {
    if (sendPaymentLinksOpen && flat?.monthly_rent_target) {
      setRentAmount(flat.monthly_rent_target.toString());
    }
  }, [sendPaymentLinksOpen, flat?.monthly_rent_target]);

  // Refetch flat details when dialogs are closed
  useEffect(() => {
    if (id) {
      queryClient.invalidateQueries({ queryKey: ["flat", id] });
    }
  }, [
    id,
    queryClient,
    editOpen,
    addTenantOpen,
    assignTenantOpen,
    uploadDocOpen,
    deleteDocOpen,
    createMaintenanceOpen,
    sendPaymentLinksOpen,
  ]);

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
  // Fetch furniture items
  const { data: furnitureItems, isLoading: furnitureLoading } = useQuery<FurnitureItem[]>({
    queryKey: ["furniture_items", id, page],
    queryFn: async () => {
      const { data, error } = await typedSupabase
        .from("furniture_items")
        .select("*")
        .eq("flat_id", id)
        .range((page - 1) * itemsPerPage, page * itemsPerPage - 1)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []) as FurnitureItem[];
    },
    enabled: !!id,
  });

  // Fetch tenant furniture assignments
  const { data: tenantFurniture, isLoading: tenantFurnitureLoading } = useQuery(
    {
      queryKey: ["tenant_furniture", id, page],
      queryFn: async () => {
        const { data, error } = await typedSupabase
          .from("tenant_furniture")
          .select(
            `
        id,
        assigned_quantity,
        assigned_on,
        rent_part,
        furniture_item:furniture_items(id, name, unit_rent, category, condition, purchase_date, purchase_price),
        tenant:tenants(id, name)
      `
          )
          .eq("tenant.flat_id", id)
          .range((page - 1) * itemsPerPage, page * itemsPerPage - 1)
          .order("assigned_on", { ascending: false });
        if (error) throw new Error(error.message);
        return data || [];
      },
      enabled: !!id,
    }
  );
  // Add tenant mutation
  const addTenantMutation = useMutation({
    mutationFn: async ({ name, phone, email }: TenantForm) => {
      let photoPath: string | null = null;

      if (tenantPhoto) {
        const fileExt = tenantPhoto.name.split(".").pop();
        const fileName = `${id}/tenant_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await typedSupabase.storage
          .from("tenant_photos")
          .upload(fileName, tenantPhoto);
        if (uploadError) throw new Error(uploadError.message);
        photoPath = fileName;
      }

      const { data, error } = await typedSupabase
        .from("tenants")
        .insert({
          name,
          phone,
          email: email || null,
          flat_id: id,
          start_date: new Date().toISOString().split("T")[0],
          is_active: true,
          tenant_photo: photoPath,
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
      setTenantPhoto(null);
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

  // Unassign tenant mutation
  const unassignTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
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
  const addFurnitureMutation = useMutation({
    mutationFn: async ({ name, unit_rent }: FurnitureForm) => {
      const { data, error } = await typedSupabase
        .from("furniture_items")
        .insert({
          flat_id: id,
          name,
          unit_rent: Number(unit_rent),
          condition: "new",
          total_quantity: 1,
          available_quantity: 1,
          purchase_date: new Date().toISOString().split("T")[0],
          purchase_price: 0,
          category: "Furniture",
          is_appliance: false,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["furniture_items", id] });
      toast({
        title: "Success",
        description: "Furniture item added successfully",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      setAddFurnitureOpen(false);
      setFurnitureForm({ name: "", unit_rent: "" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add furniture item",
      });
    },
  });
  const assignFurnitureMutation = useMutation({
    mutationFn: async (form: TenantFurnitureForm) => {
      const { data: furniture, error: fetchError } = await typedSupabase
        .from("furniture_items")
        .select("available_quantity")
        .eq("id", form.furniture_item_id)
        .single();
      if (fetchError) throw new Error(fetchError.message);
      if (!furniture) throw new Error("Furniture item not found");
      if (furniture.available_quantity < Number(form.assigned_quantity)) {
        throw new Error("Not enough available quantity");
      }

      const { data, error } = await typedSupabase
        .from("tenant_furniture")
        .insert({
          tenant_id: flat.tenants?.[0]?.id,
          furniture_item_id: form.furniture_item_id,
          assigned_quantity: Number(form.assigned_quantity),
          rent_part: Number(form.purchase_price),
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      // Update available quantity
      const { error: updateError } = await typedSupabase
        .from("furniture_items")
        .update({
          available_quantity:
            furniture.available_quantity - Number(form.assigned_quantity),
        })
        .eq("id", form.furniture_item_id);
      if (updateError) throw new Error(updateError.message);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant_furniture", id] });
      queryClient.invalidateQueries({ queryKey: ["furniture_items", id] });
      toast({
        title: "Success",
        description: "Furniture assigned successfully",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      setAddTenantFurnitureOpen(false);
      setTenantFurnitureForm({
        furniture_item_id: "",
        category: "",
        assigned_quantity: "1",
        purchase_price: "",
        purchase_date: format(new Date(), "yyyy-MM-dd"),
        condition: "new",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to assign furniture",
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
            flat_id: id,
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

  const addExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseForm) => {
      let receiptId: string | null = null;

      if (expenseReceipt) {
        const fileExt = expenseReceipt.name.split(".").pop();
        const fileName = `${id}/expenses/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await typedSupabase.storage
          .from("property_documents")
          .upload(fileName, expenseReceipt);
        if (uploadError) throw new Error(uploadError.message);

        const { data: docData, error: docError } = await typedSupabase
          .from("property_documents")
          .insert({
            flat_id: id,
            file_path: fileName,
            name: expenseReceipt.name,
            document_type: "expense_receipt",
          })
          .select()
          .single();

        if (docError) throw new Error(docError.message);
        receiptId = docData.id;
      }

      const { data: expense, error } = await typedSupabase
        .from("expenses")
        .insert({
          flat_id: id,
          title: data.title,
          amount: Number(data.amount),
          date: data.date,
          description: data.description || null,
          category: data.category,
          receipt_id: receiptId,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return expense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", id] });
      toast({
        title: "Success",
        description: "Expense added successfully",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      setAddExpenseOpen(false);
      setExpenseForm({
        title: "",
        amount: "",
        date: format(new Date(), "yyyy-MM-dd"),
        category: "",
        description: "",
      });
      setExpenseReceipt(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add expense",
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

  // Add maintenance requests query
  const {
    data: maintenanceRequests,
    isLoading: maintenanceLoading,
  } = useQuery({
    queryKey: ["maintenance_requests", id],
    queryFn: async () => {
      if (!id) throw new Error("Flat ID is required");
      const { data, error } = await typedSupabase
        .from("maintenance_requests")
        .select(`
          *,
          tenant:tenants(id, name)
        `)
        .eq("flat_id", id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!id,
  });

  // Add expenses query
  const {
    data: expenses,
    isLoading: expensesLoading,
  } = useQuery({
    queryKey: ["expenses", id],
    queryFn: async () => {
      if (!id) throw new Error("Flat ID is required");
      const { data, error } = await typedSupabase
        .from("expenses")
        .select("*")
        .eq("flat_id", id)
        .order("date", { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!id,
  });

  // Update the rents query
  const {
    data: rents,
    isLoading: rentsLoading,
  } = useQuery<RentWithRelations[]>({
    queryKey: ["rents", id],
    queryFn: async () => {
      if (!id) throw new Error("Flat ID is required");
      const { data, error } = await typedSupabase
        .from("rents")
        .select(`
          *,
          tenant:tenants(id, name, phone),
          payment_links(id, payment_link, status)
        `)
        .eq("flat_id", id)
        .order("due_date", { ascending: false });
      if (error) throw new Error(error.message);
      return (data as unknown as RentWithRelations[]) || [];
    },
    enabled: !!id,
  });

  // Add the delete rent mutation
  const deleteRentMutation = useMutation({
    mutationFn: async (rentId: string) => {
      const { error } = await typedSupabase
        .from("rents")
        .delete()
        .eq("id", rentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rents", id] });
      toast({
        title: "Success",
        description: "Rent record deleted successfully",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete rent record",
      });
    },
  });

  // Add the update rent status mutation
  const updateRentStatusMutation = useMutation({
    mutationFn: async ({ rentId, isPaid }: { rentId: string; isPaid: boolean }) => {
      const { error } = await typedSupabase
        .from("rents")
        .update({
          is_paid: isPaid,
          paid_on: isPaid ? new Date().toISOString().split("T")[0] : null,
        })
        .eq("id", rentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rents", id] });
      toast({
        title: "Success",
        description: "Rent status updated successfully",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update rent status",
      });
    },
  });

  // Calculate rent statistics
  const calculateRentStatistics = (rents: RentWithRelations[]): RentStatistics => {
    const stats: RentStatistics = {
      totalRents: 0,
      paidRents: 0,
      unpaidRents: 0,
      collectionPercentage: 0,
      monthlyStats: {},
    };

    if (!rents || rents.length === 0) return stats;

    rents.forEach((rent) => {
      const monthKey = format(new Date(rent.due_date), "yyyy-MM");
      if (!stats.monthlyStats[monthKey]) {
        stats.monthlyStats[monthKey] = {
          total: 0,
          paid: 0,
          unpaid: 0,
          percentage: 0,
        };
      }

      stats.totalRents += rent.amount;
      stats.monthlyStats[monthKey].total += rent.amount;

      if (rent.is_paid) {
        stats.paidRents += rent.amount;
        stats.monthlyStats[monthKey].paid += rent.amount;
      } else {
        stats.unpaidRents += rent.amount;
        stats.monthlyStats[monthKey].unpaid += rent.amount;
      }
    });

    stats.collectionPercentage = (stats.paidRents / stats.totalRents) * 100;

    // Calculate monthly percentages
    Object.keys(stats.monthlyStats).forEach((month) => {
      const monthStats = stats.monthlyStats[month];
      monthStats.percentage = (monthStats.paid / monthStats.total) * 100;
    });

    return stats;
  };

  // Get monthly summaries
  const getMonthlySummaries = (stats: RentStatistics): MonthlyRentSummary[] => {
    return Object.entries(stats.monthlyStats)
      .map(([month, data]) => ({
        month,
        ...data,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  };

  const rentStats = calculateRentStatistics((rents || []) as RentWithRelations[]);
  const monthlySummaries = getMonthlySummaries(rentStats);

  const getChartData = (rents: RentWithRelations[]) => {
    const monthlyData: { [key: string]: { month: string; total: number; collected: number } } = {};
    
    rents.forEach(rent => {
      const monthKey = format(new Date(rent.due_date), "MMM yyyy");
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          total: 0,
          collected: 0,
        };
      }
      monthlyData[monthKey].total += rent.amount;
      if (rent.is_paid) {
        monthlyData[monthKey].collected += rent.amount;
      }
    });

    return Object.values(monthlyData).sort((a, b) => 
      new Date(a.month).getTime() - new Date(b.month).getTime()
    );
  };

  // Add delete flat mutation after other mutations
  const deleteFlatMutation = useMutation({
    mutationFn: async () => {
      // First delete all related records
      const { error: relatedError } = await typedSupabase
        .from("flats")
        .delete()
        .eq("id", id);
      if (relatedError) throw new Error(relatedError.message);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Property deleted successfully",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      // Navigate back to flats list
      window.location.href = "/flats";
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete property",
      });
    },
  });

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
      className="w-full min-h-screen bg-luxury-softwhite px-2 sm:px-4 lg:px-8 py-2 sm:py-4 lg:py-8 overflow-x-hidden"
      role="main"
      aria-label="Property Details"
    >
      {/* Header Section - Make more mobile friendly */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6 pb-4 border-b border-luxury-cream">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link to="/flats">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 sm:h-10 sm:w-10 border-luxury-cream hover:bg-luxury-gold/20 rounded-full"
              aria-label="Back to properties"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-luxury-charcoal" />
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-luxury-charcoal">
                {flat.name}
              </h1>
              {renderAvailabilityBadge()}
            </div>
            <p className="text-sm sm:text-base text-luxury-charcoal/70 mt-1">
              {flat.address}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setEditOpen(true)}
            className="w-full sm:w-auto border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal text-sm flex items-center transition-colors duration-200"
            aria-label="Edit property"
          >
            <Edit className="h-4 w-4 mr-2" /> Edit
          </Button>
          <Button
            className="w-full sm:w-auto bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80 text-sm flex items-center"
            onClick={() => handleTabChange("tenants")}
            aria-label="Manage tenants"
          >
            <Users2 className="h-4 w-4 mr-2" />
            {flat.tenants && flat.tenants.length > 0
              ? "Manage Tenants"
              : "Add Tenant"}
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeleteRecordOpen(true)}
            className="w-full sm:w-auto text-sm flex items-center"
            aria-label="Delete property"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </Button>
        </div>
      </div>

      {/* Tabs Navigation - Make scrollable on mobile */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
        aria-label="Property tabs"
      >
        <div className="relative">
          <ScrollArea className="w-full">
            <TabsList className="inline-flex w-auto min-w-full sm:w-full mb-4 sm:mb-6 bg-luxury-cream/30 rounded-full border border-luxury-cream p-1 gap-1">
              <TabsTrigger
                value="details"
                className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal text-sm whitespace-nowrap px-3 py-1.5"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="tenants"
                className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal text-sm whitespace-nowrap px-3 py-1.5"
              >
                Tenants {flat.tenants?.length ? `(${flat.tenants.length})` : ""}
              </TabsTrigger>
              <TabsTrigger
                value="documents"
                className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal text-sm whitespace-nowrap px-3 py-1.5"
              >
                Documents{" "}
                {flat.property_documents?.length
                  ? `(${flat.property_documents.length})`
                  : "(0)"}
              </TabsTrigger>
              <TabsTrigger
                value="rents"
                className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal text-sm whitespace-nowrap px-3 py-1.5"
              >
                Rent Collection
              </TabsTrigger>
              <TabsTrigger
                value="furniture"
                className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal text-sm whitespace-nowrap px-3 py-1.5"
              >
                Furniture{" "}
                {furnitureItems?.length ? `(${furnitureItems.length})` : ""}
              </TabsTrigger>
              <TabsTrigger
                value="maintenance"
                className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal text-sm whitespace-nowrap px-3 py-1.5"
              >
                Maintenance{" "}
                {maintenanceRequests?.length
                  ? `(${maintenanceRequests.length})`
                  : ""}
              </TabsTrigger>
              <TabsTrigger
                value="expenses"
                className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal text-sm whitespace-nowrap px-3 py-1.5"
              >
                Expenses {expenses?.length ? `(${expenses.length})` : ""}
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" className="h-2 bg-luxury-cream/20" />
          </ScrollArea>
        </div>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="bg-white border border-luxury-cream rounded-lg shadow-xl w-[95vw] max-w-lg mx-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-2xl text-luxury-charcoal">
                Edit Property
              </DialogTitle>
            </DialogHeader>
            <FlatForm 
              open={editOpen}
              onOpenChange={setEditOpen}
              flat={{
                id: flat.id,
                name: flat.name,
                address: flat.address,
                monthly_rent_target: flat.monthly_rent_target,
                created_at: flat.created_at,
                description: flat.description || "",
                security_deposit: flat.security_deposit || 0,
              }}
              onSuccess={() => {
                setEditOpen(false);
                queryClient.invalidateQueries({ queryKey: ["flat", id] });
                queryClient.invalidateQueries({ queryKey: ["flats"] });
                toast({
                  title: "Success",
                  description: "Property updated successfully",
                  className: "bg-luxury-gold text-luxury-charcoal border-none",
                });
              }}
            />
          </DialogContent>
        </Dialog>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <TabsContent value="details" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                <div className="lg:col-span-2 space-y-4 sm:space-y-6">
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

                <div className="space-y-4 sm:space-y-6">
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
            <TabsContent value="furniture" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                  <Card className="bg-white shadow-md border border-luxury-cream rounded-lg">
                    <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite border-b border-luxury-cream">
                      <CardTitle className="text-xl text-luxury-charcoal flex items-center">
                        <Sofa className="h-5 w-5 mr-2 text-luxury-gold" />
                        Furniture Management
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <FurnitureManager flatId={id} />
                    </CardContent>
                  </Card>
                </div>
                <div className="space-y-4 sm:space-y-6">
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
                        Furniture Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <Button
                          onClick={() => handleTabChange("tenants")}
                          variant="outline"
                          className="w-full border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal justify-start"
                          aria-label="Manage tenants"
                        >
                          <Users2 className="h-4 w-4 mr-2" />
                          Manage Tenants
                        </Button>
                        <Button
                          onClick={() => handleTabChange("rents")}
                          variant="outline"
                          className="w-full border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal justify-start"
                          aria-label="Manage rent collection"
                        >
                          <Banknote className="h-4 w-4 mr-2" />
                          Rent Collection
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
                        <Button
                          onClick={() => handleTabChange("expenses")}
                          variant="outline"
                          className="w-full border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal justify-start"
                          aria-label="View expenses"
                        >
                          <DollarSign className="h-4 w-4 mr-2" />
                          View Expenses
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tenants" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                <div className="lg:col-span-2 space-y-4 sm:space-y-6">
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

                <div className="space-y-4 sm:space-y-6">
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
                        <Button
                          onClick={() => handleTabChange("expenses")}
                          variant="outline"
                          className="w-full border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal justify-start"
                          aria-label="View expenses"
                        >
                          <DollarSign className="h-4 w-4 mr-2" />
                          View Expenses
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                <div className="lg:col-span-2 space-y-4 sm:space-y-6">
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

                <div className="space-y-4 sm:space-y-6">
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
                                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                  {/* Rent Statistics Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Card className="bg-white shadow-sm border border-luxury-cream">
                      <CardContent className="p-4">
                        <div className="flex flex-col">
                          <span className="text-xs sm:text-sm text-luxury-charcoal/70">Total Collection</span>
                          <span className="text-lg sm:text-2xl font-semibold text-luxury-charcoal">
                            ₹{rentStats.totalRents.toLocaleString()}
                          </span>
                          <span className="text-xs sm:text-sm text-luxury-charcoal/70 mt-1">
                            All time
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white shadow-sm border border-luxury-cream">
                      <CardContent className="p-4">
                        <div className="flex flex-col">
                          <span className="text-xs sm:text-sm text-luxury-charcoal/70">Collected</span>
                          <span className="text-lg sm:text-2xl font-semibold text-emerald-600">
                            ₹{rentStats.paidRents.toLocaleString()}
                          </span>
                          <span className="text-xs sm:text-sm text-emerald-600/70 mt-1">
                            {rentStats.collectionPercentage.toFixed(1)}% collected
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white shadow-sm border border-luxury-cream">
                      <CardContent className="p-4">
                        <div className="flex flex-col">
                          <span className="text-xs sm:text-sm text-luxury-charcoal/70">Pending</span>
                          <span className="text-lg sm:text-2xl font-semibold text-red-600">
                            ₹{rentStats.unpaidRents.toLocaleString()}
                          </span>
                          <span className="text-xs sm:text-sm text-red-600/70 mt-1">
                            {(100 - rentStats.collectionPercentage).toFixed(1)}% pending
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white shadow-sm border border-luxury-cream">
                      <CardContent className="p-4">
                        <div className="flex flex-col">
                          <span className="text-xs sm:text-sm text-luxury-charcoal/70">This Month</span>
                          <span className="text-lg sm:text-2xl font-semibold text-luxury-charcoal">
                            ₹{(rentStats.monthlyStats[selectedMonth]?.total || 0).toLocaleString()}
                          </span>
                          <span className="text-xs sm:text-sm text-luxury-charcoal/70 mt-1">
                            {rentStats.monthlyStats[selectedMonth]?.percentage.toFixed(1) || 0}% collected
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Monthly Summary Table */}
                  <Card className="bg-white shadow-md border border-luxury-cream rounded-lg">
                    <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite border-b border-luxury-cream">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <CardTitle className="text-xl text-luxury-charcoal flex items-center">
                          <Calendar className="h-5 w-5 mr-2 text-luxury-gold" />
                          Monthly Collection Summary
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={selectedYear}
                            onValueChange={setSelectedYear}
                          >
                            <SelectTrigger className="w-[120px] border-luxury-cream/50 bg-white focus:ring-luxury-gold h-8">
                              <SelectValue placeholder="Select year" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from(new Set(monthlySummaries.map(s => s.month.substring(0, 4)))).map(year => (
                                <SelectItem key={year} value={year}>{year}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-luxury-cream bg-luxury-cream/5">
                              <th className="px-4 py-3 text-left text-sm font-medium text-luxury-charcoal">Month</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-luxury-charcoal">Total</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-luxury-charcoal">Collected</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-luxury-charcoal">Pending</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-luxury-charcoal">Collection %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlySummaries
                              .filter(summary => summary.month.startsWith(selectedYear))
                              .map((summary) => (
                                <tr key={summary.month} className="border-b border-luxury-cream hover:bg-luxury-cream/5">
                                  <td className="px-4 py-3 text-sm text-luxury-charcoal whitespace-nowrap">
                                    {format(new Date(summary.month), "MMMM yyyy")}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-luxury-charcoal whitespace-nowrap">
                                    ₹{summary.total.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-emerald-600 whitespace-nowrap">
                                    ₹{summary.paid.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-red-600 whitespace-nowrap">
                                    ₹{summary.unpaid.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right">
                                    <Badge className={summary.percentage >= 90 ? "bg-emerald-100 text-emerald-700" : 
                                                   summary.percentage >= 70 ? "bg-amber-100 text-amber-700" :
                                                   "bg-red-100 text-red-700"}>
                                      {summary.percentage.toFixed(1)}%
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Rent Collection List */}
                  <Card className="bg-white shadow-md border border-luxury-cream rounded-lg">
                    <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite border-b border-luxury-cream">
                      <div className="flex flex-col space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <CardTitle className="text-xl text-luxury-charcoal flex items-center">
                            <Banknote className="h-5 w-5 mr-2 text-luxury-gold" />
                            Rent Collection
                          </CardTitle>
                          <Button
                            onClick={() => setSendPaymentLinksOpen(true)}
                            className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                          >
                            <FilePlus className="h-4 w-4 mr-2" />
                            Create Rent Invoice
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="flex flex-col space-y-2">
                            <Label htmlFor="month-filter" className="text-sm text-luxury-charcoal/70">
                              <Calendar className="h-4 w-4 inline-block mr-1.5" />
                              Month
                            </Label>
                            <Input
                              id="month-filter"
                              type="month"
                              value={selectedMonth}
                              onChange={(e) => setSelectedMonth(e.target.value)}
                              className="border-luxury-cream/50 bg-white focus:ring-luxury-gold h-9"
                            />
                          </div>
                          <div className="flex flex-col space-y-2">
                            <Label htmlFor="status-filter" className="text-sm text-luxury-charcoal/70">
                              <Filter className="h-4 w-4 inline-block mr-1.5" />
                              Status
                            </Label>
                            <Select 
                              value={rentStatusFilter}
                              onValueChange={setRentStatusFilter}
                            >
                              <SelectTrigger id="status-filter" className="border-luxury-cream/50 bg-white focus:ring-luxury-gold h-9">
                                <SelectValue placeholder="Filter by status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="unpaid">Unpaid</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col space-y-2">
                            <Label htmlFor="sort-filter" className="text-sm text-luxury-charcoal/70">
                              <ArrowUpDown className="h-4 w-4 inline-block mr-1.5" />
                              Sort
                            </Label>
                            <Select defaultValue="date-desc">
                              <SelectTrigger id="sort-filter" className="border-luxury-cream/50 bg-white focus:ring-luxury-gold h-9">
                                <SelectValue placeholder="Sort by" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="date-desc">Date (Newest)</SelectItem>
                                <SelectItem value="date-asc">Date (Oldest)</SelectItem>
                                <SelectItem value="amount-desc">Amount (High)</SelectItem>
                                <SelectItem value="amount-asc">Amount (Low)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
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
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : rents && rents.length > 0 ? (
                        <ul className="space-y-6">
                          {rents
                            .filter(rent => {
                              // Filter by month
                              const rentMonth = format(new Date(rent.due_date), "yyyy-MM");
                              const monthMatch = selectedMonth ? rentMonth === selectedMonth : true;
                              
                              // Filter by status
                              const statusMatch = rentStatusFilter === "all" 
                                ? true 
                                : rentStatusFilter === "paid" 
                                  ? rent.is_paid 
                                  : !rent.is_paid;
                              
                              return monthMatch && statusMatch;
                            })
                            .map((rent) => (
                              <li
                                key={rent.id}
                                className="border border-luxury-cream rounded-lg p-4 hover:bg-luxury-cream/10 transition-colors"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                  <div className="space-y-2">
                                    <h3 className="font-medium text-luxury-charcoal">
                                      {rent.tenant?.name || "Flat Rent"}
                                    </h3>
                                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-luxury-charcoal/70">
                                      <p className="flex items-center">
                                        <Calendar className="h-4 w-4 mr-1.5" />
                                        Due: {format(new Date(rent.due_date), "dd MMM yyyy")}
                                      </p>
                                      <p className="flex items-center">
                                        <Banknote className="h-4 w-4 mr-1.5" />
                                        Amount: ₹{rent.amount.toLocaleString()}
                                      </p>
                                      <Badge className={rent.is_paid 
                                        ? "bg-emerald-100 text-emerald-600 border-emerald-200"
                                        : "bg-red-100 text-red-600 border-red-200"}>
                                        {rent.is_paid ? "Paid" : "Unpaid"}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                      variant={rent.is_paid ? "destructive" : "default"}
                                      size="sm"
                                      onClick={() => updateRentStatusMutation.mutate({
                                        rentId: rent.id,
                                        isPaid: !rent.is_paid,
                                      })}
                                      className={rent.is_paid 
                                        ? "bg-red-100 text-red-600 hover:bg-red-200"
                                        : "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                                      }
                                    >
                                      {rent.is_paid ? "Mark Unpaid" : "Mark Paid"}
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedRentId(rent.id);
                                        setDeleteRentOpen(true);
                                      }}
                                      className="bg-red-500 hover:bg-red-600"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                    {rent.tenant?.phone && (
                                      <WhatsAppIntegration
                                        phone={rent.tenant.phone}
                                        message={`Dear ${rent.tenant.name}, your rent payment of ₹${rent.amount.toLocaleString()} was due on ${format(new Date(rent.due_date), "dd MMM yyyy")}. Please make the payment at your earliest convenience.`}
                                        buttonLabel="Send Reminder"
                                        buttonClassName="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                                      />
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
                          >
                            <FilePlus className="h-4 w-4 mr-2" />
                            Create Rent Invoice
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Payment History Chart - Moved to bottom */}
                  <Card className="bg-white shadow-md border border-luxury-cream rounded-lg">
                    <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite border-b border-luxury-cream">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <CardTitle className="text-xl text-luxury-charcoal flex items-center">
                          <LineChart className="h-5 w-5 mr-2 text-luxury-gold" />
                          Payment History
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Label htmlFor="start-date" className="text-xs sm:text-sm text-luxury-charcoal/70">From</Label>
                            <Input
                              id="start-date"
                              type="date"
                              value={dateRange.start}
                              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                              className="w-28 sm:w-36 border-luxury-cream/50 bg-white focus:ring-luxury-gold h-8"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor="end-date" className="text-xs sm:text-sm text-luxury-charcoal/70">To</Label>
                            <Input
                              id="end-date"
                              type="date"
                              value={dateRange.end}
                              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                              className="w-28 sm:w-36 border-luxury-cream/50 bg-white focus:ring-luxury-gold h-8"
                            />
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="h-[300px] sm:h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={getChartData((rents || []) as RentWithRelations[])}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis
                              dataKey="month"
                              stroke="#6B7280"
                              fontSize={12}
                              tickLine={false}
                              angle={-45}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis
                              stroke="#6B7280"
                              fontSize={12}
                              tickLine={false}
                              tickFormatter={(value) => `₹${value.toLocaleString()}`}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "white",
                                border: "1px solid #E5E7EB",
                                borderRadius: "0.375rem",
                              }}
                              formatter={(value: number) => [`₹${value.toLocaleString()}`, ""]}
                            />
                            <Line
                              type="monotone"
                              dataKey="total"
                              stroke="#9CA3AF"
                              strokeWidth={2}
                              name="Total Rent"
                              dot={{ fill: "#9CA3AF" }}
                            />
                            <Line
                              type="monotone"
                              dataKey="collected"
                              stroke="#059669"
                              strokeWidth={2}
                              name="Collected"
                              dot={{ fill: "#059669" }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4 sm:space-y-6">
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
                          onClick={() => handleTabChange("tenants")}
                          variant="outline"
                          className="w-full border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal justify-start"
                          aria-label="Manage tenants"
                        >
                          <Users2 className="h-4 w-4 mr-2" />
                          Manage Tenants
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
                        <Button
                          onClick={() => handleTabChange("expenses")}
                          variant="outline"
                          className="w-full border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal justify-start"
                          aria-label="View expenses"
                        >
                          <DollarSign className="h-4 w-4 mr-2" />
                          View Expenses
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="maintenance" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                  <Card className="bg-white shadow-md border border-luxury-cream rounded-lg">
                    <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite border-b border-luxury-cream">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl text-luxury-charcoal flex items-center">
                          <Wrench className="h-5 w-5 mr-2 text-luxury-gold" />
                          Maintenance Requests
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCreateMaintenanceOpen(true)}
                          className="border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal"
                          aria-label="Create maintenance request"
                        >
                          <FilePlus className="h-4 w-4 mr-1" /> New Request
                        </Button>
                      </div>
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
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : maintenanceRequests &&
                        maintenanceRequests.length > 0 ? (
                        <ul className="space-y-6">
                          {maintenanceRequests.map((request) => (
                            <li
                              key={request.id}
                              className="border border-luxury-cream rounded-lg p-4 hover:bg-luxury-cream/10 transition-colors"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                                <div>
                                  <h3 className="font-medium text-luxury-charcoal">
                                    {request.title}
                                  </h3>
                                  <p className="text-sm text-luxury-charcoal/70">
                                    {request.description || "No description"}
                                  </p>
                                  <p className="text-sm text-luxury-charcoal/70">
                                    Reported by:{" "}
                                    {request.tenant?.name || "Property Manager"}
                                  </p>
                                  <p className="text-sm text-luxury-charcoal/70">
                                    Created:{" "}
                                    {new Date(
                                      request.created_at
                                    ).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-2 mt-4 sm:mt-0">
                                  <Badge
                                    variant={
                                      request.status === "open"
                                        ? "destructive"
                                        : request.status === "in_progress"
                                        ? "default"
                                        : "secondary"
                                    }
                                    className={
                                      request.status === "open"
                                        ? "bg-red-50 text-red-600 border-red-200"
                                        : request.status === "in_progress"
                                        ? "bg-amber-50 text-amber-600 border-amber-200"
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
                                        ? "bg-red-100 text-red-700 border-red-200"
                                        : request.priority === "medium"
                                        ? "bg-amber-100 text-amber-700 border-amber-200"
                                        : "bg-blue-100 text-blue-700 border-blue-200"
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
                            aria-label="Create new maintenance request"
                          >
                            <FilePlus className="h-4 w-4 mr-2" />
                            New Maintenance Request
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

                <div className="space-y-4 sm:space-y-6">
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
                          <FilePlus className="h-4 w-4 mr-2" />
                          New Maintenance Request
                        </Button>
                        <Button
                          onClick={() => handleTabChange("tenants")}
                          variant="outline"
                          className="w-full border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal justify-start"
                          aria-label="Manage tenants"
                        >
                          <Users2 className="h-4 w-4 mr-2" />
                          Manage Tenants
                        </Button>
                        <Button
                          onClick={() => handleTabChange("rents")}
                          variant="outline"
                          className="w-full border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal justify-start"
                          aria-label="Manage rent collection"
                        >
                          <Banknote className="h-4 w-4 mr-2" />
                          Rent Collection
                        </Button>
                        <Button
                          onClick={() => handleTabChange("expenses")}
                          variant="outline"
                          className="w-full border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal justify-start"
                          aria-label="View expenses"
                        >
                          <DollarSign className="h-4 w-4 mr-2" />
                          View Expenses
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="expenses" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                  <Card className="bg-white shadow-md border border-luxury-cream rounded-lg">
                    <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite border-b border-luxury-cream">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl text-luxury-charcoal flex items-center">
                          <DollarSign className="h-5 w-5 mr-2 text-luxury-gold" />
                          Expenses
                        </CardTitle>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAddExpenseOpen(true)}
                            className="border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal"
                            aria-label="Add expense"
                          >
                            <FilePlus className="h-4 w-4 mr-1" /> Add Expense
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTabChange("expenses")}
                            className="border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal"
                            aria-label="Filter expenses"
                          >
                            <Filter className="h-4 w-4 mr-1" /> Filter
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {expensesLoading ? (
                        <div className="space-y-4">
                          {[...Array(3)].map((_, i) => (
                            <div
                              key={i}
                              className="animate-pulse border border-luxury-cream rounded-lg p-4"
                            >
                              <div className="space-y-2">
                                <div className="h-4 bg-luxury-cream/50 rounded w-3/4"></div>
                                <div className="h-3 bg-luxury-cream/50 rounded w-1/2"></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : expenses && expenses.length > 0 ? (
                        <ul className="space-y-6">
                          {expenses.map((expense) => (
                            <li
                              key={expense.id}
                              className="border border-luxury-cream rounded-lg p-4 hover:bg-luxury-cream/10 transition-colors"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                                <div>
                                  <h3 className="font-medium text-luxury-charcoal">
                                    {expense.title}
                                  </h3>
                                  <p className="text-sm text-luxury-charcoal/70">
                                    Amount: ₹{expense.amount.toLocaleString()}
                                  </p>
                                  <p className="text-sm text-luxury-charcoal/70">
                                    Date:{" "}
                                    {new Date(
                                      expense.date
                                    ).toLocaleDateString()}
                                  </p>
                                  <p className="text-sm text-luxury-charcoal/70">
                                    Category: {expense.category || "N/A"}
                                  </p>
                                  {expense.description && (
                                    <p className="text-sm text-luxury-charcoal/70">
                                      Description: {expense.description}
                                    </p>
                                  )}
                                  {expense.receipt && (
                                    <a
                                      href={
                                        typedSupabase.storage
                                          .from("property_documents")
                                          .getPublicUrl(
                                            expense.receipt.file_path
                                          ).data.publicUrl
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-luxury-gold hover:underline text-sm flex items-center mt-1"
                                      aria-label={`View receipt for ${expense.title}`}
                                    >
                                      <FileText className="h-4 w-4 mr-1" />
                                      View Receipt
                                    </a>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2 mt-4 sm:mt-0">
                                  <Badge className="bg-luxury-gold/20 text-luxury-charcoal">
                                    {expense.category || "Uncategorized"}
                                  </Badge>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-center py-16 border border-dashed border-luxury-cream rounded-lg">
                          <DollarSign className="h-16 w-16 text-luxury-charcoal/30 mx-auto mb-4" />
                          <h3 className="text-xl font-medium text-luxury-charcoal mb-3">
                            No expenses recorded
                          </h3>
                          <p className="text-luxury-charcoal/70 mb-6 max-w-md mx-auto">
                            No expenses have been recorded for this property.
                          </p>
                        </div>
                      )}
                    </CardContent>
                    {expenses && expenses.length > itemsPerPage && (
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
                          disabled={expenses.length <= page * itemsPerPage}
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

                <div className="space-y-4 sm:space-y-6">
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
                        Expense Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <Button
                          onClick={() => handleTabChange("tenants")}
                          variant="outline"
                          className="w-full border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal justify-start"
                          aria-label="Manage tenants"
                        >
                          <Users2 className="h-4 w-4 mr-2" />
                          Manage Tenants
                        </Button>
                        <Button
                          onClick={() => handleTabChange("rents")}
                          variant="outline"
                          className="w-full border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal justify-start"
                          aria-label="Manage rent collection"
                        >
                          <Banknote className="h-4 w-4 mr-2" />
                          Rent Collection
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
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>
      {/* Responsive Dialogs */}
      <Dialog open={addFurnitureOpen} onOpenChange={setAddFurnitureOpen}>
        <DialogContent className="bg-white border border-luxury-cream rounded-lg shadow-xl w-[95vw] max-w-lg mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl text-luxury-charcoal">
              Add New Furniture Item
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addFurnitureMutation.mutate(furnitureForm);
            }}
            className="space-y-6"
          >
            <div>
              <Label htmlFor="name" className="text-luxury-charcoal">
                Name
              </Label>
              <Select
                value={furnitureForm.name}
                onValueChange={(value) =>
                  setFurnitureForm({ ...furnitureForm, name: value })
                }
                required
              >
                <SelectTrigger
                  id="name"
                  className="border-luxury-cream focus:ring-luxury-gold"
                >
                  <SelectValue placeholder="Select furniture item" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bed">Bed</SelectItem>
                  <SelectItem value="Fridge">Fridge</SelectItem>
                  <SelectItem value="Sofa">Sofa</SelectItem>
                  <SelectItem value="Table">Table</SelectItem>
                  <SelectItem value="Chair">Chair</SelectItem>
                  <SelectItem value="Wardrobe">Wardrobe</SelectItem>
                  <SelectItem value="TV">TV</SelectItem>
                  <SelectItem value="AC">AC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="unit_rent" className="text-luxury-charcoal">
                Monthly Rent (₹)
              </Label>
              <Input
                id="unit_rent"
                type="number"
                value={furnitureForm.unit_rent}
                onChange={(e) =>
                  setFurnitureForm({
                    ...furnitureForm,
                    unit_rent: e.target.value,
                  })
                }
                required
                className="border-luxury-cream focus:ring-luxury-gold"
                placeholder="Enter monthly rent"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddFurnitureOpen(false)}
                className="border-luxury-cream hover:bg-luxury-cream/20"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                disabled={addFurnitureMutation.isPending}
              >
                {addFurnitureMutation.isPending ? "Adding..." : "Add Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={addTenantFurnitureOpen}
        onOpenChange={setAddTenantFurnitureOpen}
      >
        <DialogContent className="bg-white border border-luxury-cream rounded-lg shadow-xl w-[95vw] max-w-lg mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl text-luxury-charcoal">
              Assign Furniture to Tenant
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              assignFurnitureMutation.mutate(tenantFurnitureForm);
            }}
            className="space-y-6"
          >
            <div>
              <Label
                htmlFor="furniture_item_id"
                className="text-luxury-charcoal"
              >
                Furniture Item
              </Label>
              <Select
                value={tenantFurnitureForm.furniture_item_id}
                onValueChange={(value) =>
                  setTenantFurnitureForm({
                    ...tenantFurnitureForm,
                    furniture_item_id: value,
                  })
                }
                required
              >
                <SelectTrigger
                  id="furniture_item_id"
                  className="border-luxury-cream focus:ring-luxury-gold"
                >
                  <SelectValue placeholder="Select furniture item" />
                </SelectTrigger>
                <SelectContent>
                  {furnitureItems
                    ?.filter((item) => item.available_quantity > 0)
                    .map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} (Available: {item.available_quantity})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="category" className="text-luxury-charcoal">
                Category
              </Label>
              <Select
                value={tenantFurnitureForm.category}
                onValueChange={(value) =>
                  setTenantFurnitureForm({
                    ...tenantFurnitureForm,
                    category: value,
                  })
                }
                required
              >
                <SelectTrigger
                  id="category"
                  className="border-luxury-cream focus:ring-luxury-gold"
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Furniture">Furniture</SelectItem>
                  <SelectItem value="Appliance">Appliance</SelectItem>
                  <SelectItem value="Electronics">Electronics</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label
                htmlFor="assigned_quantity"
                className="text-luxury-charcoal"
              >
                Quantity
              </Label>
              <Input
                id="assigned_quantity"
                type="number"
                value={tenantFurnitureForm.assigned_quantity === "0" ? "" : tenantFurnitureForm.assigned_quantity}
                onChange={(e) =>
                  setTenantFurnitureForm({
                    ...tenantFurnitureForm,
                    assigned_quantity: e.target.value,
                  })
                }
                required
                min="1"
                className="border-luxury-cream focus:ring-luxury-gold"
                placeholder="Enter quantity"
              />
            </div>
            <div>
              <Label htmlFor="purchase_price" className="text-luxury-charcoal">
                Purchase Price (₹)
              </Label>
              <Input
                id="purchase_price"
                type="number"
                value={tenantFurnitureForm.purchase_price === "0" ? "" : tenantFurnitureForm.purchase_price}
                onChange={(e) =>
                  setTenantFurnitureForm({
                    ...tenantFurnitureForm,
                    purchase_price: e.target.value,
                  })
                }
                required
                className="border-luxury-cream focus:ring-luxury-gold"
                placeholder="Enter purchase price"
              />
            </div>
            <div>
              <Label htmlFor="purchase_date" className="text-luxury-charcoal">
                Purchase Date
              </Label>
              <Input
                id="purchase_date"
                type="date"
                value={tenantFurnitureForm.purchase_date}
                onChange={(e) =>
                  setTenantFurnitureForm({
                    ...tenantFurnitureForm,
                    purchase_date: e.target.value,
                  })
                }
                required
                className="border-luxury-cream focus:ring-luxury-gold"
              />
            </div>
            <div>
              <Label htmlFor="condition" className="text-luxury-charcoal">
                Condition
              </Label>
              <Select
                value={tenantFurnitureForm.condition}
                onValueChange={(value) =>
                  setTenantFurnitureForm({
                    ...tenantFurnitureForm,
                    condition: value,
                  })
                }
                required
              >
                <SelectTrigger
                  id="condition"
                  className="border-luxury-cream focus:ring-luxury-gold"
                >
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddTenantFurnitureOpen(false)}
                className="border-luxury-cream hover:bg-luxury-cream/20"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                disabled={assignFurnitureMutation.isPending}
              >
                {assignFurnitureMutation.isPending
                  ? "Assigning..."
                  : "Assign Furniture"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-white border border-luxury-cream rounded-lg shadow-xl w-[95vw] max-w-lg mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl text-luxury-charcoal">
              Edit Property
            </DialogTitle>
          </DialogHeader>
          <FlatForm 
            flat={flat}
            open={editOpen}
            onOpenChange={setEditOpen}
            onSuccess={() => {
              setEditOpen(false);
              queryClient.invalidateQueries({ queryKey: ["flat", id] });
              queryClient.invalidateQueries({ queryKey: ["flats"] });
              toast({
                title: "Success",
                description: "Property updated successfully",
                className: "bg-luxury-gold text-luxury-charcoal border-none",
              });
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={addTenantOpen} onOpenChange={setAddTenantOpen}>
        <DialogContent className="bg-white border border-luxury-cream rounded-lg shadow-xl w-[95vw] max-w-lg mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl text-luxury-charcoal">
              Add New Tenant
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addTenantMutation.mutate(tenantForm);
            }}
            className="space-y-6"
          >
            <div>
              <Label htmlFor="name" className="text-luxury-charcoal">
                Name
              </Label>
              <Input
                id="name"
                value={tenantForm.name}
                onChange={(e) =>
                  setTenantForm({ ...tenantForm, name: e.target.value })
                }
                required
                className="border-luxury-cream focus:ring-luxury-gold"
                placeholder="Enter tenant name"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-luxury-charcoal">
                Phone
              </Label>
              <Input
                id="phone"
                type="tel"
                value={tenantForm.phone}
                onChange={(e) =>
                  setTenantForm({ ...tenantForm, phone: e.target.value })
                }
                required
                className="border-luxury-cream focus:ring-luxury-gold"
                placeholder="Enter phone number"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-luxury-charcoal">
                Email (Optional)
              </Label>
              <Input
                id="email"
                type="email"
                value={tenantForm.email}
                onChange={(e) =>
                  setTenantForm({ ...tenantForm, email: e.target.value })
                }
                className="border-luxury-cream focus:ring-luxury-gold"
                placeholder="Enter email address"
              />
            </div>
            <div>
              <Label htmlFor="photo" className="text-luxury-charcoal">
                Tenant Photo (Optional)
              </Label>
              <Input
                id="photo"
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setTenantPhoto(e.target.files ? e.target.files[0] : null)
                }
                className="border-luxury-cream focus:ring-luxury-gold"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddTenantOpen(false)}
                className="border-luxury-cream hover:bg-luxury-cream/20"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                disabled={addTenantMutation.isPending}
              >
                {addTenantMutation.isPending ? "Adding..." : "Add Tenant"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={assignTenantOpen} onOpenChange={setAssignTenantOpen}>
        <DialogContent className="bg-white border border-luxury-cream rounded-lg shadow-xl w-[95vw] max-w-lg mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl text-luxury-charcoal">
              Assign Existing Tenant
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedTenant) {
                assignTenantMutation.mutate(selectedTenant);
              }
            }}
            className="space-y-6"
          >
            <div>
              <Label htmlFor="tenant" className="text-luxury-charcoal">
                Select Tenant
              </Label>
              <Select
                value={selectedTenant}
                onValueChange={setSelectedTenant}
                required
              >
                <SelectTrigger
                  id="tenant"
                  className="border-luxury-cream focus:ring-luxury-gold"
                >
                  <SelectValue placeholder="Select a tenant" />
                </SelectTrigger>
                <SelectContent>
                  {availableTenants?.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name} ({tenant.phone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssignTenantOpen(false)}
                className="border-luxury-cream hover:bg-luxury-cream/20"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                disabled={assignTenantMutation.isPending || !selectedTenant}
              >
                {assignTenantMutation.isPending
                  ? "Assigning..."
                  : "Assign Tenant"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={uploadDocOpen} onOpenChange={setUploadDocOpen}>
        <DialogContent className="bg-white border border-luxury-cream rounded-lg shadow-xl w-[95vw] max-w-lg mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl text-luxury-charcoal">
              Upload Document
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (docFile) {
                uploadDocumentMutation.mutate({
                  file: docFile,
                  name: docName,
                  document_type: docType,
                });
              }
            }}
            className="space-y-6"
          >
            <div>
              <Label htmlFor="docFile" className="text-luxury-charcoal">
                Document File
              </Label>
              <Input
                id="docFile"
                type="file"
                onChange={(e) =>
                  setDocFile(e.target.files ? e.target.files[0] : null)
                }
                required
                className="border-luxury-cream focus:ring-luxury-gold"
              />
            </div>
            <div>
              <Label htmlFor="docName" className="text-luxury-charcoal">
                Document Name
              </Label>
              <Input
                id="docName"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="Enter document name"
                className="border-luxury-cream focus:ring-luxury-gold"
              />
            </div>
            <div>
              <Label htmlFor="docType" className="text-luxury-charcoal">
                Document Type
              </Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger
                  id="docType"
                  className="border-luxury-cream focus:ring-luxury-gold"
                >
                  <SelectValue placeholder="Select document type" />
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setUploadDocOpen(false)}
                className="border-luxury-cream hover:bg-luxury-cream/20"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                disabled={uploadDocumentMutation.isPending || !docFile}
              >
                {uploadDocumentMutation.isPending
                  ? "Uploading..."
                  : "Upload Document"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteDocOpen} onOpenChange={setDeleteDocOpen}>
        <DialogContent className="bg-white border border-luxury-cream rounded-lg shadow-xl w-[95vw] max-w-md mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl text-luxury-charcoal">
              Delete Document
            </DialogTitle>
            <DialogDescription className="text-luxury-charcoal/70">
              Are you sure you want to delete this document? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDocOpen(false)}
              className="border-luxury-cream hover:bg-luxury-cream/20"
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (selectedDocId) {
                  deleteDocumentMutation.mutate(selectedDocId);
                }
              }}
              disabled={deleteDocumentMutation.isPending}
            >
              {deleteDocumentMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={createMaintenanceOpen}
        onOpenChange={setCreateMaintenanceOpen}
      >
        <DialogContent className="bg-white border border-luxury-cream rounded-lg shadow-xl w-[95vw] max-w-lg mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl text-luxury-charcoal">
              Create Maintenance Request
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMaintenanceMutation.mutate(maintenanceForm);
            }}
            className="space-y-6"
          >
            <div>
              <Label htmlFor="title" className="text-luxury-charcoal">
                Title
              </Label>
              <Input
                id="title"
                value={maintenanceForm.title}
                onChange={(e) =>
                  setMaintenanceForm({
                    ...maintenanceForm,
                    title: e.target.value,
                  })
                }
                required
                className="border-luxury-cream focus:ring-luxury-gold"
                placeholder="Enter request title"
              />
            </div>
            <div>
              <Label htmlFor="description" className="text-luxury-charcoal">
                Description
              </Label>
              <Textarea
                id="description"
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
              <Label htmlFor="priority" className="text-luxury-charcoal">
                Priority
              </Label>
              <Select
                value={maintenanceForm.priority}
                onValueChange={(value) =>
                  setMaintenanceForm({ ...maintenanceForm, priority: value })
                }
              >
                <SelectTrigger
                  id="priority"
                  className="border-luxury-cream focus:ring-luxury-gold"
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
              <Label htmlFor="tenant_id" className="text-luxury-charcoal">
                Reported by Tenant (Optional)
              </Label>
              <Select
                value={maintenanceForm.tenant_id || "none"}
                onValueChange={(value) =>
                  setMaintenanceForm({
                    ...maintenanceForm,
                    tenant_id: value === "none" ? null : value,
                  })
                }
              >
                <SelectTrigger
                  id="tenant_id"
                  className="border-luxury-cream focus:ring-luxury-gold"
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateMaintenanceOpen(false)}
                className="border-luxury-cream hover:bg-luxury-cream/20"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                disabled={createMaintenanceMutation.isPending}
              >
                {createMaintenanceMutation.isPending
                  ? "Creating..."
                  : "Create Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={sendPaymentLinksOpen}
        onOpenChange={(open) => {
          if (!open && paymentLinksData.length > 0) {
            setConfirmCloseOpen(true);
          } else {
            setSendPaymentLinksOpen(open);
          }
        }}
      >
        <DialogContent className="bg-white border border-luxury-cream rounded-lg shadow-xl w-[95vw] sm:w-[85vw] md:w-[75vw] lg:w-[65vw] max-w-2xl mx-auto p-4 sm:p-6">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl sm:text-2xl text-luxury-charcoal">
              Send Payment Links
            </DialogTitle>
            <DialogDescription className="text-luxury-charcoal/70">
              Generate and send payment links to your tenants for rent collection.
            </DialogDescription>
          </DialogHeader>
          {paymentLinksData.length > 0 ? (
            <div className="space-y-6">
              <div className="mt-4">
                <h3 className="text-lg font-medium text-luxury-charcoal mb-2">
                  Generated Payment Links
                </h3>
                <p className="text-sm text-luxury-charcoal/70 mb-4">
                  Share these payment links with your tenants via WhatsApp or copy the links directly.
                </p>
                <div className="max-h-[60vh] overflow-y-auto pr-2">
                  <ul className="space-y-4">
                    {paymentLinksData.map((linkData) => {
                      const tenant = flat.tenants?.find(
                        (t) => t.id === linkData.tenant_id
                      );
                      return (
                        <li
                          key={linkData.id}
                          className="border border-luxury-cream rounded-lg p-4 hover:bg-luxury-cream/5 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-2">
                              <p className="font-medium text-luxury-charcoal">
                                {tenant?.name || "Flat Rent"}
                              </p>
                              <div className="flex items-center gap-2">
                                <a
                                  href={linkData.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-luxury-gold hover:underline text-sm truncate max-w-[240px] sm:max-w-[300px]"
                                >
                                  {linkData.link}
                                </a>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 border-luxury-cream hover:bg-luxury-gold/10"
                                  onClick={() => navigator.clipboard.writeText(linkData.link)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            {tenant?.phone && (
                              <WhatsAppIntegration
                                phone={tenant.phone}
                                message={`Dear ${tenant.name}, please pay your rent of ₹${rentAmount} for ${flat.name}. Use this link: ${linkData.link}`}
                                buttonLabel="Send via WhatsApp"
                                buttonClassName="w-full sm:w-auto bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80 whitespace-nowrap"
                              />
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
              <DialogFooter className="sm:justify-between gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmCloseOpen(true)}
                  className="w-full sm:w-auto border-luxury-cream hover:bg-luxury-cream/20"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setSendPaymentLinksOpen(false);
                    setPaymentLinksData([]);
                  }}
                  className="w-full sm:w-auto bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                >
                  Generate New Links
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (parseFloat(rentAmount) !== flat.monthly_rent_target) {
                  toast({
                    title: "Invalid Amount",
                    description: `Rent amount must match the monthly target of ₹${flat.monthly_rent_target}`,
                    variant: "destructive",
                  });
                  return;
                }
                createPaymentLinksMutation.mutate({
                  amount: Number(rentAmount),
                  description: rentDescription,
                  expiryDays: Number(expiryDays),
                });
              }}
              className="space-y-6 mt-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="rentAmount" className="text-luxury-charcoal">
                    Rent Amount
                  </Label>
                  <div className="mt-1.5 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-luxury-charcoal/70">₹</span>
                    <Input
                      id="rentAmount"
                      type="number"
                      value={rentAmount}
                      onChange={(e) => setRentAmount(e.target.value)}
                      required
                      className="pl-7 border-luxury-cream focus:ring-luxury-gold"
                      placeholder="Enter rent amount"
                      readOnly
                    />
                  </div>
                  <p className="text-sm text-luxury-charcoal/70 mt-1">
                    Monthly rent target is fixed at ₹{flat.monthly_rent_target?.toLocaleString()}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="rentDescription" className="text-luxury-charcoal">
                    Description
                  </Label>
                  <Input
                    id="rentDescription"
                    value={rentDescription}
                    onChange={(e) => setRentDescription(e.target.value)}
                    className="mt-1.5 border-luxury-cream focus:ring-luxury-gold"
                    placeholder="Enter description (e.g., Rent Payment)"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="expiryDays" className="text-luxury-charcoal">
                    Link Expiry (Days)
                  </Label>
                  <Input
                    id="expiryDays"
                    type="number"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(e.target.value)}
                    required
                    min="1"
                    className="mt-1.5 border-luxury-cream focus:ring-luxury-gold"
                    placeholder="Enter expiry days"
                  />
                </div>
              </div>
              <DialogFooter className="sm:justify-between gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSendPaymentLinksOpen(false)}
                  className="w-full sm:w-auto border-luxury-cream hover:bg-luxury-cream/20"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="w-full sm:w-auto bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                  disabled={createPaymentLinksMutation.isPending}
                >
                  {createPaymentLinksMutation.isPending
                    ? "Generating..."
                    : "Generate Links"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <DialogContent className="bg-white border border-luxury-cream rounded-lg shadow-xl w-[95vw] max-w-md mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl text-luxury-charcoal">
              Confirm Close
            </DialogTitle>
            <DialogDescription className="text-luxury-charcoal/70">
              Are you sure you want to close the payment links dialog? You can
              still access the links in the Rent Collection tab.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmCloseOpen(false)}
              className="border-luxury-cream hover:bg-luxury-cream/20"
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
              onClick={() => {
                setSendPaymentLinksOpen(false);
                setConfirmCloseOpen(false);
                setPaymentLinksData([]);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
        <DialogContent className="bg-white border border-luxury-cream rounded-lg shadow-xl w-[95vw] max-w-lg mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl text-luxury-charcoal">
              Add Expense
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addExpenseMutation.mutate(expenseForm);
            }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="title" className="text-luxury-charcoal text-sm">
                  Title
                </Label>
                <Input
                  id="title"
                  value={expenseForm.title}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, title: e.target.value })
                  }
                  required
                  className="border-luxury-cream focus:ring-luxury-gold mt-1"
                  placeholder="Enter expense title"
                />
              </div>
              <div>
                <Label htmlFor="amount" className="text-luxury-charcoal text-sm">
                  Amount
                </Label>
                <Input
                  id="amount"
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, amount: e.target.value })
                  }
                  required
                  className="border-luxury-cream focus:ring-luxury-gold mt-1"
                  placeholder="Enter amount"
                />
              </div>
              <div>
                <Label htmlFor="date" className="text-luxury-charcoal text-sm">
                  Date
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, date: e.target.value })
                  }
                  required
                  className="border-luxury-cream focus:ring-luxury-gold mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="category" className="text-luxury-charcoal text-sm">
                  Category
                </Label>
                <Select
                  value={expenseForm.category}
                  onValueChange={(value) =>
                    setExpenseForm({ ...expenseForm, category: value })
                  }
                  required
                >
                  <SelectTrigger
                    id="category"
                    className="border-luxury-cream focus:ring-luxury-gold"
                  >
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="utilities">Utilities</SelectItem>
                    <SelectItem value="repairs">Repairs</SelectItem>
                    <SelectItem value="taxes">Taxes</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="description" className="text-luxury-charcoal text-sm">
                  Description (Optional)
                </Label>
                <Textarea
                  id="description"
                  value={expenseForm.description}
                  onChange={(e) =>
                    setExpenseForm({
                      ...expenseForm,
                      description: e.target.value,
                    })
                  }
                  className="border-luxury-cream focus:ring-luxury-gold mt-1"
                  placeholder="Enter expense description"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="receipt" className="text-luxury-charcoal text-sm">
                  Receipt (Optional)
                </Label>
                <Input
                  id="receipt"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) =>
                    setExpenseReceipt(e.target.files ? e.target.files[0] : null)
                  }
                  className="border-luxury-cream focus:ring-luxury-gold mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddExpenseOpen(false)}
                className="border-luxury-cream hover:bg-luxury-cream/20"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                disabled={addExpenseMutation.isPending}
              >
                {addExpenseMutation.isPending ? "Adding..." : "Add Expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteRecordOpen} onOpenChange={setDeleteRecordOpen}>
        <DialogContent className="bg-white border border-luxury-cream rounded-lg shadow-xl w-[95vw] max-w-md mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl text-luxury-charcoal">
              Delete Property
            </DialogTitle>
            <DialogDescription className="text-luxury-charcoal/70">
              Are you sure you want to delete this property? This action cannot be undone and will remove all associated data including tenants, documents, and records.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="text-red-600 font-medium mb-2 flex items-center">
              <svg
                className="h-5 w-5 mr-2"
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
              Warning
            </h4>
            <p className="text-sm text-red-600">
              This will permanently delete:
            </p>
            <ul className="mt-2 text-sm text-red-600 list-disc list-inside space-y-1">
              <li>All tenant records and their data</li>
              <li>All uploaded documents and photos</li>
              <li>All maintenance requests</li>
              <li>All rent collection records</li>
              <li>All expense records</li>
            </ul>
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteRecordOpen(false)}
              className="border-luxury-cream hover:bg-luxury-cream/20"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (confirm("Please type DELETE to confirm")) {
                  deleteFlatMutation.mutate();
                }
              }}
              disabled={deleteFlatMutation.isPending}
            >
              {deleteFlatMutation.isPending ? "Deleting..." : "Delete Property"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteRentOpen} onOpenChange={setDeleteRentOpen}>
        <DialogContent className="bg-white border border-luxury-cream rounded-lg shadow-xl w-[95vw] max-w-md mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl text-luxury-charcoal">
              Delete Rent Record
            </DialogTitle>
            <DialogDescription className="text-luxury-charcoal/70">
              Are you sure you want to delete this rent record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="text-red-600 font-medium mb-2 flex items-center">
              <svg
                className="h-5 w-5 mr-2"
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
              Warning
            </h4>
            <p className="text-sm text-red-600">
              This will permanently delete the rent record and all associated payment information.
            </p>
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteRentOpen(false)}
              className="border-luxury-cream hover:bg-luxury-cream/20"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (selectedRentId) {
                  deleteRentMutation.mutate(selectedRentId);
                  setDeleteRentOpen(false);
                }
              }}
              disabled={deleteRentMutation.isPending}
            >
              {deleteRentMutation.isPending ? "Deleting..." : "Delete Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FlatDetail;
