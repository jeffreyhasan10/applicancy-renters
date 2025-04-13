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

// Define the inventory item type
interface InventoryItem {
  id: string; // UUID
  name: string;
  category: string;
  condition: "used" | "new" | "damaged";
  location: string;
  assigned: boolean;
  tenant: string | null;
  flat: string | null;
  flat_id: string | null; // UUID
  purchaseDate: string;
  purchasePrice: number;
  unit_rent: number;
  total_quantity?: number;
  available_quantity?: number;
}

// Define flat type for fetching flats
interface Flat {
  id: string; // UUID
  name: string;
}

interface InventoryFormProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onItemAdded?: () => void;
}

export default function InventoryForm({
  open,
  onOpenChange,
  onItemAdded,
}: InventoryFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
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
  const [flats, setFlats] = useState<Flat[]>([]);
  const [loadingFlats, setLoadingFlats] = useState(false);

  // Fetch flats for the dropdown
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
      if (!formData.flat_id) {
        throw new Error("Please select a flat");
      }
      if (!formData.condition) {
        throw new Error("Please select a condition");
      }
      if (formData.unit_rent === undefined || formData.unit_rent === null) {
        throw new Error("Please enter a unit rent value");
      }

      const { data, error } = await supabase.from("furniture_items").insert({
        name: formData.name,
        condition: formData.condition,
        purchase_date: formData.purchaseDate,
        purchase_price: formData.purchasePrice,
        flat_id: formData.flat_id,
        unit_rent: formData.unit_rent,
        total_quantity: formData.total_quantity,
        available_quantity: formData.available_quantity,
      }).select();

      if (error) throw error;

      toast({
        title: "Item added",
        description: "The inventory item has been successfully added",
      });

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

      if (onOpenChange) onOpenChange(false);
      if (onItemAdded) onItemAdded();
    } catch (error: any) {
      toast({
        title: "Error adding item",
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
        name === "purchasePrice" || name === "total_quantity" || name === "unit_rent"
          ? parseFloat(value) || 0
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

  const getSelectedFlatInfo = () => {
    if (!formData.flat_id) return "No flat selected";
    const flatName = formData.flat || "Unknown flat";
    return `${flatName} (ID: ${formData.flat_id})`;
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-6">
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
            className="w-full"
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
            className="w-full"
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
            className="w-full"
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
            className="w-full"
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
            className="w-full"
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
            className="w-full"
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
            <SelectTrigger id="condition" className="w-full">
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
            <SelectTrigger id="flat_id" className="w-full">
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

      <div className="flex justify-end gap-3 pt-4">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={loadingFlats || !formData.flat_id}>
          Add Item
        </Button>
      </div>
    </form>
  );

  if (open !== undefined && onOpenChange) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[90vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-lg p-6">
          <DialogHeader>
            <DialogTitle className="text-xl">Add Inventory Item</DialogTitle>
            <DialogDescription className="text-gray-600">
              Enter the details for the new inventory item.
            </DialogDescription>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
    );
  }

  return <div className="max-w-3xl mx-auto p-6">{formContent}</div>;
}