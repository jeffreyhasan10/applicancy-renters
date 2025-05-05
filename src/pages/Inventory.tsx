import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Package2,
  Plus,
  Search,
  PackagePlus,
  Trash2,
  Edit,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  condition: "new" | "used" | "damaged";
  location: string;
  flat_id: string | null;
  flat_name: string | null;
  purchase_date: string;
  purchase_price: number;
  unit_rent: number;
  total_quantity: number;
  available_quantity: number;
  calendar_event_id?: string;
  event_start_date?: string;
  event_end_date?: string;
}

interface InventoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemAdded: () => void;
  initialItem?: InventoryItem;
  isEditMode: boolean;
}

function InventoryForm({
  open,
  onOpenChange,
  onItemAdded,
  initialItem,
  isEditMode,
}: InventoryFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: initialItem?.name || "",
    category: initialItem?.category || "Furniture",
    condition: initialItem?.condition || "new",
    purchase_date: initialItem?.purchase_date || format(new Date(), "yyyy-MM-dd"),
    purchase_price: initialItem?.purchase_price || 0,
    unit_rent: initialItem?.unit_rent || 0,
    total_quantity: initialItem?.total_quantity || 1,
    is_appliance: initialItem?.category === "Appliance" || false,
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [existingItem, setExistingItem] = useState<InventoryItem | null>(null);

  // Reset form when initialItem changes
  useEffect(() => {
    if (initialItem) {
      setFormData({
        name: initialItem.name,
        category: initialItem.category,
        condition: initialItem.condition,
        purchase_date: initialItem.purchase_date,
        purchase_price: initialItem.purchase_price,
        unit_rent: initialItem.unit_rent,
        total_quantity: initialItem.total_quantity,
        is_appliance: initialItem.category === "Appliance",
      });
    }
  }, [initialItem]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name) newErrors.name = "Name is required";
    if (formData.total_quantity < 1) newErrors.total_quantity = "Quantity must be at least 1";
    if (formData.purchase_price < 0) newErrors.purchase_price = "Price must be non-negative";
    if (formData.unit_rent < 0) newErrors.unit_rent = "Rent must be non-negative";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkForExistingItem = async () => {
    try {
      const { data, error } = await supabase
        .from("furniture_items")
        .select("*")
        .eq("name", formData.name)
        .eq("category", formData.is_appliance ? "Appliance" : "Furniture")
        .eq("condition", formData.condition)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      setExistingItem(data);
    } catch (error: any) {
      console.error("Error checking for existing item:", error);
    }
  };

  useEffect(() => {
    if (formData.name && formData.condition) {
      checkForExistingItem();
    }
  }, [formData.name, formData.condition]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      if (isEditMode && initialItem) {
        const { error } = await supabase
          .from("furniture_items")
          .update({
            name: formData.name,
            category: formData.is_appliance ? "Appliance" : "Furniture",
            condition: formData.condition,
            purchase_date: formData.purchase_date,
            purchase_price: formData.purchase_price,
            unit_rent: formData.unit_rent,
            total_quantity: formData.total_quantity,
            available_quantity: formData.total_quantity,
            is_appliance: formData.is_appliance,
          })
          .eq("id", initialItem.id);

        if (error) throw error;
        toast({
          title: "Item updated",
          description: `${formData.name} has been updated`,
        });
      } else {
        if (existingItem) {
          // Update existing item's quantity
          const newTotalQuantity = existingItem.total_quantity + formData.total_quantity;
          const newAvailableQuantity = existingItem.available_quantity + formData.total_quantity;

          const { error } = await supabase
            .from("furniture_items")
            .update({
              total_quantity: newTotalQuantity,
              available_quantity: newAvailableQuantity,
              purchase_date: formData.purchase_date,
              purchase_price: formData.purchase_price,
              unit_rent: formData.unit_rent,
            })
            .eq("id", existingItem.id);

          if (error) throw error;
          toast({
            title: "Item quantity updated",
            description: `Added ${formData.total_quantity} more ${formData.name}(s) to inventory`,
          });
        } else {
          // Create new item
          const { error } = await supabase.from("furniture_items").insert({
            name: formData.name,
            category: formData.is_appliance ? "Appliance" : "Furniture",
            condition: formData.condition,
            purchase_date: formData.purchase_date,
            purchase_price: formData.purchase_price,
            unit_rent: formData.unit_rent,
            total_quantity: formData.total_quantity,
            available_quantity: formData.total_quantity,
            is_appliance: formData.is_appliance,
          });

          if (error) throw error;
          toast({
            title: "Item added",
            description: `${formData.name} has been added to inventory`,
          });
        }
      }

      onItemAdded();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: `Error ${isEditMode ? "updating" : "adding"} item`,
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            {isEditMode ? "Edit Inventory Item" : "Add Inventory Item"}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            {isEditMode ? "Update the details of the inventory item." : "Add a new item to your inventory."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-700 font-medium">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={errors.name ? "border-red-500" : "border-gray-200 focus:ring-blue-500"}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            {existingItem && !isEditMode && (
              <p className="text-sm text-blue-600">
                Found existing item: {existingItem.name} (Current quantity: {existingItem.total_quantity})
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="category" className="text-gray-700 font-medium">Type</Label>
            <Select
              value={formData.is_appliance ? "Appliance" : "Furniture"}
              onValueChange={(value) => setFormData({ ...formData, is_appliance: value === "Appliance" })}
            >
              <SelectTrigger className="border-gray-200 focus:ring-blue-500">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Furniture">Furniture</SelectItem>
                <SelectItem value="Appliance">Appliance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="condition" className="text-gray-700 font-medium">Condition</Label>
            <Select
              value={formData.condition}
              onValueChange={(value) => setFormData({ ...formData, condition: value as "new" | "used" | "damaged" })}
            >
              <SelectTrigger className="border-gray-200 focus:ring-blue-500">
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="used">Used</SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchase_date" className="text-gray-700 font-medium">Purchase Date</Label>
            <Input
              id="purchase_date"
              type="date"
              value={formData.purchase_date}
              onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
              className="border-gray-200 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchase_price" className="text-gray-700 font-medium">Purchase Price (₹)</Label>
            <Input
              id="purchase_price"
              type="number"
              value={formData.purchase_price || ""}
              onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
              min="0"
              className={errors.purchase_price ? "border-red-500" : "border-gray-200 focus:ring-blue-500"}
            />
            {errors.purchase_price && <p className="text-sm text-red-500">{errors.purchase_price}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit_rent" className="text-gray-700 font-medium">Rent per Item (₹)</Label>
            <Input
              id="unit_rent"
              type="number"
              value={formData.unit_rent || ""}
              onChange={(e) => setFormData({ ...formData, unit_rent: parseFloat(e.target.value) || 0 })}
              min="0"
              className={errors.unit_rent ? "border-red-500" : "border-gray-200 focus:ring-blue-500"}
            />
            {errors.unit_rent && <p className="text-sm text-red-500">{errors.unit_rent}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="total_quantity" className="text-gray-700 font-medium">Total Quantity</Label>
            <Input
              id="total_quantity"
              type="number"
              value={formData.total_quantity || ""}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "") {
                  setFormData({ ...formData, total_quantity: 0 });
                } else {
                  const numValue = parseInt(value);
                  if (!isNaN(numValue) && numValue >= 0) {
                    setFormData({ ...formData, total_quantity: numValue });
                  }
                }
              }}
              min="1"
              className={errors.total_quantity ? "border-red-500" : "border-gray-200 focus:ring-blue-500"}
            />
            {errors.total_quantity && <p className="text-sm text-red-500">{errors.total_quantity}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="border-gray-200 hover:bg-gray-100 text-gray-700">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
              {isEditMode ? "Update" : existingItem ? "Add More" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [calendarDateRange, setCalendarDateRange] = useState<{
    from: Date | null;
    to: Date | null;
  }>({ from: null, to: null });

  const fetchInventoryItems = async () => {
    try {
      setLoading(true);
      // Fetch all furniture items
      const { data: furnitureData, error: furnitureError } = await supabase
        .from("furniture_items")
        .select(`
          id,
          name,
          category,
          condition,
          purchase_date,
          purchase_price,
          unit_rent,
          total_quantity,
          available_quantity,
          flat_id,
          flats (name)
        `);

      if (furnitureError) throw furnitureError;

      // Fetch associated calendar events
      const furnitureIds = furnitureData.map((item) => item.id);
      const { data: eventsData, error: eventsError } = await supabase
        .from("calendar_events")
        .select("id, related_id, start_date, end_date")
        .eq("related_table", "furniture_items")
        .in("related_id", furnitureIds);

      if (eventsError) throw eventsError;

      // Map furniture items with their calendar events
      const formattedItems: InventoryItem[] = furnitureData.map((item) => {
        const event = eventsData.find((e) => e.related_id === item.id);
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          condition: item.condition,
          location: item.flats?.name || "Unassigned",
          flat_id: item.flat_id,
          flat_name: item.flats?.name || null,
          purchase_date: format(new Date(item.purchase_date || item.created_at), "yyyy-MM-dd"),
          purchase_price: parseFloat(item.purchase_price?.toString() || "0"),
          unit_rent: parseFloat(item.unit_rent?.toString() || "0"),
          total_quantity: item.total_quantity,
          available_quantity: item.available_quantity,
          calendar_event_id: event?.id,
          event_start_date: event?.start_date,
          event_end_date: event?.end_date,
        };
      });

      setInventoryItems(formattedItems);
    } catch (error: any) {
      toast({
        title: "Error fetching inventory",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryItems();
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    const subscription = supabase
      .channel("inventory_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "furniture_items" },
        () => fetchInventoryItems()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events", filter: "related_table=eq.furniture_items" },
        () => fetchInventoryItems()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;

    try {
      const { data: assignments, error: assignError } = await supabase
        .from("furniture_items")
        .select("flat_id")
        .eq("id", itemToDelete)
        .single();

      if (assignError) throw assignError;
      if (assignments.flat_id) throw new Error("Cannot delete item assigned to a flat");

      const { data: calendarEvent, error: eventError } = await supabase
        .from("calendar_events")
        .select("id")
        .eq("related_table", "furniture_items")
        .eq("related_id", itemToDelete)
        .single();

      if (eventError && eventError.code !== "PGRST116") throw eventError;
      if (calendarEvent) {
        await supabase.from("calendar_events").delete().eq("id", calendarEvent.id).eq("related_table", "furniture_items");
      }

      const { error } = await supabase
        .from("furniture_items")
        .delete()
        .eq("id", itemToDelete);

      if (error) throw error;

      toast({
        title: "Item deleted",
        description: "The inventory item has been successfully deleted",
      });

      fetchInventoryItems();
    } catch (error: any) {
      toast({
        title: "Error deleting item",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const inventoryStats = useMemo(() => ({
    totalValue: inventoryItems.reduce(
      (sum, item) => sum + item.purchase_price * item.total_quantity,
      0
    ),
    totalItems: inventoryItems.reduce((sum, item) => sum + item.total_quantity, 0),
    assignedItems: inventoryItems.reduce(
      (sum, item) => sum + (item.total_quantity - item.available_quantity),
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
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.flat_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

      const matchesDateRange =
        !calendarDateRange.from ||
        !calendarDateRange.to ||
        (item.event_start_date &&
          new Date(item.event_start_date) >= calendarDateRange.from &&
          new Date(item.event_start_date) <= calendarDateRange.to);

      if (activeTab === "all") return matchesSearch && matchesDateRange;
      if (activeTab === "assigned")
        return matchesSearch && item.total_quantity > item.available_quantity && matchesDateRange;
      if (activeTab === "available")
        return matchesSearch && item.available_quantity > 0 && matchesDateRange;
      return matchesSearch && matchesDateRange;
    });
  }, [inventoryItems, searchQuery, activeTab, calendarDateRange]);

  const isFilterActive = searchQuery || calendarDateRange.from || calendarDateRange.to;

  return (
    <TooltipProvider>
      <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6 bg-luxury-pearl min-h-screen">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-luxury-charcoal tracking-tight">
            Inventory Management
          </h1>
          <Button
            onClick={() => {
              setEditItem(null);
              setDialogOpen(true);
            }}
            className="w-full sm:w-auto gap-2 bg-luxury-gold hover:bg-luxury-gold/90 text-luxury-charcoal shadow-gold transition-all duration-200"
          >
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            Add Item
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card className="shadow-luxury border-luxury-gold/20">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg font-semibold text-luxury-charcoal">Inventory Overview</CardTitle>
              <CardDescription className="text-luxury-slate text-xs sm:text-sm">Key metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="animate-pulse h-8 w-24 bg-gray-200 rounded"></div>
              ) : (
                <div className="space-y-1 sm:space-y-2">
                  <p className="text-xs sm:text-sm text-gray-600">Total Value: ₹{inventoryStats.totalValue.toLocaleString()}</p>
                  <p className="text-xs sm:text-sm text-gray-600">Total Items: {inventoryStats.totalItems}</p>
                  <p className="text-xs sm:text-sm text-gray-600">Assigned Items: {inventoryStats.assignedItems}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-luxury border-luxury-gold/20">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg font-semibold text-luxury-charcoal">Quick Add</CardTitle>
              <CardDescription className="text-luxury-slate text-xs sm:text-sm">Add item to inventory</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full gap-2 bg-luxury-gold hover:bg-luxury-gold/90 text-luxury-charcoal transition-all duration-200 shadow-gold"
                onClick={() => {
                  setEditItem(null);
                  setDialogOpen(true);
                }}
              >
                <PackagePlus className="h-4 w-4 sm:h-5 sm:w-5" />
                New Inventory Item
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-luxury border-luxury-gold/20">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg font-semibold text-luxury-charcoal">Categories</CardTitle>
              <CardDescription className="text-luxury-slate text-xs sm:text-sm">Item breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="animate-pulse h-8 w-24 bg-gray-200 rounded"></div>
              ) : (
                <div className="flex flex-wrap gap-1 sm:gap-2">
                  {inventoryStats.categories.map(([category, count]) => (
                    <Badge
                      key={category}
                      variant="secondary"
                      className="bg-gray-100 text-gray-800 text-xs sm:text-sm"
                    >
                      {category}: {count}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-luxury border-luxury-gold/20">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl font-semibold text-luxury-charcoal">Inventory Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <TabsList className="bg-luxury-pearl/50 p-1 rounded-lg border border-luxury-gold/20 w-full sm:w-auto">
                  <TabsTrigger value="all" className="px-3 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-luxury-gold data-[state=active]:text-luxury-charcoal">
                    All Items <Badge className="ml-2 bg-luxury-gold/20 text-luxury-charcoal text-xs">{inventoryItems.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="assigned" className="px-3 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-luxury-gold data-[state=active]:text-luxury-charcoal">
                    Assigned <Badge className="ml-2 bg-luxury-gold/20 text-luxury-charcoal text-xs">{inventoryItems.filter(i => i.total_quantity > i.available_quantity).length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="available" className="px-3 sm:px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-luxury-gold data-[state=active]:text-luxury-charcoal">
                    Available <Badge className="ml-2 bg-luxury-gold/20 text-luxury-charcoal text-xs">{inventoryItems.filter(i => i.available_quantity > 0).length}</Badge>
                  </TabsTrigger>
                </TabsList>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Input
                      placeholder="Search inventory..."
                      className="pl-10 pr-3 py-2 text-xs sm:text-sm bg-white shadow-luxury border-luxury-gold/20 focus:border-luxury-gold focus:ring-luxury-gold/20"
                      onChange={(e) => debouncedSetSearchQuery(e.target.value)}
                    />
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <Search className="h-4 w-4 text-luxury-slate" />
                    </div>
                  </div>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`flex items-center gap-2 border-luxury-gold/20 hover:bg-luxury-pearl/50 w-full sm:w-auto text-xs sm:text-sm ${
                          calendarDateRange.from ? "bg-luxury-gold/10 text-luxury-charcoal" : ""
                        }`}
                      >
                        <Filter className="h-4 w-4" />
                        Filter by Event Date
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] sm:w-80">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <Label className="font-semibold text-xs sm:text-sm">Event Date Range</Label>
                          {(calendarDateRange.from || calendarDateRange.to) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCalendarDateRange({ from: null, to: null })}
                              className="text-xs sm:text-sm"
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
                <div className="mb-3 sm:mb-4 text-xs sm:text-sm text-gray-600">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs sm:text-sm">
                    Active filters: {searchQuery ? "Search" : ""}{" "}
                    {calendarDateRange.from ? "Date Range" : ""}
                  </Badge>
                </div>
              )}

              <TabsContent value="all">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-luxury-gold/20">
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Item</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Category</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Quantity</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Condition</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Location</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Purchase Price</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Rent</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Event Start</TableHead>
                        <TableHead className="text-right text-luxury-charcoal text-xs sm:text-sm">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 sm:py-10">
                            <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
                          </TableCell>
                        </TableRow>
                      ) : getFilteredItems.length > 0 ? (
                        getFilteredItems.map((item) => (
                          <TableRow key={item.id} className="hover:bg-luxury-pearl/50 border-b border-luxury-gold/10">
                            <TableCell className="font-medium text-luxury-charcoal text-xs sm:text-sm">{item.name}</TableCell>
                            <TableCell className="text-luxury-charcoal text-xs sm:text-sm">{item.category}</TableCell>
                            <TableCell className="text-luxury-charcoal text-xs sm:text-sm">
                              <div className="flex flex-col">
                                <span>Total: {item.total_quantity}</span>
                                <span className="text-xs text-gray-500">Available: {item.available_quantity}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-luxury-charcoal text-xs sm:text-sm">
                              <Badge
                                variant={
                                  item.condition === "new"
                                    ? "default"
                                    : item.condition === "used"
                                    ? "secondary"
                                    : "destructive"
                                }
                                className="text-xs sm:text-sm"
                              >
                                {item.condition}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-luxury-charcoal text-xs sm:text-sm">{item.location}</TableCell>
                            <TableCell className="text-luxury-charcoal text-xs sm:text-sm">₹{item.purchase_price.toLocaleString()}</TableCell>
                            <TableCell className="text-luxury-charcoal text-xs sm:text-sm">₹{item.unit_rent.toLocaleString()}</TableCell>
                            <TableCell className="text-luxury-charcoal text-xs sm:text-sm">
                              {item.event_start_date
                                ? format(new Date(item.event_start_date), "MMM d, yyyy")
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right space-x-1 sm:space-x-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditItem(item);
                                      setDialogOpen(true);
                                    }}
                                    className="h-6 w-6 sm:h-8 sm:w-8 p-0"
                                  >
                                    <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Item</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 sm:h-8 sm:w-8 p-0 text-red-600 hover:text-red-800"
                                    onClick={() => {
                                      setItemToDelete(item.id);
                                      setDeleteDialogOpen(true);
                                    }}
                                    disabled={item.available_quantity < item.total_quantity}
                                  >
                                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete Item</TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 sm:py-10">
                            <div className="flex flex-col items-center">
                              <Package2 className="h-8 w-8 sm:h-10 sm:w-10 text-gray-300 mb-2" />
                              <h3 className="text-base sm:text-lg font-medium text-gray-900">
                                No items found
                              </h3>
                              <p className="text-xs sm:text-sm text-gray-500 mt-1">
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
                      <TableRow className="border-b border-luxury-gold/20">
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Item</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Category</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Assigned Quantity</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Condition</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Location</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Rent</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Event Start</TableHead>
                        <TableHead className="text-right text-luxury-charcoal text-xs sm:text-sm">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
                          </TableCell>
                        </TableRow>
                      ) : getFilteredItems.filter(i => i.total_quantity > i.available_quantity).length > 0 ? (
                        getFilteredItems
                          .filter(i => i.total_quantity > i.available_quantity)
                          .map((item) => (
                            <TableRow key={item.id} className="hover:bg-luxury-pearl/50 border-b border-luxury-gold/10">
                              <TableCell className="font-medium text-luxury-charcoal text-xs sm:text-sm">{item.name}</TableCell>
                              <TableCell className="text-luxury-charcoal text-xs sm:text-sm">{item.category}</TableCell>
                              <TableCell className="text-luxury-charcoal text-xs sm:text-sm">{item.total_quantity - item.available_quantity}</TableCell>
                              <TableCell className="text-luxury-charcoal text-xs sm:text-sm">
                                <Badge
                                  variant={
                                    item.condition === "new"
                                      ? "default"
                                      : item.condition === "used"
                                      ? "secondary"
                                      : "destructive"
                                  }
                                  className="text-xs sm:text-sm"
                                >
                                  {item.condition}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-luxury-charcoal text-xs sm:text-sm">{item.location}</TableCell>
                              <TableCell className="text-luxury-charcoal text-xs sm:text-sm">₹{item.unit_rent.toLocaleString()}</TableCell>
                              <TableCell className="text-luxury-charcoal text-xs sm:text-sm">
                                {item.event_start_date
                                  ? format(new Date(item.event_start_date), "MMM d, yyyy")
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-right space-x-1 sm:space-x-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setEditItem(item);
                                        setDialogOpen(true);
                                      }}
                                      className="h-6 w-6 sm:h-8 sm:w-8 p-0"
                                    >
                                      <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit Item</TooltipContent>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-10">
                            <div className="flex flex-col items-center">
                              <Package2 className="h-10 w-10 text-gray-300 mb-2" />
                              <h3 className="text-lg font-medium text-gray-900">
                                No assigned items found
                              </h3>
                              <p className="text-gray-500 mt-1">
                                Assign items to flats in Furniture Management
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
                      <TableRow className="border-b border-luxury-gold/20">
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Item</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Category</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Quantity</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Condition</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Location</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Purchase Price</TableHead>
                        <TableHead className="text-luxury-charcoal text-xs sm:text-sm">Rent</TableHead>
                        <TableHead className="text-right text-luxury-charcoal text-xs sm:text-sm">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
                          </TableCell>
                        </TableRow>
                      ) : getFilteredItems.filter(i => i.available_quantity > 0).length > 0 ? (
                        getFilteredItems
                          .filter(i => i.available_quantity > 0)
                          .map((item) => (
                            <TableRow key={item.id} className="hover:bg-luxury-pearl/50 border-b border-luxury-gold/10">
                              <TableCell className="font-medium text-luxury-charcoal text-xs sm:text-sm">{item.name}</TableCell>
                              <TableCell className="text-luxury-charcoal text-xs sm:text-sm">{item.category}</TableCell>
                              <TableCell className="text-luxury-charcoal text-xs sm:text-sm">{item.available_quantity}</TableCell>
                              <TableCell className="text-luxury-charcoal text-xs sm:text-sm">
                                <Badge
                                  variant={
                                    item.condition === "new"
                                      ? "default"
                                      : item.condition === "used"
                                      ? "secondary"
                                      : "destructive"
                                  }
                                  className="text-xs sm:text-sm"
                                >
                                  {item.condition}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-luxury-charcoal text-xs sm:text-sm">{item.location}</TableCell>
                              <TableCell className="text-luxury-charcoal text-xs sm:text-sm">₹{item.purchase_price.toLocaleString()}</TableCell>
                              <TableCell className="text-luxury-charcoal text-xs sm:text-sm">₹{item.unit_rent.toLocaleString()}</TableCell>
                              <TableCell className="text-right space-x-1 sm:space-x-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setEditItem(item);
                                        setDialogOpen(true);
                                      }}
                                      className="h-6 w-6 sm:h-8 sm:w-8 p-0"
                                    >
                                      <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit Item</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 sm:h-8 sm:w-8 p-0 text-red-600 hover:text-red-800"
                                      onClick={() => {
                                        setItemToDelete(item.id);
                                        setDeleteDialogOpen(true);
                                      }}
                                      disabled={item.available_quantity < item.total_quantity}
                                    >
                                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete Item</TooltipContent>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-10">
                            <div className="flex flex-col items-center">
                              <Package2 className="h-10 w-10 text-gray-300 mb-2" />
                              <h3 className="text-lg font-medium text-gray-900">
                                No available items found
                              </h3>
                              <p className="text-gray-500 mt-1">
                                Add new items to inventory
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

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="max-w-[400px] bg-white shadow-luxury border-luxury-gold/20">
            <AlertDialogHeader className="space-y-2">
              <AlertDialogTitle className="text-xl font-semibold text-gray-900">
                Delete Inventory Item
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600">
                Are you sure you want to delete this inventory item? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6">
              <AlertDialogCancel className="border-gray-200 hover:bg-gray-100 text-gray-700">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteItem}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}