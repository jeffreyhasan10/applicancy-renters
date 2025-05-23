import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Trash2,
  AlertTriangle,
  Package2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FurnitureItem {
  id: string;
  name: string;
  unit_rent: number;
  assigned_quantity: number;
  total_quantity: number;
  available_quantity: number;
}

interface InventoryItem {
  id: string;
  name: string;
  total_quantity: number;
  available_quantity: number;
  unit_rent: number;
}

interface Flat {
  id: string;
  monthly_rent_target: number;
}

interface FurnitureManagerProps {
  flatId: string;
  flatRent?: number;
  applianceRent?: number;
  onTotalRentChange?: (total: number) => void;
}

export default function FurnitureManager({
  flatId,
  flatRent = 0,
  applianceRent = 0,
  onTotalRentChange = () => {},
}: FurnitureManagerProps) {
  const [furniture, setFurniture] = useState<FurnitureItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [flat, setFlat] = useState<Flat | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false);
  const [itemToUnassign, setItemToUnassign] = useState<FurnitureItem | null>(null);
  const [roundoff, setRoundoff] = useState(0);
  const [assignFormData, setAssignFormData] = useState({
    inventory_item_id: "",
    quantity: 1,
    unit_rent: 0,
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const { toast } = useToast();

  // Fetch flat details
  const fetchFlat = async () => {
    try {
      const { data, error } = await supabase
        .from("flats")
        .select("id, monthly_rent_target")
        .eq("id", flatId)
        .single();

      if (error) throw error;
      setFlat(data);
    } catch (error: any) {
      toast({
        title: "Error fetching flat",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Fetch assigned furniture (from furniture_items where flat_id matches)
  const fetchFurniture = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("furniture_items")
        .select("id, name, unit_rent, total_quantity, available_quantity")
        .eq("flat_id", flatId)
        .eq("category", "Furniture")
        .eq("is_appliance", false);

      if (error) throw error;

      const formattedFurniture: FurnitureItem[] = (data || []).map((item) => ({
        id: item.id,
        name: item.name,
        unit_rent: parseFloat(item.unit_rent?.toString() || "0"),
        assigned_quantity: item.total_quantity - item.available_quantity,
        total_quantity: item.total_quantity,
        available_quantity: item.available_quantity,
      }));

      setFurniture(formattedFurniture);
    } catch (error: any) {
      toast({
        title: "Error fetching furniture",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch inventory items (unassigned or partially available)
  const fetchInventoryItems = async () => {
    try {
      const { data, error } = await supabase
        .from("furniture_items")
        .select("id, name, total_quantity, available_quantity, unit_rent")
        .eq("category", "Furniture")
        .eq("is_appliance", false)
        .or(`flat_id.is.null,available_quantity.gt.0`);

      if (error) throw error;
      setInventoryItems(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching inventory items",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchFlat();
    fetchFurniture();
    fetchInventoryItems();
  }, [flatId]);

  // Real-time subscriptions
  useEffect(() => {
    const subscription = supabase
      .channel("furniture_items_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "furniture_items", filter: "category=eq.Furniture" },
        () => {
          fetchFurniture();
          fetchInventoryItems();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Form validation for assigning furniture
  const validateAssignForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!assignFormData.inventory_item_id) newErrors.inventory_item_id = "Please select an inventory item";
    if (assignFormData.quantity < 1) newErrors.quantity = "Quantity must be at least 1";
    const selectedItem = inventoryItems.find((item) => item.id === assignFormData.inventory_item_id);
    if (selectedItem && assignFormData.quantity > selectedItem.available_quantity)
      newErrors.quantity = `Only ${selectedItem.available_quantity} available`;
    if (assignFormData.unit_rent < 0) newErrors.unit_rent = "Rent must be non-negative";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle assigning furniture to flat
  const handleAssignFurniture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAssignForm()) return;

    try {
      const selectedItem = inventoryItems.find((item) => item.id === assignFormData.inventory_item_id);
      if (!selectedItem) throw new Error("Selected inventory item not found");

      // Update furniture_items with flat_id and decrease available_quantity
      const { error } = await supabase
        .from("furniture_items")
        .update({
          flat_id: flatId,
          available_quantity: selectedItem.available_quantity - assignFormData.quantity,
          unit_rent: assignFormData.unit_rent,
        })
        .eq("id", selectedItem.id);

      if (error) throw error;

      toast({
        title: "Furniture assigned",
        description: `${assignFormData.quantity} ${selectedItem.name}(s) assigned to flat`,
      });

      setAssignDialogOpen(false);
      setAssignFormData({ inventory_item_id: "", quantity: 1, unit_rent: 0 });
      fetchFurniture();
      fetchInventoryItems();
    } catch (error: any) {
      toast({
        title: "Error assigning furniture",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Handle unassigning furniture from flat
  const handleUnassignFurniture = async () => {
    if (!itemToUnassign) return;

    try {
      // Update furniture_items to remove flat_id and increase available_quantity
      const { error } = await supabase
        .from("furniture_items")
        .update({
          flat_id: null,
          available_quantity: itemToUnassign.available_quantity + itemToUnassign.assigned_quantity,
        })
        .eq("id", itemToUnassign.id);

      if (error) throw error;

      toast({
        title: "Furniture unassigned",
        description: `${itemToUnassign.name} has been unassigned from flat`,
      });

      setUnassignDialogOpen(false);
      setItemToUnassign(null);
      fetchFurniture();
      fetchInventoryItems();
    } catch (error: any) {
      toast({
        title: "Error unassigning furniture",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Update rent for assigned furniture
  const handleUpdateRent = async (item: FurnitureItem, newRent: number) => {
    if (newRent < 0) {
      toast({
        title: "Invalid rent",
        description: "Rent must be non-negative",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("furniture_items")
        .update({ unit_rent: newRent })
        .eq("id", item.id);

      if (error) throw error;

      toast({
        title: "Rent updated",
        description: `Rent for ${item.name} updated to ₹${newRent}`,
      });

      fetchFurniture();
    } catch (error: any) {
      toast({
        title: "Error updating rent",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Calculate total rent
  const totalRent = useMemo(() => {
    const furnitureTotal = furniture.reduce((sum, f) => sum + f.unit_rent * f.assigned_quantity, 0);
    return furnitureTotal + applianceRent + roundoff;
  }, [furniture, applianceRent, roundoff]);

  // Validate total rent against flat rent
  const rentMatchesFlat = useMemo(() => {
    return flatRent === 0 || totalRent === flatRent;
  }, [totalRent, flatRent]);

  useEffect(() => {
    onTotalRentChange(totalRent);
  }, [totalRent, onTotalRentChange]);

  return (
    <TooltipProvider>
      <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Furniture (Connected with Inventory)
          </h1>
          <Button
            onClick={() => setAssignDialogOpen(true)}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 shadow-sm"
          >
            <Plus className="h-5 w-5 mr-2" />
            Assign Furniture
          </Button>
        </div>

        <Card className="shadow-sm border border-gray-100 bg-white rounded-lg">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="text-xl font-semibold text-gray-800">Assigned Furniture</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-gray-700">Name</TableHead>
                    <TableHead className="text-gray-700">Rent (₹)</TableHead>
                    <TableHead className="text-gray-700">Quantity</TableHead>
                    <TableHead className="text-right text-gray-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
                      </TableCell>
                    </TableRow>
                  ) : furniture.length > 0 ? (
                    furniture.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-gray-900">{item.name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.unit_rent}
                            onChange={(e) => handleUpdateRent(item, parseFloat(e.target.value) || 0)}
                            className="w-24 border-gray-200 focus:ring-blue-500"
                            min="0"
                          />
                        </TableCell>
                        <TableCell>{item.assigned_quantity}</TableCell>
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-800"
                                onClick={() => {
                                  setItemToUnassign(item);
                                  setUnassignDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Unassign Furniture</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10">
                        <div className="flex flex-col items-center">
                          <Package2 className="h-10 w-10 text-gray-300 mb-2" />
                          <h3 className="text-lg font-medium text-gray-900">No furniture assigned</h3>
                          <p className="text-gray-500 mt-1">Assign furniture from inventory to get started</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-4">
                <Label htmlFor="roundoff" className="text-gray-700 font-medium">Roundoff Amount (₹)</Label>
                <Input
                  id="roundoff"
                  type="number"
                  value={roundoff}
                  onChange={(e) => setRoundoff(Number(e.target.value) || 0)}
                  className="w-32 border-gray-200 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <p className="text-lg font-semibold text-gray-800">
                  Total Rent: ₹{totalRent.toLocaleString()}
                </p>
                {!rentMatchesFlat && flatRent > 0 && (
                  <p className="text-sm text-red-600 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Total does not match flat rent (₹{flatRent.toLocaleString()})
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assign Furniture Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="sm:max-w-[500px] bg-white rounded-lg shadow-xl p-6 border border-gray-100">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-gray-900">Assign Furniture</DialogTitle>
              <DialogDescription className="text-gray-600">
                Select a furniture item from inventory to assign to this flat.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignFurniture} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inventory_item_id" className="text-gray-700 font-medium">Inventory Item</Label>
                <Select
                  value={assignFormData.inventory_item_id}
                  onValueChange={(value) => {
                    const selectedItem = inventoryItems.find((item) => item.id === value);
                    setAssignFormData({
                      ...assignFormData,
                      inventory_item_id: value,
                      unit_rent: selectedItem?.unit_rent || 0,
                    });
                  }}
                >
                  <SelectTrigger className={errors.inventory_item_id ? "border-red-500" : "border-gray-200 focus:ring-blue-500"}>
                    <SelectValue placeholder="Select inventory item" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryItems.map((item) => (
                      <SelectItem key={item.id} value={item.id} disabled={item.available_quantity === 0}>
                        {item.name} (Available: {item.available_quantity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.inventory_item_id && (
                  <p className="text-sm text-red-500">{errors.inventory_item_id}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-gray-700 font-medium">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={assignFormData.quantity}
                  onChange={(e) =>
                    setAssignFormData({ ...assignFormData, quantity: parseInt(e.target.value) || 1 })
                  }
                  min="1"
                  className={errors.quantity ? "border-red-500" : "border-gray-200 focus:ring-blue-500"}
                />
                {errors.quantity && <p className="text-sm text-red-500">{errors.quantity}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit_rent" className="text-gray-700 font-medium">Rent per Item (₹)</Label>
                <Input
                  id="unit_rent"
                  type="number"
                  value={assignFormData.unit_rent}
                  onChange={(e) =>
                    setAssignFormData({ ...assignFormData, unit_rent: parseFloat(e.target.value) || 0 })
                  }
                  min="0"
                  className={errors.unit_rent ? "border-red-500" : "border-gray-200 focus:ring-blue-500"}
                />
                {errors.unit_rent && <p className="text-sm text-red-500">{errors.unit_rent}</p>}
              </div>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-200 hover:bg-gray-100 text-gray-700"
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200"
                >
                  Assign
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Unassign Confirmation Dialog */}
        <AlertDialog open={unassignDialogOpen} onOpenChange={setUnassignDialogOpen}>
          <AlertDialogContent className="bg-white border border-gray-100 rounded-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-gray-900">Unassign Furniture</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600">
                Are you sure you want to unassign {itemToUnassign?.name}? This will return {itemToUnassign?.assigned_quantity} item(s) to inventory.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-gray-200 hover:bg-gray-100 text-gray-700">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleUnassignFurniture}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Unassign
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}