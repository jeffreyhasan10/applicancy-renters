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
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, subDays } from "date-fns";

interface Flat {
  id: string;
  name: string;
  address: string;
  monthly_rent_target: number;
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
        document_type: string;
      }[]
    | null;
  property_tags: { id: string; tag_name: string }[] | null;
}
interface FurnitureItem {
  id: string;
  flat_id: string;
  name: string;
  unit_rent: number;
  condition: string;
  total_quantity: number;
  available_quantity: number;
  purchase_date: string;
  purchase_price: number;
  category: string;
  is_appliance: boolean;
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

interface Expense {
  id: string;
  flat_id: string;
  title: string;
  amount: number;
  date: string;
  description: string | null;
  category: string | null;
  created_at: string;
  receipt_id: string | null;
  receipt?: { id: string; file_path: string; name: string } | null;
}

interface ExpenseFilter {
  startDate: string;
  endDate: string;
  category: string;
  minAmount: string;
  maxAmount: string;
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

interface ExpenseForm {
  title: string;
  amount: string;
  date: string;
  category: string;
  description?: string;
  receipt?: File;
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
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>({
    title: "",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    category: "",
    description: "",
  });
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const generateMonthlyFilters = (year) => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return months.map((month) => ({
      month: `${month} ${year}`,
      status: "all",
    }));
  };
  const [monthlyStatusFilters, setMonthlyStatusFilters] = useState(
    generateMonthlyFilters(currentYear)
  );
  const [expenseReceipt, setExpenseReceipt] = useState<File | null>(null);
  const [addTenantOpen, setAddTenantOpen] = useState(false);
  const [assignTenantOpen, setAssignTenantOpen] = useState(false);
  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [deleteDocOpen, setDeleteDocOpen] = useState(false);
  const [createMaintenanceOpen, setCreateMaintenanceOpen] = useState(false);
  const [sendPaymentLinksOpen, setSendPaymentLinksOpen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [addFurnitureOpen, setAddFurnitureOpen] = useState(false);
  const [addTenantFurnitureOpen, setAddTenantFurnitureOpen] = useState(false);
  const [furnitureForm, setFurnitureForm] = useState<FurnitureForm>({
    name: "",
    unit_rent: "",
  });
  const [tenantFurnitureForm, setTenantFurnitureForm] =
    useState<TenantFurnitureForm>({
      furniture_item_id: "",
      category: "",
      assigned_quantity: "1",
      purchase_price: "",
      purchase_date: format(new Date(), "yyyy-MM-dd"),
      condition: "new",
    });
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
  const [expenseFilter, setExpenseFilter] = useState<ExpenseFilter>({
    startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
    category: "",
    minAmount: "",
    maxAmount: "",
  });
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docName, setDocName] = useState<string>("");
  useEffect(() => {
    setMonthlyStatusFilters(generateMonthlyFilters(Number(selectedYear)));
    setPage(1);
  }, [selectedYear]);
  const [tenantPhoto, setTenantPhoto] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>("other");
  const [activeTab, setActiveTab] = useState("details");
  const [paymentLinksData, setPaymentLinksData] = useState<PaymentLinkData[]>(
    []
  );
  const [rentAmount, setRentAmount] = useState<string>("");
  const [rentDescription, setRentDescription] =
    useState<string>("Rent Payment");
  const [expiryDays, setExpiryDays] = useState<string>("7");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // Refetch flat details when dialogs are closed
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["flat", id] });
  }, [
    editOpen,
    addTenantOpen,
    assignTenantOpen,
    uploadDocOpen,
    deleteDocOpen,
    createMaintenanceOpen,
    sendPaymentLinksOpen,
  ]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setPage(1);
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
  // Fetch furniture items
  const { data: furnitureItems, isLoading: furnitureLoading } = useQuery<
    FurnitureItem[]
  >({
    queryKey: ["furniture_items", id, page],
    queryFn: async () => {
      const { data, error } = await typedSupabase
        .from("furniture_items")
        .select("*")
        .eq("flat_id", id)
        .range((page - 1) * itemsPerPage, page * itemsPerPage - 1)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!id,
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

  // Fetch expenses with pagination and filters
  const {
    data: expenses,
    isLoading: expensesLoading,
    refetch: refetchExpenses,
  } = useQuery<Expense[]>({
    queryKey: ["expenses", id, page, expenseFilter],
    queryFn: async () => {
      let query = typedSupabase
        .from("expenses")
        .select(
          `
          id, flat_id, title, amount, date, description, category, created_at, receipt_id,
          receipt:property_documents (id, file_path, name)
        `
        )
        .eq("flat_id", id)
        .range((page - 1) * itemsPerPage, page * itemsPerPage - 1)
        .order("date", { ascending: false });

      // Apply filters
      if (expenseFilter.startDate) {
        query = query.gte("date", expenseFilter.startDate);
      }
      if (expenseFilter.endDate) {
        query = query.lte("date", expenseFilter.endDate);
      }
      if (expenseFilter.category) {
        query = query.eq("category", expenseFilter.category);
      }
      if (expenseFilter.minAmount) {
        query = query.gte("amount", Number(expenseFilter.minAmount));
      }
      if (expenseFilter.maxAmount) {
        query = query.lte("amount", Number(expenseFilter.maxAmount));
      }

      const { data, error } = await query;
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
      className="w-full min-h-screen bg-luxury-softwhite px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 overflow-x-hidden"
      role="main"
      aria-label="Property Details"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-luxury-cream">
        <div className="flex items-center gap-4">
          <Link to="/flats">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 sm:h-10 sm:w-10 border-luxury-cream hover:bg-luxury-gold/20 rounded-full"
              aria-label="Back to properties"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-luxury-charcoal" />
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-semibold text-luxury-charcoal">
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
            className="w-full sm:w-auto border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal"
            aria-label="Edit property"
          >
            <Edit className="h-4 w-4 mr-2" /> Edit
          </Button>
          <Button
            className="w-full sm:w-auto bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
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
      {/* Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
        aria-label="Property tabs"
      >
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 mb-6 sm:mb-8 bg-luxury-cream/30 rounded-full border border-luxury-cream p-1 gap-1 overflow-x-auto">
          {" "}
          <TabsTrigger
            value="details"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal text-sm sm:text-base whitespace-nowrap"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="tenants"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal text-sm sm:text-base whitespace-nowrap"
          >
            Tenants {flat.tenants?.length ? `(${flat.tenants.length})` : ""}
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal text-sm sm:text-base whitespace-nowrap"
          >
            Documents{" "}
            {flat.property_documents?.length
              ? `(${flat.property_documents.length})`
              : "(0)"}
          </TabsTrigger>
          <TabsTrigger
            value="rents"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal text-sm sm:text-base whitespace-nowrap"
          >
            Rent Collection
          </TabsTrigger>
          <TabsTrigger
            value="furniture"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal text-sm sm:text-base whitespace-nowrap"
          >
            Furniture{" "}
            {furnitureItems?.length ? `(${furnitureItems.length})` : ""}
          </TabsTrigger>
          <TabsTrigger
            value="maintenance"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal text-sm sm:text-base whitespace-nowrap"
          >
            Maintenance{" "}
            {maintenanceRequests?.length
              ? `(${maintenanceRequests.length})`
              : ""}
          </TabsTrigger>
          <TabsTrigger
            value="expenses"
            className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-luxury-charcoal text-sm sm:text-base whitespace-nowrap"
          >
            Expenses {expenses?.length ? `(${expenses.length})` : ""}
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
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
            <TabsContent value="furniture" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                <div className="lg:col-span-2">
                  <Card className="bg-white shadow-md border border-luxury-cream rounded-lg">
                    <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite border-b border-luxury-cream">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl text-luxury-charcoal flex items-center">
                          <Sofa className="h-5 w-5 mr-2 text-luxury-gold" />
                          Furniture Inventory
                        </CardTitle>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAddFurnitureOpen(true)}
                            className="border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal"
                            aria-label="Add new furniture item"
                          >
                            <FilePlus className="h-4 w-4 mr-1" /> New Item
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAddTenantFurnitureOpen(true)}
                            className="border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal"
                            aria-label="Assign furniture"
                            disabled={
                              !flat.tenants || flat.tenants.length === 0
                            }
                          >
                            <Sofa className="h-4 w-4 mr-1" /> Assign
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {furnitureLoading ? (
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
                      ) : furnitureItems && furnitureItems.length > 0 ? (
                        <ul className="space-y-6">
                          {furnitureItems.map((item) => (
                            <li
                              key={item.id}
                              className="border border-luxury-cream rounded-lg p-4 hover:bg-luxury-cream/10 transition-colors"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                                <div>
                                  <h3 className="font-medium text-luxury-charcoal">
                                    {item.name}
                                  </h3>
                                  <p className="text-sm text-luxury-charcoal/70">
                                    Rent: ₹{item.unit_rent.toLocaleString()}
                                  </p>
                                  <p className="text-sm text-luxury-charcoal/70">
                                    Category: {item.category}
                                  </p>
                                  <p className="text-sm text-luxury-charcoal/70">
                                    Condition: {item.condition}
                                  </p>
                                  <p className="text-sm text-luxury-charcoal/70">
                                    Quantity: {item.total_quantity} (Available:{" "}
                                    {item.available_quantity})
                                  </p>
                                  {item.purchase_date && (
                                    <p className="text-sm text-luxury-charcoal/70">
                                      Purchase Date:{" "}
                                      {new Date(
                                        item.purchase_date
                                      ).toLocaleDateString()}
                                    </p>
                                  )}
                                  {item.purchase_price > 0 && (
                                    <p className="text-sm text-luxury-charcoal/70">
                                      Purchase Price: ₹
                                      {item.purchase_price.toLocaleString()}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2 mt-4 sm:mt-0">
                                  <Badge className="bg-luxury-gold/20 text-luxury-charcoal">
                                    {item.is_appliance
                                      ? "Appliance"
                                      : "Furniture"}
                                  </Badge>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-center py-16 border border-dashed border-luxury-cream rounded-lg">
                          <Sofa className="h-16 w-16 text-luxury-charcoal/30 mx-auto mb-4" />
                          <h3 className="text-xl font-medium text-luxury-charcoal mb-3">
                            No furniture items
                          </h3>
                          <p className="text-luxury-charcoal/70 mb-6 max-w-md mx-auto">
                            Add furniture items to track inventory for this
                            property.
                          </p>
                          <Button
                            onClick={() => setAddFurnitureOpen(true)}
                            className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                            aria-label="Add new furniture item"
                          >
                            <FilePlus className="h-4 w-4 mr-2" />
                            Add Furniture Item
                          </Button>
                        </div>
                      )}
                    </CardContent>
                    {furnitureItems && furnitureItems.length > itemsPerPage && (
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
                            furnitureItems.length <= page * itemsPerPage
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
                  <Card className="bg-white shadow-md border border-luxury-cream rounded-lg mt-6">
                    <CardHeader className="bg-gradient-to-r from-luxury-cream to-luxury-softwhite border-b border-luxury-cream">
                      <CardTitle className="text-xl text-luxury-charcoal flex items-center">
                        <Sofa className="h-5 w-5 mr-2 text-luxury-gold" />
                        Assigned Furniture
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      {tenantFurnitureLoading ? (
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
                      ) : tenantFurniture && tenantFurniture.length > 0 ? (
                        <ul className="space-y-6">
                          {tenantFurniture.map((assignment) => (
                            <li
                              key={assignment.id}
                              className="border border-luxury-cream rounded-lg p-4 hover:bg-luxury-cream/10 transition-colors"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                                <div>
                                  <h3 className="font-medium text-luxury-charcoal">
                                    {assignment.furniture_item.name}
                                  </h3>
                                  <p className="text-sm text-luxury-charcoal/70">
                                    Tenant:{" "}
                                    {assignment.tenant?.name || "Unknown"}
                                  </p>
                                  <p className="text-sm text-luxury-charcoal/70">
                                    Quantity: {assignment.assigned_quantity}
                                  </p>
                                  <p className="text-sm text-luxury-charcoal/70">
                                    Rent: ₹
                                    {assignment.rent_part.toLocaleString()}
                                  </p>
                                  <p className="text-sm text-luxury-charcoal/70">
                                    Assigned On:{" "}
                                    {new Date(
                                      assignment.assigned_on
                                    ).toLocaleDateString()}
                                  </p>
                                  <p className="text-sm text-luxury-charcoal/70">
                                    Category:{" "}
                                    {assignment.furniture_item.category}
                                  </p>
                                  <p className="text-sm text-luxury-charcoal/70">
                                    Condition:{" "}
                                    {assignment.furniture_item.condition}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-2 mt-4 sm:mt-0">
                                  <Badge className="bg-luxury-gold/20 text-luxury-charcoal">
                                    {assignment.furniture_item.category}
                                  </Badge>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-center py-16 border border-dashed border-luxury-cream rounded-lg">
                          <Sofa className="h-16 w-16 text-luxury-charcoal/30 mx-auto mb-4" />
                          <h3 className="text-xl font-medium text-luxury-charcoal mb-3">
                            No furniture assigned
                          </h3>
                          <p className="text-luxury-charcoal/70 mb-6 max-w-md mx-auto">
                            Assign furniture items to tenants for this property.
                          </p>
                          <Button
                            onClick={() => setAddTenantFurnitureOpen(true)}
                            className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                            disabled={
                              !flat.tenants || flat.tenants.length === 0
                            }
                            aria-label="Assign furniture"
                          >
                            <Sofa className="h-4 w-4 mr-2" />
                            Assign Furniture
                          </Button>
                        </div>
                      )}
                    </CardContent>
                    {tenantFurniture &&
                      tenantFurniture.length > itemsPerPage && (
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
                              tenantFurniture.length <= page * itemsPerPage
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
                            d="M4 6h16M4 12h16m-7 6h7"
                          />
                        </svg>
                        Furniture Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <Button
                          onClick={() => setAddFurnitureOpen(true)}
                          className="w-full bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80 justify-start"
                          aria-label="Add new furniture item"
                        >
                          <FilePlus className="h-4 w-4 mr-2" />
                          Add New Item
                        </Button>
                        <Button
                          onClick={() => setAddTenantFurnitureOpen(true)}
                          variant="outline"
                          className="w-full border-luxury-cream hover:bg-luxury-gold/20 text-luxury-charcoal justify-start"
                          disabled={!flat.tenants || flat.tenants.length === 0}
                          aria-label="Assign furniture"
                        >
                          <Sofa className="h-4 w-4 mr-2" />
                          Assign Furniture
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
                <div className="lg:col-span-2">
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
                <div className="lg:col-span-2">
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
                      {/* Expense Filters */}
                      <div className="mb-6 p-4 bg-luxury-cream/20 border border-luxury-cream rounded-lg">
                        <h3 className="text-lg font-medium text-luxury-charcoal mb-4 flex items-center">
                          <Filter className="h-4 w-4 mr-2" />
                          Monthly Rent Collection Status
                        </h3>
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-4">
                          <div className="w-full sm:w-48">
                            <Label
                              htmlFor="year-select"
                              className="text-luxury-charcoal"
                            >
                              Select Year
                            </Label>
                            <Select
                              value={selectedYear}
                              onValueChange={(value) => setSelectedYear(value)}
                            >
                              <SelectTrigger
                                id="year-select"
                                className="border-luxury-cream focus:ring-luxury-gold"
                              >
                                <SelectValue placeholder="Select year" />
                              </SelectTrigger>
                              <SelectContent>
                                {[...Array(10)].map((_, i) => {
                                  const year = currentYear - 5 + i;
                                  return (
                                    <SelectItem
                                      key={year}
                                      value={year.toString()}
                                    >
                                      {year}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setMonthlyStatusFilters(
                                generateMonthlyFilters(Number(selectedYear))
                              );
                              setPage(1);
                            }}
                            className="border-luxury-cream hover:bg-luxury-gold/20"
                            aria-label="Reset filters"
                          >
                            Reset Filters
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {monthlyStatusFilters.map((monthStatus, index) => (
                            <div
                              key={monthStatus.month}
                              className="flex flex-col"
                            >
                              <Label
                                htmlFor={`month-status-${index}`}
                                className="text-luxury-charcoal text-sm mb-1"
                              >
                                {monthStatus.month.split(" ")[0]}
                              </Label>
                              <Select
                                value={monthStatus.status}
                                onValueChange={(value) => {
                                  const updatedFilters = [
                                    ...monthlyStatusFilters,
                                  ];
                                  updatedFilters[index] = {
                                    ...monthStatus,
                                    status: value,
                                  };
                                  setMonthlyStatusFilters(updatedFilters);
                                  setPage(1);
                                }}
                              >
                                <SelectTrigger
                                  id={`month-status-${index}`}
                                  className="border-luxury-cream focus:ring-luxury-gold h-9 text-sm"
                                >
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All</SelectItem>
                                  <SelectItem value="received">
                                    Received
                                  </SelectItem>
                                  <SelectItem value="pending">
                                    Pending
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      </div>

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
      // Add Furniture Dialogs
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
                value={tenantFurnitureForm.assigned_quantity}
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
                value={tenantFurnitureForm.purchase_price}
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
        <DialogContent className="bg-white border border-luxury-cream rounded-lg shadow-xl w-[95vw] max-w-lg mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl text-luxury-charcoal">
              Send Payment Links
            </DialogTitle>
          </DialogHeader>
          {paymentLinksData.length > 0 ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-luxury-charcoal">
                  Generated Payment Links
                </h3>
                <ul className="space-y-4 mt-4">
                  {paymentLinksData.map((linkData) => {
                    const tenant = flat.tenants?.find(
                      (t) => t.id === linkData.tenant_id
                    );
                    return (
                      <li
                        key={linkData.id}
                        className="border border-luxury-cream rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-luxury-charcoal">
                              {tenant?.name || "Unknown Tenant"}
                            </p>
                            <a
                              href={linkData.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-luxury-gold hover:underline text-sm truncate max-w-xs"
                            >
                              {linkData.link}
                            </a>
                          </div>
                          <WhatsAppIntegration
                            phone={tenant?.phone || ""}
                            message={`Dear ${tenant?.name}, please pay your rent of ₹${rentAmount} for ${flat.name}. Use this link: ${linkData.link}`}
                            buttonLabel="Send via WhatsApp"
                            buttonClassName="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmCloseOpen(true)}
                  className="border-luxury-cream hover:bg-luxury-cream/20"
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createPaymentLinksMutation.mutate({
                  amount: Number(rentAmount),
                  description: rentDescription,
                  expiryDays: Number(expiryDays),
                });
              }}
              className="space-y-6"
            >
              <div>
                <Label htmlFor="rentAmount" className="text-luxury-charcoal">
                  Rent Amount
                </Label>
                <Input
                  id="rentAmount"
                  type="number"
                  value={rentAmount}
                  onChange={(e) => setRentAmount(e.target.value)}
                  required
                  className="border-luxury-cream focus:ring-luxury-gold"
                  placeholder="Enter rent amount"
                />
              </div>
              <div>
                <Label
                  htmlFor="rentDescription"
                  className="text-luxury-charcoal"
                >
                  Description
                </Label>
                <Input
                  id="rentDescription"
                  value={rentDescription}
                  onChange={(e) => setRentDescription(e.target.value)}
                  className="border-luxury-cream focus:ring-luxury-gold"
                  placeholder="Enter description (e.g., Rent Payment)"
                />
              </div>
              <div>
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
                  className="border-luxury-cream focus:ring-luxury-gold"
                  placeholder="Enter expiry days"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSendPaymentLinksOpen(false)}
                  className="border-luxury-cream hover:bg-luxury-cream/20"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="title" className="text-luxury-charcoal">
                  Title
                </Label>
                <Input
                  id="title"
                  value={expenseForm.title}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, title: e.target.value })
                  }
                  required
                  className="border-luxury-cream focus:ring-luxury-gold"
                  placeholder="Enter expense title"
                />
              </div>
              <div>
                <Label htmlFor="amount" className="text-luxury-charcoal">
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
                  className="border-luxury-cream focus:ring-luxury-gold"
                  placeholder="Enter amount"
                />
              </div>
              <div>
                <Label htmlFor="date" className="text-luxury-charcoal">
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
                  className="border-luxury-cream focus:ring-luxury-gold"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="category" className="text-luxury-charcoal">
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
              <div className="md:col-span-2">
                <Label htmlFor="description" className="text-luxury-charcoal">
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
                  className="border-luxury-cream focus:ring-luxury-gold"
                  placeholder="Enter expense description"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="receipt" className="text-luxury-charcoal">
                  Receipt (Optional)
                </Label>
                <Input
                  id="receipt"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) =>
                    setExpenseReceipt(e.target.files ? e.target.files[0] : null)
                  }
                  className="border-luxury-cream focus:ring-luxury-gold"
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
    </div>
  );
};

export default FlatDetail;
