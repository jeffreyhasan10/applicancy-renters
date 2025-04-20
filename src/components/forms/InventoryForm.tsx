// InventoryForm.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  condition: "used" | "new" | "damaged";
  flat_id: string | null;
  flat: string | null;
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

interface InventoryFormProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onItemAdded?: () => void;
  initialItem?: Partial<InventoryItem>;
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

export default function InventoryForm({
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
      if (!formData.condition) throw new Error("Please select a condition");
      if (formData.unit_rent === undefined || formData.unit_rent === null)
        throw new Error("Please enter a unit rent value");
      if (formData.total_quantity! < 1)
        throw new Error("Quantity must be at least 1");

      const itemData = {
        name: formData.name,
        category: formData.category,
        condition: formData.condition,
        purchase_date: formData.purchaseDate || new Date().toISOString().split("T")[0],
        purchase_price: formData.purchasePrice,
        flat_id: formData.flat_id,
        unit_rent: formData.unit_rent,
        total_quantity: formData.total_quantity,
        available_quantity: formData.total_quantity,
      };

      let data, error;
      if (isEditMode && initialItem?.id) {
        // Check if quantity change affects tenant_furniture assignments
        const { data: assignments, error: assignError } = await supabase
          .from("tenant_furniture")
          .select("assigned_quantity")
          .eq("furniture_item_id", initialItem.id);
        if (assignError) throw assignError;

        const assignedTotal = assignments.reduce(
          (sum, a) => sum + a.assigned_quantity,
          0
        );
        const newTotal = formData.total_quantity!;
        const newAvailable = newTotal - assignedTotal;
        if (newAvailable < 0) {
          throw new Error(
            `Cannot reduce quantity below assigned amount (${assignedTotal})`
          );
        }

        ({ data, error } = await supabase
          .from("furniture_items")
          .update({ ...itemData, available_quantity: newAvailable })
          .eq("id", initialItem.id)
          .select());
      } else {
        ({ data, error } = await supabase
          .from("furniture_items")
          .insert(itemData)
          .select());
      }

      if (error) throw error;

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

      if (onOpenChange) onOpenChange(false);
      if (onItemAdded) onItemAdded();
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
          : name === "total_quantity"
          ? parseInt(value) || 1
          : value,
    }));
  };

  const handleFlatSelection = (flatId: string) => {
    if (!flatId) {
      setFormData((prev) => ({
        ...prev,
        flat_id: null,
        flat: null,
      }));
      return;
    }

    const selectedFlat = flats.find((flat) => flat.id === flatId);
    if (selectedFlat) {
      setFormData((prev) => ({
        ...prev,
        flat_id: selectedFlat.id,
        flat: selectedFlat.name,
      }));
    }
  };

  const handlePresetItem = (item: { name: string; category: string }) => {
    setFormData((prev) => ({
      ...prev,
      name: item.name,
      category: item.category,
    }));
  };

  const getSelectedFlatInfo = () => {
    if (!formData.flat_id) return "No flat selected";
    const flatName = formData.flat || "Unknown flat";
    return `${flatName} (ID: ${formData.flat_id})`;
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_quantity">Quantity</Label>
                <Input
                  id="total_quantity"
                  name="total_quantity"
                  type="number"
                  value={formData.total_quantity}
                  onChange={handleChange}
                  min="1"
                  required
                />
              </div>

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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Select
                  value={formData.condition || ""}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      condition: value as "used" | "new" | "damaged",
                    }))
                  }
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
                  <SelectContent className="max-h-[200px] overflow-y-auto">
                    {flats.length > 0 ? (
                      flats.map((flat) => (
                        <SelectItem key={flat.id} value={flat.id}>
                          {flat.name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-sm text-gray-500">
                        No flats available
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <div className="mt-1 text-xs text-gray-500 truncate">
                  Current selection: {getSelectedFlatInfo()}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
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