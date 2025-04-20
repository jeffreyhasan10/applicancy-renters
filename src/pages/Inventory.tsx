// Inventory.tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Package2,
  Plus,
  Search,
  PackagePlus,
  Trash2,
  Edit,
  Unlink,
  Filter,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { debounce } from "lodash";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radix-ui/react-tooltip";
import InventoryForm from "../components/forms/InventoryForm";
import ApplianceRentBreakdown from "../components/forms/ApplianceRentBreakdown";

// Define types
interface InventoryItem {
  id: string;
  name: string;
  category: string;
  condition: "new" | "used" | "damaged";
  location: string;
  flat_id: string | null;
  flat: string | null;
  assigned: boolean;
  purchaseDate: string;
  purchasePrice: number;
  unit_rent: number;
  total_quantity: number;
  available_quantity: number;
  calendarEvent?: {
    startDate: string | null;
    endDate: string | null;
  };
}

interface Flat {
  id: string;
  name: string;
}

interface Tenant {
  id: string;
  name: string;
  flat_id: string;
}

interface TenantFurniture {
  id: string;
  furniture_item_id: string;
  name: string;
  category: string;
  assigned_quantity: number;
  condition: string;
  location: string;
  tenant: string;
  rent_part: number;
  calendarEvent?: {
    startDate: string | null;
    endDate: string | null;
  };
}

interface CalendarEvent {
  id: string;
  related_table: string;
  related_id: string;
  start_date: string | null;
  end_date: string | null;
}

// AssignForm Component
interface AssignFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem;
  onAssign: () => void;
}

