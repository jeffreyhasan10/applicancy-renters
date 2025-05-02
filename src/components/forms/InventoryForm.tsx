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
import { Loader2 } from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  condition: "used" | "new" | "damaged";
  flat_id: string | null;
  flat_name: string | null;
  purchase_date: string;
  purchase_price: number;
  unit_rent: number;
  total_quantity: number;
  available_quantity: number;
  is_appliance: boolean;
}

interface Flat {
  id: string;
  name: string;
}

interface InventoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemAdded: () => void;
  initialItem?: InventoryItem;
  isEditMode: boolean;
}

const PRESET_ITEMS = [
  { name: "Bed", category: "Furniture" },
  { name: "TV", category: "Electronics" },
  { name: "Sofa", category: "Furniture" },
  { name: "Table", category: "Furniture" },
  { name: "Chair", category: "Furniture" },
  { name: "Fridge", category: "Appliance" },
];

export default function InventoryForm({
  open,
  onOpenChange,
  onItemAdded,
  initialItem,
  isEditMode = false,
}: InventoryFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Omit<InventoryItem, 'id'>>({
    name: initialItem?.name || "",
    category: initialItem?.category || "Furniture",
    condition: initialItem?.condition || "new",
    flat_id: initialItem?.flat_id || null,
    flat_name: initialItem?.flat_name || null,
    purchase_date: initialItem?.purchase_date || new Date().toISOString().split('T')[0],
    purchase_price: initialItem?.purchase_price || 0,
    unit_rent: initialItem?.unit_rent || 0,
    total_quantity: initialItem?.total_quantity || 1,
    available_quantity: initialItem?.available_quantity || 1,
    is_appliance: initialItem?.is_appliance || false,
  });
  const [flats, setFlats] = useState<Flat[]>([]);
  const [loadingFlats, setLoadingFlats] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingItem, setExistingItem] = useState<InventoryItem | null>(null);

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

  useEffect(() => {
    if (formData.name && formData.condition) {
      checkForExistingItem();
    } else {
      setExistingItem(null);
    }
  }, [formData.name, formData.category, formData.condition, formData.flat_id]);

  const checkForExistingItem = async () => {
    try {
      const query = supabase
        .from("furniture_items")
        .select("*")
        .eq("name", formData.name)
        .eq("category", formData.category)
        .eq("condition", formData.condition);
      
      if (formData.flat_id) {
        query.eq("flat_id", formData.flat_id);
      } else {
        query.is("flat_id", null);
      }
  
      // Get all matching items (should be just one, but handle multiple just in case)
      const { data, error } = await query;
  
      if (error && error.code !== "PGRST116") throw error;
      // Just take the first match if there are multiple
      setExistingItem(data?.[0] || null);
    } catch (error: any) {
      console.error("Error checking for existing item:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (isEditMode && initialItem) {
        // Update existing item
        const { error } = await supabase
          .from("furniture_items")
          .update({
            name: formData.name,
            category: formData.category,
            condition: formData.condition,
            flat_id: formData.flat_id,
            purchase_date: formData.purchase_date,
            purchase_price: formData.purchase_price,
            unit_rent: formData.unit_rent,
            total_quantity: formData.total_quantity,
            available_quantity: formData.available_quantity,
            is_appliance: formData.is_appliance,
          })
          .eq("id", initialItem.id);

        if (error) throw error;
        toast({
          title: "Item updated",
          description: `${formData.name} has been updated`,
        });
      } else if (existingItem) {
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
          category: formData.category,
          condition: formData.condition,
          flat_id: formData.flat_id,
          purchase_date: formData.purchase_date,
          purchase_price: formData.purchase_price,
          unit_rent: formData.unit_rent,
          total_quantity: formData.total_quantity,
          available_quantity: formData.total_quantity,
          is_appliance: formData.is_appliance,
        });

        if (error) {
          // Handle potential race condition where item was created between our check and insert
          if (error.code === "23505") {
            // Duplicate key error - item already exists
            // Fetch the existing item and update its quantity
            const query = supabase
              .from("furniture_items")
              .select("*")
              .eq("name", formData.name)
              .eq("category", formData.category)
              .eq("condition", formData.condition);
            
            if (formData.flat_id) {
              query.eq("flat_id", formData.flat_id);
            } else {
              query.is("flat_id", null);
            }
            
            const { data: existingItem, error: fetchError } = await query.single();
            
            if (fetchError) throw fetchError;
            
            const newTotalQuantity = existingItem.total_quantity + formData.total_quantity;
            const newAvailableQuantity = existingItem.available_quantity + formData.total_quantity;
            
            const { error: updateError } = await supabase
              .from("furniture_items")
              .update({
                total_quantity: newTotalQuantity,
                available_quantity: newAvailableQuantity,
                purchase_date: formData.purchase_date,
                purchase_price: formData.purchase_price,
                unit_rent: formData.unit_rent,
              })
              .eq("id", existingItem.id);
              
            if (updateError) throw updateError;
            
            toast({
              title: "Item quantity updated",
              description: `Added ${formData.total_quantity} more ${formData.name}(s) to inventory`,
            });
          } else {
            throw error;
          }
        } else {
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "purchase_price" || name === "unit_rent"
          ? parseFloat(value) || 0
          : name === "total_quantity" || name === "available_quantity"
          ? parseInt(value) || 1
          : value,
    }));
  };

  const handleFlatSelection = (flatId: string) => {
    if (!flatId) {
      setFormData((prev) => ({
        ...prev,
        flat_id: null,
        flat_name: null,
      }));
      return;
    }

    const selectedFlat = flats.find((flat) => flat.id === flatId);
    if (selectedFlat) {
      setFormData((prev) => ({
        ...prev,
        flat_id: selectedFlat.id,
        flat_name: selectedFlat.name,
      }));
    }
  };

  const handlePresetItem = (item: { name: string; category: string }) => {
    setFormData((prev) => ({
      ...prev,
      name: item.name,
      category: item.category,
      is_appliance: item.category === "Appliance",
    }));
  };

  const validateForm = () => {
    if (!formData.name) {
      toast({
        title: "Error",
        description: "Please enter an item name",
        variant: "destructive",
      });
      return false;
    }
    if (!formData.category) {
      toast({
        title: "Error",
        description: "Please select a category",
        variant: "destructive",
      });
      return false;
    }
    if (formData.total_quantity < 1) {
      toast({
        title: "Error",
        description: "Quantity must be at least 1",
        variant: "destructive",
      });
      return false;
    }
    if (formData.purchase_price < 0) {
      toast({
        title: "Error",
        description: "Purchase price must be positive",
        variant: "destructive",
      });
      return false;
    }
    if (formData.unit_rent < 0) {
      toast({
        title: "Error",
        description: "Unit rent must be positive",
        variant: "destructive",
      });
      return false;
    }
    return true;
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
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    category: value,
                    is_appliance: value === "Appliance"
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Furniture">Furniture</SelectItem>
                    <SelectItem value="Appliance">Appliance</SelectItem>
                    <SelectItem value="Electronics">Electronics</SelectItem>
                  </SelectContent>
                </Select>
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
                <Label htmlFor="purchase_price">Purchase Price (₹)</Label>
                <Input
                  id="purchase_price"
                  name="purchase_price"
                  type="number"
                  value={formData.purchase_price}
                  onChange={handleChange}
                  placeholder="Enter purchase price"
                  min="0"
                  step="0.01"
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
                  step="0.01"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchase_date">Purchase Date</Label>
                <Input
                  id="purchase_date"
                  name="purchase_date"
                  type="date"
                  value={formData.purchase_date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Select
                  value={formData.condition}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    condition: value as "new" | "used" | "damaged"
                  }))}
                >
                  <SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue placeholder={loadingFlats ? "Loading flats..." : "Select flat"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {flats.map((flat) => (
                      <SelectItem key={flat.id} value={flat.id}>
                        {flat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {existingItem && !isEditMode && (
                <div className="col-span-2 p-3 bg-blue-50 rounded-md">
                  <p className="text-sm text-blue-700">
                    Existing item found: {existingItem.name} (Quantity: {existingItem.total_quantity})
                  </p>
                  <p className="text-sm text-blue-700">
                    Adding {formData.total_quantity} more will update the total to {existingItem.total_quantity + formData.total_quantity}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting || loadingFlats}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEditMode ? (
                "Update Item"
              ) : existingItem ? (
                "Add More"
              ) : (
                "Add Item"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}