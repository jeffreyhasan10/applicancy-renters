import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Trash2,
  Edit,
  Package2,
  AlertTriangle,
  Unlink,
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
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface ApplianceItem {
  id: string;
  name: string;
  unit_rent: number;
  category: string;
  condition: "new" | "used" | "damaged";
  purchase_date: string;
  purchase_price: number;
  total_quantity: number;
  available_quantity: number;
  flat_id: string;
  flat_name?: string;
}

interface AssignedAppliance {
  id: string;
  furniture_item_id: string;
  name: string;
  category: string;
  assigned_quantity: number;
  condition: string;
  purchase_date: string;
  purchase_price: number;
  rent_part: number;
  tenant_id: string;
  tenant_name?: string;
}

interface Flat {
  id: string;
  name: string;
  monthly_rent_target: number;
}

interface Tenant {
  id: string;
  name: string;
  flat_id: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  total_quantity: number;
  available_quantity: number;
}

export default function Appliances() {
  const [appliances, setAppliances] = useState<ApplianceItem[]>([]);
  const [assignedAppliances, setAssignedAppliances] = useState<AssignedAppliance[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAppliance, setEditAppliance] = useState<ApplianceItem | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignAppliance, setAssignAppliance] = useState<ApplianceItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    inventory_item_id: "",
    unit_rent: 0,
    flat_id: "",
    condition: "new" as "new" | "used" | "damaged",
    purchase_date: format(new Date(), "yyyy-MM-dd"),
    purchase_price: 0,
    total_quantity: 1,
  });
  const [assignFormData, setAssignFormData] = useState({
    tenant_id: "",
    quantity: 1,
    rent_part: 0,
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const { toast } = useToast();

  // Fetch appliances
  const fetchAppliances = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("furniture_items")
        .select(`
          id,
          name,
          unit_rent,
          category,
          condition,
          purchase_date,
          purchase_price,
          total_quantity,
          available_quantity,
          flat_id,
          flats (name)
        `)
        .eq("category", "Appliance");

      if (error) throw error;

      const formattedAppliances: ApplianceItem[] = (data || []).map((item) => ({
        id: item.id,
        name: item.name,
        unit_rent: parseFloat(item.unit_rent?.toString() || "0"),
        category: item.category,
        condition: item.condition,
        purchase_date: formatDate(item.purchase_date || new Date()),
        purchase_price: parseFloat(item.purchase_price?.toString() || "0"),
        total_quantity: item.total_quantity,
        available_quantity: item.available_quantity,
        flat_id: item.flat_id,
        flat_name: item.flats?.name,
      }));

      setAppliances(formattedAppliances);
    } catch (error: any) {
      toast({
        title: "Error fetching appliances",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch assigned appliances
  const fetchAssignedAppliances = async () => {
    try {
      const { data, error } = await supabase
        .from("tenant_furniture")
        .select(`
          id,
          furniture_item_id,
          assigned_quantity,
          rent_part,
          tenant_id,
          furniture_items (
            name,
            category,
            condition,
            purchase_date,
            purchase_price
          ),
          tenants (name)
        `)
        .in(
          "furniture_item_id",
          appliances.map((a) => a.id)
        );

      if (error) throw error;

      const formattedAssigned: AssignedAppliance[] = (data || []).map((tf) => ({
        id: tf.id,
        furniture_item_id: tf.furniture_item_id,
        name: tf.furniture_items.name,
        category: tf.furniture_items.category,
        assigned_quantity: tf.assigned_quantity,
        condition: tf.furniture_items.condition,
        purchase_date: formatDate(tf.furniture_items.purchase_date),
        purchase_price: parseFloat(tf.furniture_items.purchase_price?.toString() || "0"),
        rent_part: parseFloat(tf.rent_part?.toString() || "0"),
        tenant_id: tf.tenant_id,
        tenant_name: tf.tenants?.name,
      }));

      setAssignedAppliances(formattedAssigned);
    } catch (error: any) {
      toast({
        title: "Error fetching assigned appliances",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Fetch flats
  const fetchFlats = async () => {
    try {
      const { data, error } = await supabase
        .from("flats")
        .select("id, name, monthly_rent_target")
        .order("name", { ascending: true });

      if (error) throw error;
      setFlats(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching flats",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Fetch tenants
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

  // Fetch inventory items for dropdown
  const fetchInventoryItems = async () => {
    try {
      const { data, error } = await supabase
        .from("furniture_items")
        .select("id, name, category, total_quantity, available_quantity")
        .eq("category", "Appliance");

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
    fetchAppliances();
    fetchFlats();
    fetchTenants();
    fetchInventoryItems();
  }, []);

  useEffect(() => {
    if (appliances.length > 0) {
      fetchAssignedAppliances();
    }
  }, [appliances]);

  // Real-time subscriptions
  useEffect(() => {
    const subscription = supabase
      .channel("appliances_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "furniture_items", filter: "category=eq.Appliance" },
        () => {
          fetchAppliances();
          fetchInventoryItems();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tenant_furniture" },
        () => {
          fetchAssignedAppliances();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
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

  // Form validation for adding/editing appliance
  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.inventory_item_id) newErrors.inventory_item_id = "Please select an inventory item";
    if (formData.unit_rent < 0) newErrors.unit_rent = "Rent must be non-negative";
    if (!formData.flat_id) newErrors.flat_id = "Flat is required";
    if (formData.purchase_price < 0) newErrors.purchase_price = "Price must be non-negative";
    if (formData.total_quantity < 1) newErrors.total_quantity = "Quantity must be at least 1";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form validation for assigning appliance
  const validateAssignForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!assignFormData.tenant_id) newErrors.tenant_id = "Tenant is required";
    if (assignFormData.quantity < 1) newErrors.quantity = "Quantity must be at least 1";
    if (assignAppliance && assignFormData.quantity > assignAppliance.available_quantity)
      newErrors.quantity = `Only ${assignAppliance.available_quantity} available`;
    if (assignFormData.rent_part < 0) newErrors.rent_part = "Rent must be non-negative";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle adding or updating appliance
  const handleAddOrUpdateAppliance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const selectedInventoryItem = inventoryItems.find(
        (item) => item.id === formData.inventory_item_id
      );
      if (!selectedInventoryItem) throw new Error("Selected inventory item not found");

      const applianceData = {
        name: selectedInventoryItem.name,
        unit_rent: formData.unit_rent,
        category: "Appliance",
        condition: formData.condition,
        purchase_date: formData.purchase_date,
        purchase_price: formData.purchase_price,
        total_quantity: formData.total_quantity,
        available_quantity: formData.total_quantity,
        flat_id: formData.flat_id,
      };

      if (editAppliance) {
        const { error } = await supabase
          .from("furniture_items")
          .update(applianceData)
          .eq("id", editAppliance.id);

        if (error) throw error;
        toast({
          title: "Appliance updated",
          description: `${selectedInventoryItem.name} has been updated successfully`,
        });
      } else {
        const { error } = await supabase
          .from("furniture_items")
          .insert(applianceData);

        if (error) throw error;
        toast({
          title: "Appliance added",
          description: `${selectedInventoryItem.name} has been added to inventory`,
        });
      }

      setDialogOpen(false);
      setEditAppliance(null);
      setFormData({
        name: "",
        inventory_item_id: "",
        unit_rent: 0,
        flat_id: "",
        condition: "new",
        purchase_date: format(new Date(), "yyyy-MM-dd"),
        purchase_price: 0,
        total_quantity: 1,
      });
      fetchAppliances();
      fetchInventoryItems();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Handle assigning appliance
  const handleAssignAppliance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAssignForm() || !assignAppliance) return;

    try {
      const { error } = await supabase.from("tenant_furniture").insert({
        tenant_id: assignFormData.tenant_id,
        furniture_item_id: assignAppliance.id,
        assigned_quantity: assignFormData.quantity,
        rent_part: assignFormData.rent_part,
      });

      if (error) throw error;

      // Update available quantity in inventory
      await supabase
        .from("furniture_items")
        .update({ available_quantity: assignAppliance.available_quantity - assignFormData.quantity })
        .eq("id", assignAppliance.id);

      toast({
        title: "Appliance assigned",
        description: `${assignFormData.quantity} ${assignAppliance.name}(s) assigned successfully`,
      });

      setAssignDialogOpen(false);
      setAssignAppliance(null);
      setAssignFormData({ tenant_id: "", quantity: 1, rent_part: 0 });
      fetchAppliances();
      fetchAssignedAppliances();
      fetchInventoryItems();
    } catch (error: any) {
      toast({
        title: "Error assigning appliance",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Handle unassigning appliance
  const handleRemoveAssignedAppliance = async (assigned: AssignedAppliance) => {
    try {
      const appliance = appliances.find((a) => a.id === assigned.furniture_item_id);
      if (!appliance) throw new Error("Appliance not found");

      // Delete from tenant_furniture
      const { error } = await supabase
        .from("tenant_furniture")
        .delete()
        .eq("id", assigned.id);

      if (error) throw error;

      // Update available quantity in inventory
      await supabase
        .from("furniture_items")
        .update({ available_quantity: appliance.available_quantity + assigned.assigned_quantity })
        .eq("id", assigned.furniture_item_id);

      toast({
        title: "Appliance unassigned",
        description: `${assigned.name} has been unassigned`,
      });

      fetchAppliances();
      fetchAssignedAppliances();
      fetchInventoryItems();
    } catch (error: any) {
      toast({
        title: "Error unassigning appliance",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Handle deleting appliance
  const handleDeleteAppliance = async () => {
    if (!itemToDelete) return;

    try {
      // Check for active assignments
      const { data: assignments, error: assignError } = await supabase
        .from("tenant_furniture")
        .select("id")
        .eq("furniture_item_id", itemToDelete);

      if (assignError) throw assignError;
      if (assignments.length > 0) {
        throw new Error("Cannot delete appliance with active assignments");
      }

      const { error } = await supabase
        .from("furniture_items")
        .delete()
        .eq("id", itemToDelete);

      if (error) throw error;

      toast({
        title: "Appliance deleted",
        description: "The appliance has been successfully deleted",
      });

      setDeleteDialogOpen(false);
      setItemToDelete(null);
      fetchAppliances();
      fetchInventoryItems();
    } catch (error: any) {
      toast({
        title: "Error deleting appliance",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Update rent part for assigned appliance
  const handleUpdateRentPart = async (assigned: AssignedAppliance, newRent: number) => {
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
        .from("tenant_furniture")
        .update({ rent_part: newRent })
        .eq("id", assigned.id);

      if (error) throw error;

      toast({
        title: "Rent updated",
        description: `Rent for ${assigned.name} updated to ₹${newRent}`,
      });

      fetchAssignedAppliances();
    } catch (error: any) {
      toast({
        title: "Error updating rent",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Calculate total rent and rent matching
  const totalRent = useMemo(() => {
    return assignedAppliances.reduce((sum, a) => sum + a.rent_part, 0);
  }, [assignedAppliances]);

  const rentMatchesFlat = useMemo(() => {
    return flats.every((flat) => {
      const flatAppliances = assignedAppliances.filter((a) => {
        const appliance = appliances.find((app) => app.id === a.furniture_item_id);
        return appliance?.flat_id === flat.id;
      });
      const flatTotalRent = flatAppliances.reduce((sum, a) => sum + a.rent_part, 0);
      return flatTotalRent === flat.monthly_rent_target;
    });
  }, [flats, assignedAppliances, appliances]);

  return (
    <TooltipProvider>
      <div className="space-y-8 p-4 md:p-6 bg-gray-50 min-h-screen">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
            Appliances Management
          </h1>
          <Button
            onClick={() => {
              setEditAppliance(null);
              setDialogOpen(true);
            }}
            className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm transition-all duration-200"
          >
            <Plus className="h-5 w-5" />
            Add Appliance
          </Button>
        </div>

        {/* Appliance Inventory Card */}
        <Card className="shadow-md border border-gray-100">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl font-semibold text-gray-800">
              Appliance Inventory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Rent (₹)</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Purchase Date</TableHead>
                    <TableHead>Purchase Price (₹)</TableHead>
                    <TableHead>Flat</TableHead>
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
                  ) : appliances.length > 0 ? (
                    appliances.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.unit_rent.toLocaleString()}</TableCell>
                        <TableCell>
                          {item.total_quantity} (Available: {item.available_quantity})
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.condition === "new"
                                ? "default"
                                : item.condition === "used"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {item.condition}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.purchase_date}</TableCell>
                        <TableCell>{item.purchase_price.toLocaleString()}</TableCell>
                        <TableCell>{item.flat_name || "Unassigned"}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditAppliance(item);
                                  setFormData({
                                    name: item.name,
                                    inventory_item_id: item.id,
                                    unit_rent: item.unit_rent,
                                    flat_id: item.flat_id,
                                    condition: item.condition,
                                    purchase_date: item.purchase_date,
                                    purchase_price: item.purchase_price,
                                    total_quantity: item.total_quantity,
                                  });
                                  setDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit Appliance</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setAssignAppliance(item);
                                  setAssignFormData({
                                    tenant_id: "",
                                    quantity: 1,
                                    rent_part: item.unit_rent,
                                  });
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
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete Appliance</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10">
                        <div className="flex flex-col items-center">
                          <Package2 className="h-10 w-10 text-gray-300 mb-2" />
                          <h3 className="text-lg font-medium text-gray-900">No appliances found</h3>
                          <p className="text-gray-500 mt-1">Add appliances to your inventory</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Assigned Appliances Card */}
        <Card className="shadow-md border border-gray-100">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl font-semibold text-gray-800">
              Assigned Appliances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Rent (₹)</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedAppliances.length > 0 ? (
                    assignedAppliances.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.rent_part}
                            onChange={(e) =>
                              handleUpdateRentPart(item, parseFloat(e.target.value) || 0)
                            }
                            className="w-24"
                            min="0"
                          />
                        </TableCell>
                        <TableCell>{item.assigned_quantity}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.condition === "new"
                                ? "default"
                                : item.condition === "used"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {item.condition}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.tenant_name || item.tenant_id}</TableCell>
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-800"
                                onClick={() => handleRemoveAssignedAppliance(item)}
                              >
                                <Unlink className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Unassign Appliance</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10">
                        No assigned appliances
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="mt-6 space-y-2 p-4 sm:p-0">
              <p className="text-lg font-semibold text-gray-800">
                Total Rent: ₹{totalRent.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">
                Round-off: ₹{Math.round(totalRent).toLocaleString()}
              </p>
              {!rentMatchesFlat && (
                <p className="text-sm text-red-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="flex-1">Warning: Total rent does not match flat's monthly rent target.</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Add/Edit Appliance Dialog */}
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditAppliance(null);
          }}
        >
          <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[500px] bg-white rounded-lg shadow-xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold text-gray-900">
                {editAppliance ? "Edit Appliance" : "Add Appliance"}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                {editAppliance
                  ? "Update appliance details"
                  : "Add a new appliance to inventory"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddOrUpdateAppliance} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inventory_item_id">Inventory Item</Label>
                <Select
                  value={formData.inventory_item_id}
                  onValueChange={(value) => {
                    const selectedItem = inventoryItems.find((item) => item.id === value);
                    setFormData({
                      ...formData,
                      inventory_item_id: value,
                      name: selectedItem?.name || "",
                    });
                  }}
                >
                  <SelectTrigger className={errors.inventory_item_id ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select inventory item" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
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
                <Label htmlFor="unit_rent">Rent (₹)</Label>
                <Input
                  id="unit_rent"
                  type="number"
                  value={formData.unit_rent}
                  onChange={(e) =>
                    setFormData({ ...formData, unit_rent: parseFloat(e.target.value) || 0 })
                  }
                  min="0"
                  className={errors.unit_rent ? "border-red-500" : ""}
                />
                {errors.unit_rent && <p className="text-sm text-red-500">{errors.unit_rent}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="flat_id">Flat</Label>
                <Select
                  value={formData.flat_id}
                  onValueChange={(value) => setFormData({ ...formData, flat_id: value })}
                >
                  <SelectTrigger className={errors.flat_id ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select flat" />
                  </SelectTrigger>
                  <SelectContent>
                    {flats.map((flat) => (
                      <SelectItem key={flat.id} value={flat.id}>
                        {flat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.flat_id && <p className="text-sm text-red-500">{errors.flat_id}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Select
                  value={formData.condition}
                  onValueChange={(value: "new" | "used" | "damaged") => 
                    setFormData({ ...formData, condition: value })
                  }
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
                <Label htmlFor="purchase_date">Purchase Date</Label>
                <Input
                  id="purchase_date"
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase_price">Purchase Price (₹)</Label>
                <Input
                  id="purchase_price"
                  type="number"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
                  min="0"
                  className={errors.purchase_price ? "border-red-500" : ""}
                />
                {errors.purchase_price && <p className="text-sm text-red-500">{errors.purchase_price}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_quantity">Total Quantity</Label>
                <Input
                  id="total_quantity"
                  type="number"
                  value={formData.total_quantity}
                  onChange={(e) => setFormData({ ...formData, total_quantity: parseInt(e.target.value) || 1 })}
                  min="1"
                  className={errors.total_quantity ? "border-red-500" : ""}
                />
                {errors.total_quantity && <p className="text-sm text-red-500">{errors.total_quantity}</p>}
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="w-full sm:w-auto">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" className="w-full sm:w-auto">
                  {editAppliance ? "Update" : "Add"} Appliance
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Assign Appliance Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Appliance</DialogTitle>
              <DialogDescription>
                Assign {assignAppliance?.name} to a tenant
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignAppliance} className="space-y-4">
              {/* ...existing assign form content... */}
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the appliance from your inventory.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAppliance}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}