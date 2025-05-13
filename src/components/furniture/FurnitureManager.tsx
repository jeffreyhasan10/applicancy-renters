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
import { format } from "date-fns";

// Add retry utility at the top of the file after imports
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryWithBackoff = async <T,>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let retries = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      if (error?.code === "over_request_rate_limit" && retries < maxRetries) {
        retries++;
        const delay = baseDelay * Math.pow(2, retries - 1);
        await wait(delay);
        continue;
      }
      throw error;
    }
  }
};

interface FurnitureItem {
  id: string;
  name: string;
  unit_rent: number;
  assigned_quantity: number;
  total_quantity: number;
  available_quantity: number;
  calendar_event_id?: string;
  event_start_date?: string;
  event_end_date?: string;
  flat_id?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  total_quantity: number;
  available_quantity: number;
  unit_rent: number;
  is_appliance: boolean;
  flat_id?: string;
  category?: string;
  condition?: string;
  purchase_date?: string;
  purchase_price?: number;
}

interface Flat {
  id: string;
  monthly_rent_target: number;
}

interface FurnitureDataItem {
  id: any;
  name: any;
  unit_rent: any;
  total_quantity: any;
  available_quantity: any;
  category: any;
  is_appliance: any;
  flat_id: string | null;
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
  const [roundoff, setRoundoff] = useState<number>(0);
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
      const { data, error } = await retryWithBackoff(async () => {
        return await supabase
          .from("flats")
          .select("id, monthly_rent_target")
          .eq("id", flatId)
          .single();
      });