function AssignForm({ open, onOpenChange, item, onAssign }: AssignFormProps) {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [formData, setFormData] = useState({
    tenant_id: "",
    quantity: 1,
    rent_part: item.unit_rent,
  });
  const [errors, setErrors] = useState<{ tenant_id?: string; quantity?: string; rent_part?: string }>({});

  useEffect(() => {
    const fetchTenants = async () => {
      setLoadingTenants(true);
      try {
        const { data, error } = await supabase
          .from("tenants")
          .select("id, name, flat_id")
          .eq("flat_id", item.flat_id)
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (error) throw error;
        setTenants(data || []);
      } catch (error: any) {
        toast({
          title: "Error fetching tenants",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoadingTenants(false);
      }
    };

    if (item.flat_id) fetchTenants();
  }, [item.flat_id, toast]);

  const validateForm = () => {
    const newErrors: { tenant_id?: string; quantity?: string; rent_part?: string } = {};
    if (!formData.tenant_id) newErrors.tenant_id = "Please select a tenant";
    if (formData.quantity < 1) newErrors.quantity = "Quantity must be at least 1";
    if (formData.quantity > item.available_quantity)
      newErrors.quantity = `Only ${item.available_quantity} items available`;
    if (formData.rent_part === undefined || formData.rent_part < 0)
      newErrors.rent_part = "Rent value must be non-negative";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const { error } = await supabase.from("tenant_furniture").insert({
        tenant_id: formData.tenant_id,
        furniture_item_id: item.id,
        assigned_quantity: formData.quantity,
        rent_part: formData.rent_part,
      });

      if (error) throw error;

      toast({
        title: "Item assigned",
        description: `${formData.quantity} ${item.name}(s) assigned to tenant successfully`,
      });

      onOpenChange(false);
      onAssign();
    } catch (error: any) {
      toast({
        title: "Error assigning item",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign {item.name}</DialogTitle>
          <DialogDescription>
            Assign {item.name} to a tenant. Available: {item.available_quantity}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenant_id">Tenant</Label>
            <Select
              value={formData.tenant_id}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, tenant_id: value }))
              }
              disabled={loadingTenants || !item.flat_id}
              required
            >
              <SelectTrigger id="tenant_id" className={errors.tenant_id ? "border-red-500" : ""}>
                <SelectValue
                  placeholder={
                    loadingTenants
                      ? "Loading tenants..."
                      : tenants.length === 0
                      ? "No tenants available"
                      : "Select tenant"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tenant_id && <p className="text-sm text-red-500">{errors.tenant_id}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              value={formData.quantity}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  quantity: parseInt(e.target.value) || 1,
                }))
              }
              min="1"
              max={item.available_quantity}
              required
              className={errors.quantity ? "border-red-500" : ""}
            />
            {errors.quantity && <p className="text-sm text-red-500">{errors.quantity}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rent_part">Rent Part (₹)</Label>
            <Input
              id="rent_part"
              type="number"
              value={formData.rent_part}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  rent_part: parseFloat(e.target.value) || 0,
                }))
              }
              min="0"
              required
              className={errors.rent_part ? "border-red-500" : ""}
            />
            {errors.rent_part && <p className="text-sm text-red-500">{errors.rent_part}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={loadingTenants || !formData.tenant_id}
            >
              Assign
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Main Inventory Component
export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false);
  const [itemToUnassign, setItemToUnassign] = useState<
    { id: string; furniture_item_id: string; name: string } | null
  >(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [unassignInProgress, setUnassignInProgress] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [tenantFurnitureItems, setTenantFurnitureItems] = useState<TenantFurniture[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTenantFurniture, setLoadingTenantFurniture] = useState(false);
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignItem, setAssignItem] = useState<InventoryItem | null>(null);
  const [calendarDateRange, setCalendarDateRange] = useState<{
    from: Date | null;
    to: Date | null;
  }>({ from: null, to: null });
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchInventoryItems = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const { data: furnitureData, error: furnitureError } = await supabase
        .from("furniture_items")
        .select(`
          id,
          name,
          category,
          unit_rent,
          purchase_price,
          purchase_date,
          condition,
          total_quantity,
          available_quantity,
          created_at,
          flat_id,
          flats (name)
        `);

      if (furnitureError) throw furnitureError;

      // Fetch calendar events separately
      const { data: eventData, error: eventError } = await supabase
        .from("calendar_events")
        .select("id, related_table, related_id, start_date, end_date")
        .eq("related_table", "furniture_items");

      if (eventError) throw eventError;

      setCalendarEvents(eventData || []);

      const formattedItems: InventoryItem[] = (furnitureData || []).map((item) => {
        const relatedEvent = (eventData || []).find(
          (event) => event.related_id === item.id && event.related_table === "furniture_items"
        );

        return {
          id: item.id,
          name: item.name,
          category: item.category,
          condition: item.condition,
          location: item.flats?.name || "Unassigned",
          flat_id: item.flat_id,
          flat: item.flats?.name || null,
          assigned: item.available_quantity < item.total_quantity,
          purchaseDate: formatDate(item.purchase_date || item.created_at),
          purchasePrice: parseFloat(item.purchase_price?.toString() || "0"),
          unit_rent: parseFloat(item.unit_rent?.toString() || "0"),
          total_quantity: item.total_quantity,
          available_quantity: item.available_quantity,
          calendarEvent: relatedEvent
            ? {
                startDate: relatedEvent.start_date
                  ? new Date(relatedEvent.start_date).toLocaleDateString()
                  : null,
                endDate: relatedEvent.end_date
                  ? new Date(relatedEvent.end_date).toLocaleDateString()
                  : null,
              }
            : undefined,
        };
      });

      setInventoryItems(formattedItems);
    } catch (error: any) {
      setErrorMessage("Failed to load inventory items. Please try again.");
      toast({
        title: "Error fetching inventory",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantFurniture = async () => {
    try {
      setLoadingTenantFurniture(true);
      const assignedItems = inventoryItems.filter(
        (item) => item.total_quantity > item.available_quantity
      );

      const tenantFurniturePromises = assignedItems.map(async (item) => {
        const { data, error } = await supabase
          .from("tenant_furniture")
          .select(
            `
            id,
            furniture_item_id,
            rent_part,
            assigned_quantity,
            tenants (name)
          `
          )
          .eq("furniture_item_id", item.id);

        if (error) throw error;

        return data.map((tf) => ({
          id: tf.id,
          furniture_item_id: tf.furniture_item_id,
          name: item.name,
          category: item.category,
          assigned_quantity: tf.assigned_quantity,
          condition: item.condition,
          location: item.location,
          tenant: tf.tenants.name,
          rent_part: tf.rent_part,
          calendarEvent: item.calendarEvent,
        }));
      });

      const results = await Promise.all(tenantFurniturePromises);
      setTenantFurnitureItems(results.flat());
    } catch (error: any) {
      setErrorMessage("Failed to load assigned items. Please try again.");
      toast({
        title: "Error fetching tenant furniture",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingTenantFurniture(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, flat_id")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      setTenants(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching tenants",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchInventoryItems();
    fetchTenants();
  }, []);

  useEffect(() => {
    if (inventoryItems.length > 0) {
      fetchTenantFurniture();
    }
  }, [inventoryItems]);

  // Real-time subscriptions
  useEffect(() => {
    const furnitureSubscription = supabase
      .channel("furniture_items_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "furniture_items" },
        () => {
          fetchInventoryItems();
        }
      )
      .subscribe();

    const tenantFurnitureSubscription = supabase
      .channel("tenant_furniture_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tenant_furniture" },
        () => {
          fetchInventoryItems();
          fetchTenantFurniture();
        }
      )
      .subscribe();

    const calendarSubscription = supabase
      .channel("calendar_events_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events" },
        () => {
          fetchInventoryItems();
        }
      )
      .subscribe();

    return () => {
      furnitureSubscription.unsubscribe();
      tenantFurnitureSubscription.unsubscribe();
      calendarSubscription.unsubscribe();
    };
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return dateStr;
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;

    setDeleteInProgress(true);
    try {
      const { data: assignments, error: assignError } = await supabase
        .from("tenant_furniture")
        .select("id")
        .eq("furniture_item_id", itemToDelete);
      if (assignError) throw assignError;

      if (assignments.length > 0) {
        throw new Error("Cannot delete item with active assignments");
      }

      const { error } = await supabase
        .from("furniture_items")
        .delete()
        .eq("id", itemToDelete);

      if (error) throw error;

      setInventoryItems((prev) => prev.filter((item) => item.id !== itemToDelete));
      toast({
        title: "Item deleted",
        description: "The inventory item has been successfully deleted",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting item",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteInProgress(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleUnassignItem = async () => {
    if (!itemToUnassign) return;

    setUnassignInProgress(true);
    try {
      const { error } = await supabase
        .from("tenant_furniture")
        .delete()
        .eq("id", itemToUnassign.id);

      if (error) throw error;

      toast({
        title: "Item unassigned",
        description: `${itemToUnassign.name} has been unassigned`,
      });

      fetchInventoryItems();
      fetchTenantFurniture();
    } catch (error: any) {
      toast({
        title: "Error unassigning item",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUnassignInProgress(false);
      setUnassignDialogOpen(false);
      setItemToUnassign(null);
    }
  };

  const inventoryStats = useMemo(() => ({
    totalItems: inventoryItems.reduce((sum, item) => sum + item.total_quantity, 0),
    assignedItems: inventoryItems.reduce(
      (sum, item) => sum + (item.total_quantity - item.available_quantity),
      0
    ),
    totalValue: inventoryItems.reduce(
      (sum, item) => sum + item.purchasePrice * item.total_quantity,
      0
    ),
    categories: Object.entries(
      inventoryItems.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + item.total_quantity;
        return acc;
      }, {} as Record<string, number>)
    ),
  }), [inventoryItems]);

  const debouncedSetSearchQuery = useCallback(
    debounce((value: string) => {
      setSearchQuery(value);
    }, 300),
    []
  );

  const getFilteredItems = useMemo(() => {
    return inventoryItems.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDateRange =
        !calendarDateRange.from ||
        !calendarDateRange.to ||
        (item.calendarEvent &&
          item.calendarEvent.startDate &&
          new Date(item.calendarEvent.startDate) >= calendarDateRange.from &&
          new Date(item.calendarEvent.startDate) <= calendarDateRange.to);

      if (activeTab === "all") return matchesSearch && matchesDateRange;
      if (activeTab === "assigned")
        return matchesSearch && item.total_quantity > item.available_quantity && matchesDateRange;
      if (activeTab === "available")
        return matchesSearch && item.available_quantity > 0 && matchesDateRange;
      return matchesSearch && matchesDateRange;
    });
  }, [inventoryItems, searchQuery, activeTab, calendarDateRange]);

  const filteredTenantFurniture = useMemo(() => {
    return tenantFurnitureItems.filter((tf) => {
      const matchesSearch =
        tf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tf.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDateRange =
        !calendarDateRange.from ||
        !calendarDateRange.to ||
        (tf.calendarEvent &&
          tf.calendarEvent.startDate &&
          new Date(tf.calendarEvent.startDate) >= calendarDateRange.from &&
          new Date(tf.calendarEvent.startDate) <= calendarDateRange.to);

      return matchesSearch && matchesDateRange;
    });
  }, [tenantFurnitureItems, searchQuery, calendarDateRange]);

  const isFilterActive = searchQuery || calendarDateRange.from || calendarDateRange.to;

  return (
    <TooltipProvider>
      <div className="space-y-8 p-6 bg-gray-50 min-h-screen">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-extrabold text-gray-900">Inventory Management</h1>
          <div className="flex gap-3">
            <Select
              value={selectedTenant?.id || ""}
              onValueChange={(value) => {
                const tenant = tenants.find((t) => t.id === value);
                setSelectedTenant(tenant || null);
                setShowBreakdown(!!tenant);
              }}
            >
              <SelectTrigger className="w-[220px] bg-white shadow-sm">
                <SelectValue placeholder="Select tenant for breakdown" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                setEditItem(null);
                setDialogOpen(true);
              }}
              className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm"
            >
              <Plus className="h-5 w-5" />
              Add Item
            </Button>
          </div>
        </div>

        {showBreakdown && selectedTenant && (
          <ApplianceRentBreakdown
            tenantId={selectedTenant.id}
            flatId={selectedTenant.flat_id}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Total Items</CardTitle>
              <CardDescription>In inventory</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="animate-pulse h-8 w-16 bg-gray-200 rounded"></div>
              ) : (
                <>
                  <div className="flex items-center">
                    <Package2 className="h-6 w-6 text-blue-600 mr-3" />
                    <span className="text-3xl font-bold">{inventoryStats.totalItems}</span>
                  </div>
                  <div className="mt-3 flex justify-between text-sm text-gray-600">
                    <span>Available: {inventoryStats.totalItems - inventoryStats.assignedItems}</span>
                    <span>Assigned: {inventoryStats.assignedItems}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Total Value</CardTitle>
              <CardDescription>Inventory worth</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="animate-pulse h-8 w-24 bg-gray-200 rounded"></div>
              ) : (
                <>
                  <div className="text-3xl font-bold">
                    ₹{inventoryStats.totalValue.toLocaleString()}
                  </div>
                  <div className="mt-3">
                    <div className="text-sm text-gray-600">By category:</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {inventoryStats.categories.map(([category, count]) => (
                        <span
                          key={category}
                          className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800"
                        >
                          {category}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Quick Add</CardTitle>
              <CardDescription>Add item to inventory</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  setEditItem(null);
                  setDialogOpen(true);
                }}
              >
                <PackagePlus className="h-5 w-5" />
                New Inventory Item
              </Button>
            </CardContent>
          </Card>
        </div>

        {errorMessage && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md">
            <p>{errorMessage}</p>
          </div>
        )}

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">Inventory Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <TabsList className="bg-gray-100 p-1 rounded-lg">
                  <TabsTrigger value="all" className="px-4 py-2">All Items</TabsTrigger>
                  <TabsTrigger value="assigned" className="px-4 py-2">Assigned</TabsTrigger>
                  <TabsTrigger value="available" className="px-4 py-2">Available</TabsTrigger>
                </TabsList>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Input
                      placeholder="Search inventory..."
                      className="pl-10 pr-3 py-2 bg-white shadow-sm"
                      onChange={(e) => debouncedSetSearchQuery(e.target.value)}
                    />
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`flex items-center gap-2 ${
                          calendarDateRange.from ? "bg-blue-100 text-blue-700" : ""
                        }`}
                      >
                        <Filter className="h-4 w-4" />
                        Filter by Event Date
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <Label className="font-semibold">Event Date Range</Label>
                          {(calendarDateRange.from || calendarDateRange.to) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCalendarDateRange({ from: null, to: null })}
                            >
                              <X className="h-4 w-4" />
                              Clear
                            </Button>
                          )}
                        </div>
                        <Calendar
                          mode="range"
                          selected={{
                            from: calendarDateRange.from || undefined,
                            to: calendarDateRange.to || undefined,
                          }}
                          onSelect={(range) =>
                            setCalendarDateRange({
                              from: range?.from || null,
                              to: range?.to || null,
                            })
                          }
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {isFilterActive && (
                <div className="mb-4 text-sm text-gray-600">
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                    Active filters: {searchQuery ? "Search" : ""}{" "}
                    {calendarDateRange.from ? "Date Range" : ""}
                  </span>
                </div>
              )}

              <TabsContent value="all">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Purchase Price</TableHead>
                        <TableHead>Event Start</TableHead>
                        <TableHead>Event End</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-10">
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : getFilteredItems.length > 0 ? (
                        getFilteredItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>
                              {item.total_quantity} (Available: {item.available_quantity})
                            </TableCell>
                            <TableCell>{item.condition}</TableCell>
                            <TableCell>{item.location}</TableCell>
                            <TableCell>
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  item.assigned
                                    ? "bg-green-100 text-green-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {item.assigned ? "Assigned" : "Available"}
                              </span>
                            </TableCell>
                            <TableCell>
                              ₹{item.purchasePrice.toLocaleString()}
                            </TableCell>
                            <TableCell>{item.calendarEvent?.startDate || "-"}</TableCell>
                            <TableCell>{item.calendarEvent?.endDate || "-"}</TableCell>
                            <TableCell className="text-right space-x-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditItem(item);
                                      setDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Item</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setAssignItem(item);
                                      setAssignDialogOpen(true);
                                    }}
                                    disabled={item.available_quantity === 0}
                                  >
                                    Assign
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Assign to Tenant</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-800"
                                    onClick={() => {
                                      setItemToDelete(item.id);
                                      setDeleteDialogOpen(true);
                                    }}
                                    disabled={item.assigned}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete Item</TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-10">
                            <div className="flex flex-col items-center">
                              <Package2 className="h-10 w-10 text-gray-300 mb-2" />
                              <h3 className="text-lg font-medium text-gray-900">
                                No items found
                              </h3>
                              <p className="text-gray-500 mt-1">
                                {searchQuery || calendarDateRange.from
                                  ? "Try adjusting your search or date criteria"
                                  : "Add items to your inventory"}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="assigned">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Assigned Quantity</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Rent Part</TableHead>
                        <TableHead>Event Start</TableHead>
                        <TableHead>Event End</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading || loadingTenantFurniture ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-10">
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredTenantFurniture.length > 0 ? (
                        filteredTenantFurniture.map((tf) => (
                          <TableRow key={tf.id}>
                            <TableCell className="font-medium">{tf.name}</TableCell>
                            <TableCell>{tf.category}</TableCell>
                            <TableCell>{tf.assigned_quantity}</TableCell>
                            <TableCell>{tf.condition}</TableCell>
                            <TableCell>{tf.location}</TableCell>
                            <TableCell>{tf.tenant}</TableCell>
                            <TableCell>₹{tf.rent_part.toLocaleString()}</TableCell>
                            <TableCell>{tf.calendarEvent?.startDate || "-"}</TableCell>
                            <TableCell>{tf.calendarEvent?.endDate || "-"}</TableCell>
                            <TableCell className="text-right space-x-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setItemToUnassign({
                                        id: tf.id,
                                        furniture_item_id: tf.furniture_item_id,
                                        name: tf.name,
                                      });
                                      setUnassignDialogOpen(true);
                                    }}
                                  >
                                    <Unlink className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Unassign Item</TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-10">
                            <div className="flex flex-col items-center">
                              <Package2 className="h-10 w-10 text-gray-300 mb-2" />
                              <h3 className="text-lg font-medium text-gray-900">
                                No assigned items found
                              </h3>
                              <p className="text-gray-500 mt-1">
                                {searchQuery || calendarDateRange.from
                                  ? "Try adjusting your search or date criteria"
                                  : "Assign items to tenants"}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="available">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Purchase Date</TableHead>
                        <TableHead>Purchase Price</TableHead>
                        <TableHead>Event Start</TableHead>
                        <TableHead>Event End</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-10">
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : getFilteredItems.length > 0 ? (
                        getFilteredItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>{item.available_quantity}</TableCell>
                            <TableCell>{item.condition}</TableCell>
                            <TableCell>{item.location}</TableCell>
                            <TableCell>{item.purchaseDate}</TableCell>
                            <TableCell>
                              ₹{item.purchasePrice.toLocaleString()}
                            </TableCell>
                            <TableCell>{item.calendarEvent?.startDate || "-"}</TableCell>
                            <TableCell>{item.calendarEvent?.endDate || "-"}</TableCell>
                            <TableCell className="text-right space-x-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditItem(item);
                                      setDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Item</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setAssignItem(item);
                                      setAssignDialogOpen(true);
                                    }}
                                    disabled={item.available_quantity === 0}
                                  >
                                    Assign
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Assign to Tenant</TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-10">
                            <div className="flex flex-col items-center">
                              <Package2 className="h-10 w-10 text-gray-300 mb-2" />
                              <h3 className="text-lg font-medium text-gray-900">
                                No available items found
                              </h3>
                              <p className="text-gray-500 mt-1">
                                {searchQuery || calendarDateRange.from
                                  ? "Try adjusting your search or date criteria"
                                  : "Add new items to inventory"}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <InventoryForm
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditItem(null);
          }}
          onItemAdded={fetchInventoryItems}
          initialItem={editItem}
          isEditMode={!!editItem}
        />

        {assignItem && (
          <AssignForm
            open={assignDialogOpen}
            onOpenChange={(open) => {
              setAssignDialogOpen(open);
              if (!open) setAssignItem(null);
            }}
            item={assignItem}
            onAssign={() => {
              fetchInventoryItems();
              fetchTenantFurniture();
            }}
          />
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Inventory Item</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this inventory item? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteInProgress}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteItem}
                disabled={deleteInProgress}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteInProgress ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={unassignDialogOpen} onOpenChange={setUnassignDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unassign Inventory Item</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to unassign {itemToUnassign?.name}?
                This will make all assigned items available again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={unassignInProgress}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleUnassignItem}
                disabled={unassignInProgress}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {unassignInProgress ? "Unassigning..." : "Unassign"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}