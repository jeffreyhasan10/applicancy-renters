import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Package2,
  Plus,
  Search,
  PackagePlus,
  Trash2,
  Edit,
  Unlink,
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
}

interface Flat {
  id: string;
  name: string;
}

// InventoryForm Component
interface InventoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemAdded: () => void;
  initialItem?: InventoryItem;
  isEditMode?: boolean;
}

const PRESET_ITEMS = [
  { name: "Bed", category: "Furniture" },
  { name: "TV", category: "Electronics" },
  { name: "Sofa", category: "Furniture" },
  { name: "Table", category: "Furniture" },
  { name: "Chair", category: "Furniture" },
  { name: "Fridge", category: "Appliances" },
];

function InventoryForm({
  open,
  onOpenChange,
  onItemAdded,
  initialItem,
  isEditMode = false,
}: InventoryFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<InventoryItem>>(
    initialItem || {
      name: "",
      category: "Furniture",
      condition: "new",
      flat_id: null,
      flat: null,
      purchaseDate: "",
      purchasePrice: 0,
      unit_rent: 0,
      total_quantity: 1,
      available_quantity: 1,
    }
  );
  const [flats, setFlats] = useState<Flat[]>([]);
  const [loadingFlats, setLoadingFlats] = useState(false);

  useEffect(() => {
    const fetchFlats = async () => {
      setLoadingFlats(true);
      try {
        const { data, error } = await supabase
          .from("flats")
          .select("id, name")
          .order("name", { ascending: true });

        if (error) throw error;
        setFlats(data || []);
      } catch (error: any) {
        toast({
          title: "Error fetching flats",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoadingFlats(false);
      }
    };

    fetchFlats();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.flat_id) throw new Error("Please select a flat");
      if (!formData.name) throw new Error("Item name is required");
      if (!formData.condition) throw new Error("Please select a condition");
      if (formData.unit_rent === undefined || formData.unit_rent === null)
        throw new Error("Please enter a unit rent value");
      if (formData.total_quantity! < 1)
        throw new Error("Quantity must be at least 1");

      const itemData = {
        name: formData.name,
        category: formData.category,
        condition: formData.condition,
        purchase_date: formData.purchaseDate || new Date().toISOString().split('T')[0],
        purchase_price: formData.purchasePrice,
        flat_id: formData.flat_id,
        unit_rent: formData.unit_rent,
        total_quantity: formData.total_quantity,
        available_quantity: formData.total_quantity,
      };

      if (isEditMode && initialItem?.id) {
        const { error } = await supabase
          .from("furniture_items")
          .update({
            ...itemData,
            available_quantity: Math.min(
              formData.available_quantity || formData.total_quantity!,
              formData.total_quantity!
            ),
          })
          .eq("id", initialItem.id);

        if (error) throw error;
      } else {
        const { data: existingItem, error: fetchError } = await supabase
          .from("furniture_items")
          .select("id, total_quantity, available_quantity")
          .eq("name", formData.name)
          .eq("category", formData.category)
          .eq("flat_id", formData.flat_id)
          .single();

        if (fetchError && fetchError.code !== "PGRST116") throw fetchError;

        if (existingItem) {
          const newTotal = existingItem.total_quantity + (formData.total_quantity || 1);
          const newAvailable = existingItem.available_quantity + (formData.total_quantity || 1);
          const { error } = await supabase
            .from("furniture_items")
            .update({
              total_quantity: newTotal,
              available_quantity: newAvailable,
              purchase_price: formData.purchasePrice,
              purchase_date: formData.purchaseDate || existingItem.purchase_date,
              unit_rent: formData.unit_rent,
              condition: formData.condition,
            })
            .eq("id", existingItem.id);

          if (error) throw error;
        } else {
          const { error } = await supabase.from("furniture_items").insert(itemData);
          if (error) throw error;
        }
      }

      toast({
        title: isEditMode ? "Item updated" : "Item added",
        description: `The inventory item has been successfully ${
          isEditMode ? "updated" : "added"
        }`,
      });

      if (!isEditMode) {
        setFormData({
          name: "",
          category: "Furniture",
          condition: "new",
          flat_id: null,
          flat: null,
          purchaseDate: "",
          purchasePrice: 0,
          unit_rent: 0,
          total_quantity: 1,
          available_quantity: 1,
        });
      }

      onOpenChange(false);
      onItemAdded();
    } catch (error: any) {
      toast({
        title: `Error ${isEditMode ? "updating" : "adding"} item`,
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "purchasePrice" || name === "unit_rent"
          ? parseFloat(value) || 0
          : name === "total_quantity" || name === "available_quantity"
          ? parseInt(value) || 1
          : value,
    }));
  };

  const handleFlatSelection = (flatId: string) => {
    const selectedFlat = flats.find((flat) => flat.id === flatId);
    setFormData((prev) => ({
      ...prev,
      flat_id: flatId || null,
      flat: selectedFlat ? selectedFlat.name : null,
    }));
  };

  const handlePresetItem = (item: { name: string; category: string }) => {
    setFormData((prev) => ({
      ...prev,
      name: item.name,
      category: item.category,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-lg p-6">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Inventory Item" : "Add Inventory Item"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the details for the inventory item."
              : "Enter the details for the new inventory item."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Preset Items</Label>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_ITEMS.map((item) => (
                  <Button
                    key={item.name}
                    type="button"
                    variant={formData.name === item.name ? "default" : "outline"}
                    onClick={() => handlePresetItem(item)}
                    aria-label={`Select ${item.name}`}
                  >
                    {item.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter item name"
                  required
                  aria-required="true"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  placeholder="Enter category"
                  required
                  aria-required="true"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_quantity">Total Quantity</Label>
                <Input
                  id="total_quantity"
                  name="total_quantity"
                  type="number"
                  value={formData.total_quantity}
                  onChange={handleChange}
                  min="1"
                  required
                  aria-required="true"
                />
              </div>

              {isEditMode && (
                <div className="space-y-2">
                  <Label htmlFor="available_quantity">Available Quantity</Label>
                  <Input
                    id="available_quantity"
                    name="available_quantity"
                    type="number"
                    value={formData.available_quantity}
                    onChange={handleChange}
                    min="0"
                    max={formData.total_quantity}
                    required
                    aria-required="true"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="purchasePrice">Purchase Price (₹)</Label>
                <Input
                  id="purchasePrice"
                  name="purchasePrice"
                  type="number"
                  value={formData.purchasePrice}
                  onChange={handleChange}
                  placeholder="Enter purchase price"
                  required
                  aria-required="true"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit_rent">Unit Rent (₹)</Label>
                <Input
                  id="unit_rent"
                  name="unit_rent"
                  type="number"
                  value={formData.unit_rent}
                  onChange={handleChange}
                  placeholder="Enter unit rent"
                  min="0"
                  required
                  aria-required="true"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchaseDate">Purchase Date</Label>
                <Input
                  id="purchaseDate"
                  name="purchaseDate"
                  type="date"
                  value={formData.purchaseDate}
                  onChange={handleChange}
                  required
                  aria-required="true"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Select
                  value={formData.condition || ""}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      condition: value as "new" | "used" | "damaged",
                    }))
                  }
                  required
                  aria-required="true"
                >
                  <SelectTrigger id="condition">
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
                <Label htmlFor="flat_id">Assign to Flat</Label>
                <Select
                  value={formData.flat_id || ""}
                  onValueChange={handleFlatSelection}
                  disabled={loadingFlats}
                  required
                  aria-required="true"
                >
                  <SelectTrigger id="flat_id">
                    <SelectValue
                      placeholder={
                        loadingFlats
                          ? "Loading flats..."
                          : flats.length === 0
                          ? "No flats available"
                          : "Select flat"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {flats.map((flat) => (
                      <SelectItem key={flat.id} value={flat.id}>
                        {flat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loadingFlats || !formData.flat_id}>
              {isEditMode ? "Update Item" : "Add Item"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
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
  const [flats, setFlats] = useState<Flat[]>([]);
  const [loadingFlats, setLoadingFlats] = useState(false);
  const [formData, setFormData] = useState({
    flat_id: item.flat_id || "",
    quantity: 1,
    rent_part: item.unit_rent,
  });

  useEffect(() => {
    const fetchFlats = async () => {
      setLoadingFlats(true);
      try {
        const { data, error } = await supabase
          .from("flats")
          .select("id, name")
          .order("name", { ascending: true });

        if (error) throw error;
        setFlats(data || []);
      } catch (error: any) {
        toast({
          title: "Error fetching flats",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoadingFlats(false);
      }
    };

    fetchFlats();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.flat_id) throw new Error("Please select a flat");
      if (formData.quantity < 1) throw new Error("Quantity must be at least 1");
      if (formData.quantity > item.available_quantity)
        throw new Error(`Only ${item.available_quantity} items available`);
      if (formData.rent_part === undefined)
        throw new Error("Please enter a rent value");

      const newAvailable = item.available_quantity - formData.quantity;
      const { error: updateError } = await supabase
        .from("furniture_items")
        .update({
          flat_id: formData.flat_id,
          available_quantity: newAvailable,
          unit_rent: formData.rent_part,
        })
        .eq("id", item.id);

      if (updateError) throw updateError;

      toast({
        title: "Item assigned",
        description: `${formData.quantity} ${item.name}(s) assigned to flat successfully`,
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
            Assign {item.name} to a flat. Available: {item.available_quantity}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="flat_id">Flat</Label>
            <Select
              value={formData.flat_id}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, flat_id: value }))}
              disabled={loadingFlats}
              required
              aria-required="true"
            >
              <SelectTrigger id="flat_id">
                <SelectValue
                  placeholder={
                    loadingFlats
                      ? "Loading flats..."
                      : flats.length === 0
                      ? "No flats available"
                      : "Select flat"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {flats.map((flat) => (
                  <SelectItem key={flat.id} value={flat.id}>
                    {flat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              value={formData.quantity}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))
              }
              min="1"
              max={item.available_quantity}
              required
              aria-required="true"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rent_part">Rent Part (₹)</Label>
            <Input
              id="rent_part"
              type="number"
              value={formData.rent_part}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, rent_part: parseFloat(e.target.value) || 0 }))
              }
              min="0"
              required
              aria-required="true"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loadingFlats || !formData.flat_id}>
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
  const [itemToUnassign, setItemToUnassign] = useState<InventoryItem | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [unassignInProgress, setUnassignInProgress] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignItem, setAssignItem] = useState<InventoryItem | null>(null);

  const fetchInventoryItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
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

      if (error) throw error;

      const formattedItems: InventoryItem[] = (data || []).map((item) => ({
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
      }));

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
      if (inventoryItems.find((item) => item.id === itemToDelete)?.assigned)
        throw new Error("Cannot delete item with active assignments");

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
      if (!itemToUnassign.flat_id) throw new Error("No flat assigned to this item");

      const { error: updateError } = await supabase
        .from("furniture_items")
        .update({
          flat_id: null,
          available_quantity: itemToUnassign.total_quantity,
        })
        .eq("id", itemToUnassign.id);

      if (updateError) throw updateError;

      toast({
        title: "Item unassigned",
        description: `${itemToUnassign.name} has been unassigned from ${itemToUnassign.flat}`,
      });

      fetchInventoryItems();
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

      if (activeTab === "all") return matchesSearch;
      if (activeTab === "assigned")
        return matchesSearch && item.total_quantity > item.available_quantity;
      if (activeTab === "available")
        return matchesSearch && item.available_quantity > 0;
      return matchesSearch;
    });
  }, [inventoryItems, searchQuery, activeTab]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Inventory Management</h1>
        <Button
          onClick={() => {
            setEditItem(null);
            setDialogOpen(true);
          }}
          className="gap-1"
          aria-label="Add new inventory item"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Items</CardTitle>
            <CardDescription>In inventory</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse h-8 w-16 bg-gray-200 rounded"></div>
            ) : (
              <>
                <div className="flex items-center">
                  <Package2 className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="text-2xl font-bold">{inventoryStats.totalItems}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-gray-500">
                    Available: {inventoryStats.totalItems - inventoryStats.assignedItems}
                  </span>
                  <span className="text-gray-500">
                    Assigned: {inventoryStats.assignedItems}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Value</CardTitle>
            <CardDescription>Inventory worth</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse h-8 w-24 bg-gray-200 rounded"></div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  ₹{inventoryStats.totalValue.toLocaleString()}
                </div>
                <div className="mt-2">
                  <div className="text-sm text-gray-500">By category:</div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {inventoryStats.categories.map(([category, count]) => (
                      <span
                        key={category}
                        className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800"
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

        <Card>
          <CardHeader>
            <CardTitle>Quick Add</CardTitle>
            <CardDescription>Add item to inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full gap-2"
              onClick={() => {
                setEditItem(null);
                setDialogOpen(true);
              }}
              aria-label="Quick add new inventory item"
            >
              <PackagePlus className="h-4 w-4" />
              New Inventory Item
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventory Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <TabsList>
                <TabsTrigger value="all">All Items</TabsTrigger>
                <TabsTrigger value="assigned">Assigned</TabsTrigger>
                <TabsTrigger value="available">Available</TabsTrigger>
              </TabsList>

              <div className="relative w-full sm:w-64">
                <Input
                  placeholder="Search inventory..."
                  className="pl-10 pr-3 py-2"
                  onChange={(e) => debouncedSetSearchQuery(e.target.value)}
                  aria-label="Search inventory items"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>

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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10">
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
                          <TableCell>₹{item.purchasePrice.toLocaleString()}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditItem(item);
                                setDialogOpen(true);
                              }}
                              aria-label={`Edit ${item.name}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setAssignItem(item);
                                setAssignDialogOpen(true);
                              }}
                              disabled={item.available_quantity === 0}
                              aria-label={`Assign ${item.name}`}
                            >
                              Assign
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-800"
                              onClick={() => {
                                setItemToDelete(item.id);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={item.assigned}
                              aria-label={`Delete ${item.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10">
                          <div className="flex flex-col items-center">
                            <Package2 className="h-10 w-10 text-gray-300 mb-2" />
                            <h3 className="text-lg font-medium text-gray-900">
                              No items found
                            </h3>
                            <p className="text-gray-500 mt-1">
                              {searchQuery
                                ? "Try adjusting your search criteria"
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
                      <TableHead>Flat</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10">
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
                            {item.total_quantity - item.available_quantity} /{" "}
                            {item.total_quantity}
                          </TableCell>
                          <TableCell>{item.condition}</TableCell>
                          <TableCell>{item.location}</TableCell>
                          <TableCell>{item.flat || "N/A"}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setItemToUnassign(item);
                                setUnassignDialogOpen(true);
                              }}
                              aria-label={`Unassign ${item.name}`}
                            >
                              <Unlink className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10">
                          <div className="flex flex-col items-center">
                            <Package2 className="h-10 w-10 text-gray-300 mb-2" />
                            <h3 className="text-lg font-medium text-gray-900">
                              No assigned items found
                            </h3>
                            <p className="text-gray-500 mt-1">
                              {searchQuery
                                ? "Try adjusting your search criteria"
                                : "Assign items to flats"}
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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10">
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
                          <TableCell>₹{item.purchasePrice.toLocaleString()}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditItem(item);
                                setDialogOpen(true);
                              }}
                              aria-label={`Edit ${item.name}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setAssignItem(item);
                                setAssignDialogOpen(true);
                              }}
                              disabled={item.available_quantity === 0}
                              aria-label={`Assign ${item.name}`}
                            >
                              Assign
                            </Button>
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
                              {searchQuery
                                ? "Try adjusting your search criteria"
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
          onAssign={fetchInventoryItems}
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
            <AlertDialogCancel disabled={deleteInProgress}>Cancel</AlertDialogCancel>
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
              Are you sure you want to unassign {itemToUnassign?.name} from {itemToUnassign?.flat}?
              This will make all assigned items available again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unassignInProgress}>Cancel</AlertDialogCancel>
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
  );
}