      if (error) throw error;
      setFlat(data);
    } catch (error: any) {
      toast({
        title: "Error fetching flat",
        description: error.code === "over_request_rate_limit" 
          ? "Too many requests. Please try again in a moment." 
          : error.message,
        variant: "destructive",
      });
    }
  };

  // Fetch assigned furniture and associated calendar events
  const fetchFurniture = async () => {
    try {
      setLoading(true);
      // Fetch furniture items assigned to the flat with retry
      const { data: furnitureData, error: furnitureError } = await retryWithBackoff(async () => {
        return await supabase
          .from("furniture_items")
          .select("id, name, unit_rent, total_quantity, available_quantity, category, is_appliance, flat_id")
          .eq("flat_id", flatId);
      });

      if (furnitureError) throw furnitureError;

      // Fetch associated calendar events with retry
      const furnitureIds = (furnitureData as FurnitureDataItem[]).map((item) => item.id);
      const { data: eventsData, error: eventsError } = await retryWithBackoff(async () => {
        return await supabase
          .from("calendar_events")
          .select("id, related_id, start_date, end_date")
          .eq("related_table", "furniture_items")
          .in("related_id", furnitureIds);
      });

      if (eventsError) throw eventsError;

      // Map furniture items with their calendar events
      const formattedFurniture: FurnitureItem[] = (furnitureData as FurnitureDataItem[]).map((item) => {
        const event = eventsData.find((e) => e.related_id === item.id);
        return {
          id: item.id,
          name: item.name,
          unit_rent: parseFloat(item.unit_rent?.toString() || "0"),
          assigned_quantity: item.total_quantity - item.available_quantity,
          total_quantity: item.total_quantity,
          available_quantity: item.available_quantity,
          calendar_event_id: event?.id,
          event_start_date: event?.start_date,
          event_end_date: event?.end_date,
          flat_id: item.flat_id
        };
      });

      setFurniture(formattedFurniture);
    } catch (error: any) {
      toast({
        title: "Error fetching furniture",
        description: error.code === "over_request_rate_limit" 
          ? "Too many requests. Please try again in a moment." 
          : error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch inventory items (unassigned or partially available)
  const fetchInventoryItems = async () => {
    try {
      const { data, error } = await retryWithBackoff(async () => {
        return await supabase
          .from("furniture_items")
          .select(`
            id,
            name,
            total_quantity,
            available_quantity,
            unit_rent,
            is_appliance,
            flat_id,
            category,
            condition,
            purchase_date,
            purchase_price
          `)
          .or(`flat_id.is.null,available_quantity.gt.0`);
      });

      if (error) throw error;
      const mappedItems: InventoryItem[] = (data || []).map(item => ({
        ...item,
        flat_id: item.flat_id
      }));
      setInventoryItems(mappedItems);
    } catch (error: any) {
      toast({
        title: "Error fetching inventory items",
        description: error.code === "over_request_rate_limit" 
          ? "Too many requests. Please try again in a moment." 
          : error.message,
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events", filter: "related_table=eq.furniture_items" },
        () => fetchFurniture()
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
    
    if (selectedItem) {
      if (assignFormData.quantity > selectedItem.available_quantity) {
        newErrors.quantity = `Only ${selectedItem.available_quantity} available`;
      }
    }
    
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

      // Check if we're trying to assign more than available
      if (assignFormData.quantity > selectedItem.available_quantity) {
        toast({
          title: "Assignment Error",
          description: `Cannot assign more than ${selectedItem.available_quantity} items`,
          variant: "destructive",
        });
        return;
      }

      // If the item is already assigned to this flat, update the assignment
      if (selectedItem.flat_id === flatId) {
        const { error: updateError } = await retryWithBackoff(async () => {
          return await supabase
            .from("furniture_items")
            .update({
              available_quantity: selectedItem.available_quantity - assignFormData.quantity,
              unit_rent: assignFormData.unit_rent
            })
            .eq("id", selectedItem.id);
        });

        if (updateError) throw updateError;
      } else {
        // If the item has available quantity, create a new assignment
        // First, reduce the quantity from the original item
        const { error: updateOriginalError } = await retryWithBackoff(async () => {
          return await supabase
            .from("furniture_items")
            .update({
              available_quantity: selectedItem.available_quantity - assignFormData.quantity
            })
            .eq("id", selectedItem.id);
        });

        if (updateOriginalError) throw updateOriginalError;

        // Then create a new furniture item for this flat with the assigned quantity
        const newFurnitureItem = {
          name: selectedItem.name,
          category: selectedItem.category || "Furniture",
          is_appliance: selectedItem.is_appliance,
          unit_rent: assignFormData.unit_rent,
          total_quantity: assignFormData.quantity,
          available_quantity: 0, // All items are assigned
          flat_id: flatId,
          condition: selectedItem.condition || "used",
          purchase_date: selectedItem.purchase_date || new Date().toISOString(),
          purchase_price: selectedItem.purchase_price || 0
        };

        const { error: createError } = await retryWithBackoff(async () => {
          return await supabase
            .from("furniture_items")
            .insert([newFurnitureItem]);
        });

        if (createError) throw createError;
      }

      // Create a calendar event for the assignment with retry
      const calendarEvent = {
        title: `${selectedItem.name} assigned to flat`,
        start_date: new Date().toISOString(),
        related_table: "furniture_items",
        related_id: selectedItem.id,
        flat_id: flatId,
      };

      const { error: calendarError } = await retryWithBackoff(async () => {
        return await supabase
          .from("calendar_events")
          .insert([calendarEvent]);
      });

      if (calendarError) throw calendarError;

      toast({
        title: "Success",
        description: "Furniture item assigned successfully",
      });

      setAssignDialogOpen(false);
      setAssignFormData({
        inventory_item_id: "",
        quantity: 1,
        unit_rent: 0,
      });
      fetchFurniture();
      fetchInventoryItems();
    } catch (error: any) {
      toast({
        title: "Error assigning furniture",
        description: error.code === "over_request_rate_limit" 
          ? "Too many requests. Please try again in a moment." 
          : error.message,
        variant: "destructive",
      });
    }
  };

  // Handle unassigning furniture from flat
  const handleUnassignFurniture = async () => {
    if (!itemToUnassign) return;

    try {
      // Update the furniture item to remove flat assignment with retry
      const { error: updateError } = await retryWithBackoff(async () => {
        return await supabase
          .from("furniture_items")
          .update({
            flat_id: null,
            available_quantity: itemToUnassign.total_quantity
          })
          .eq("id", itemToUnassign.id);
      });

      if (updateError) throw updateError;

      // Delete associated calendar event if it exists with retry
      if (itemToUnassign.calendar_event_id) {
        const { error: deleteError } = await retryWithBackoff(async () => {
          return await supabase
            .from("calendar_events")
            .delete()
            .eq("id", itemToUnassign.calendar_event_id);
        });

        if (deleteError) throw deleteError;
      }

      toast({
        title: "Success",
        description: "Furniture item unassigned successfully",
      });

      setUnassignDialogOpen(false);
      setItemToUnassign(null);
      fetchFurniture();
      fetchInventoryItems();
    } catch (error: any) {
      toast({
        title: "Error unassigning furniture",
        description: error.code === "over_request_rate_limit" 
          ? "Too many requests. Please try again in a moment." 
          : error.message,
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
      const { error } = await retryWithBackoff(async () => {
        return await supabase
          .from("furniture_items")
          .update({ unit_rent: newRent })
          .eq("id", item.id);
      });

      if (error) throw error;

      toast({
        title: "Rent updated",
        description: `Rent for ${item.name} updated to ₹${newRent}`,
      });

      fetchFurniture();
    } catch (error: any) {
      toast({
        title: "Error updating rent",
        description: error.code === "over_request_rate_limit" 
          ? "Too many requests. Please try again in a moment." 
          : error.message,
        variant: "destructive",
      });
    }
  };

  // Calculate total rent
  const totalRent = useMemo(() => {
    // Calculate furniture rent
    const furnitureTotal = furniture.reduce((sum, f) => {
      const rentPerItem = parseFloat(f.unit_rent?.toString() || "0");
      const quantity = f.assigned_quantity || 0;
      return sum + (rentPerItem * quantity);
    }, 0);

    // Add appliance rent
    const baseTotal = furnitureTotal + (applianceRent || 0);
    
    // Add roundoff (can be positive or negative)
    const withRoundoff = baseTotal + roundoff;

    // Round to nearest whole number and ensure non-negative
    return Math.max(0, Math.round(withRoundoff));
  }, [furniture, applianceRent, roundoff]);

  // Validate total rent against flat rent
  const rentMatchesFlat = useMemo(() => {
    return flatRent === 0 || totalRent === flatRent;
  }, [totalRent, flatRent]);

  useEffect(() => {
    onTotalRentChange(totalRent);
  }, [totalRent, onTotalRentChange]);

  // Add a function to calculate automatic roundoff
  const calculateAutoRoundoff = () => {
    // Calculate base total without roundoff
    const furnitureTotal = furniture.reduce((sum, f) => {
      const rentPerItem = parseFloat(f.unit_rent?.toString() || "0");
      const quantity = f.assigned_quantity || 0;
      return sum + (rentPerItem * quantity);
    }, 0);
    
    const baseTotal = furnitureTotal + (applianceRent || 0);
    
    if (flatRent > 0) {
      // If flat rent is set, calculate exact roundoff needed
      const requiredRoundoff = flatRent - baseTotal;
      setRoundoff(Math.round(requiredRoundoff));
    } else {
      // Round to nearest 100
      const roundedAmount = Math.ceil(baseTotal / 100) * 100;
      const requiredRoundoff = roundedAmount - baseTotal;
      setRoundoff(Math.round(requiredRoundoff));
    }
  };

  // Add a function to handle roundoff changes
  const handleRoundoffChange = (value: string) => {
    // Convert empty string to 0
    if (value === "" || value === "-") {
      setRoundoff(0);
      return;
    }

    // Parse the value as a number
    const numValue = parseFloat(value);
    
    // Check if it's a valid number
    if (!isNaN(numValue)) {
      // Round to whole number
      setRoundoff(Math.round(numValue));
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 p-6 bg-luxury-pearl min-h-screen">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold text-luxury-charcoal tracking-tight">
            Furniture Management
          </h1>
          <Button
            onClick={() => setAssignDialogOpen(true)}
            className="w-full sm:w-auto bg-luxury-gold hover:bg-luxury-gold/90 text-luxury-charcoal transition-all duration-200 shadow-gold"
          >
            <Plus className="h-5 w-5 mr-2" />
            Assign Furniture
          </Button>
        </div>

        <Card className="shadow-luxury border-luxury-gold/20 bg-white rounded-lg">
          <CardHeader className="border-b border-luxury-gold/20">
            <CardTitle className="text-xl font-semibold text-luxury-charcoal">Assigned Furniture</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-luxury-gold/20">
                    <TableHead className="text-luxury-charcoal">Name</TableHead>
                    <TableHead className="text-luxury-charcoal">Rent (₹)</TableHead>
                    <TableHead className="text-luxury-charcoal">Quantity</TableHead>
                    <TableHead className="text-luxury-charcoal">Event Start</TableHead>
                    <TableHead className="text-right text-luxury-charcoal">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-luxury-gold mx-auto"></div>
                      </TableCell>
                    </TableRow>
                  ) : furniture.length > 0 ? (
                    furniture.map((item) => (
                      <TableRow key={item.id} className="hover:bg-luxury-pearl/50 transition-colors">
                        <TableCell className="font-medium text-luxury-charcoal">{item.name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.unit_rent}
                            onChange={(e) => handleUpdateRent(item, parseFloat(e.target.value) || 0)}
                            className="w-24 border-luxury-gold/20 focus:ring-luxury-gold focus:border-luxury-gold"
                            min="0"
                          />
                        </TableCell>
                        <TableCell>{item.assigned_quantity}</TableCell>
                        <TableCell>
                          {item.event_start_date
                            ? format(new Date(item.event_start_date), "MMM d, yyyy")
                            : "-"}
                        </TableCell>
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
                      <TableCell colSpan={5} className="text-center py-10">
                        <div className="flex flex-col items-center">
                          <Package2 className="h-10 w-10 text-luxury-gold mb-2" />
                          <h3 className="text-lg font-medium text-luxury-charcoal">No furniture assigned</h3>
                          <p className="text-luxury-slate mt-1">Assign furniture from inventory to get started</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-4">
                <Label htmlFor="roundoff" className="text-luxury-charcoal font-medium">
                  Roundoff Amount (₹)
                </Label>
                <Input
                  id="roundoff"
                  type="number"
                  value={roundoff}
                  onChange={(e) => handleRoundoffChange(e.target.value)}
                  className="w-32 border-luxury-gold/20 focus:ring-luxury-gold focus:border-luxury-gold"
                  placeholder="0"
                  step="0.01" // Allow decimal values
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRoundoff(0)}
                        className="h-8 px-2 text-gray-500 hover:text-gray-700"
                      >
                        Reset
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset roundoff to 0</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={calculateAutoRoundoff}
                        className="h-8 px-2 text-luxury-gold hover:text-luxury-gold/80"
                      >
                        Auto
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Automatically calculate roundoff</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-gray-600">
                    Furniture Rent: ₹{furniture.reduce((sum, f) => sum + (f.unit_rent * f.assigned_quantity), 0).toLocaleString()}
                  </p>
                  {applianceRent > 0 && (
                    <p className="text-sm text-gray-600">
                      Appliance Rent: ₹{applianceRent.toLocaleString()}
                    </p>
                  )}
                  {roundoff !== 0 && (
                    <p className="text-sm text-gray-600">
                      Roundoff: {roundoff > 0 ? '+' : ''}{roundoff.toLocaleString()}
                    </p>
                  )}
                  <p className="text-lg font-semibold text-luxury-charcoal">
                    Total Rent: ₹{totalRent.toLocaleString()}
                  </p>
                </div>
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
          <DialogContent className="sm:max-w-[500px] bg-white rounded-lg shadow-luxury p-6 border border-luxury-gold/20">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-luxury-charcoal">Assign Furniture</DialogTitle>
              <DialogDescription className="text-luxury-slate">
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
                    <div className="flex items-center px-3 pb-2">
                      <Input
                        type="text"
                        placeholder="Search items..."
                        className="h-8"
                        onChange={(e) => {
                          const searchValue = e.target.value.toLowerCase();
                          const items = document.querySelectorAll('[data-select-item]');
                          items.forEach((item) => {
                            const text = item.textContent?.toLowerCase() || '';
                            if (text.includes(searchValue)) {
                              (item as HTMLElement).style.display = '';
                            } else {
                              (item as HTMLElement).style.display = 'none';
                            }
                          });
                        }}
                      />
                    </div>
                    {inventoryItems.map((item) => (
                      <SelectItem key={item.id} value={item.id} disabled={item.available_quantity === 0} data-select-item>
                        {item.name} ({item.is_appliance ? 'Appliance' : 'Furniture'}) (Available: {item.available_quantity})
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
                  value={assignFormData.quantity || ""}
                  onChange={(e) => {
                    const value = e.target.value === "" ? 0 : parseInt(e.target.value);
                    setAssignFormData({ ...assignFormData, quantity: value });
                  }}
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
                  value={assignFormData.unit_rent || ""}
                  onChange={(e) => {
                    const value = e.target.value === "" ? 0 : parseFloat(e.target.value);
                    setAssignFormData({ ...assignFormData, unit_rent: value });
                  }}
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
          <AlertDialogContent className="bg-white border border-luxury-gold/20 rounded-lg shadow-luxury">
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