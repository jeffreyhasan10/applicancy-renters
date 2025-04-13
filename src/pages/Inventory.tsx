import { useState, useEffect } from "react";
import {
  Package2,
  Plus,
  Search,
  PackagePlus,
  Trash2,
  Edit,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/common/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

// Define the inventory item type
interface InventoryItem {
  id: number;
  name: string;
  category: string;
  condition: "Excellent" | "Good" | "Fair" | "Poor";
  location: string;
  assigned: boolean;
  tenant: string | null;
  flat: string | null;
  purchaseDate: string;
  purchasePrice: number;
  total_quantity?: number;
  available_quantity?: number;
}

// Define flat type for fetching flats
interface Flat {
  id: number;
  name: string;
}

// InventoryForm Component
interface InventoryFormProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onItemAdded?: () => void;
}

function InventoryForm({ open, onOpenChange, onItemAdded }: InventoryFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    name: "",
    category: "Furniture",
    condition: "Good",
    flat_id: null,
    purchaseDate: "",
    purchasePrice: 0,
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
      // Validate flat_id
      if (!formData.flat_id) {
        throw new Error("Please select a flat");
      }

      // Insert new inventory item into Supabase
      const { error } = await supabase.from("furniture_items").insert({
        name: formData.name,
        condition: formData.condition,
        purchase_date: formData.purchaseDate,
        purchase_price: formData.purchasePrice,
        flat_id: formData.flat_id,
        total_quantity: formData.total_quantity,
        available_quantity: formData.available_quantity,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Item added",
        description: "The inventory item has been successfully added",
      });

      // Reset form
      setFormData({
        name: "",
        category: "Furniture",
        condition: "Good",
        flat_id: null,
        purchaseDate: "",
        purchasePrice: 0,
        total_quantity: 1,
        available_quantity: 1,
      });

      // Close dialog and trigger refresh
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
        name === "purchasePrice" || name === "total_quantity"
          ? parseFloat(value) || 0
          : value,
    }));
  };

  const handleSelectChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: field === "flat_id" ? parseInt(value) : value,
    }));
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
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
        <Label htmlFor="total_quantity">Total Quantity</Label>
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
          value={formData.condition}
          onValueChange={(value) => handleSelectChange("condition", value)}
        >
          <SelectTrigger id="condition">
            <SelectValue placeholder="Select condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Excellent">Excellent</SelectItem>
            <SelectItem value="Good">Good</SelectItem>
            <SelectItem value="Fair">Fair</SelectItem>
            <SelectItem value="Poor">Poor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="flat_id">Assign to Flat</Label>
        <Select
          value={formData.flat_id?.toString()}
          onValueChange={(value) => handleSelectChange("flat_id", value)}
          disabled={loadingFlats || flats.length === 0}
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
              <SelectItem key={flat.id} value={flat.id.toString()}>
                {flat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={loadingFlats}>
          Add Item
        </Button>
      </div>
    </form>
  );

  if (open !== undefined && onOpenChange) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
            <DialogDescription>
              Enter the details for the new inventory item.
            </DialogDescription>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
    );
  }

  return formContent;
}

// Main Inventory Component
export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch inventory data
  const fetchInventoryItems = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("furniture_items")
        .select(
          `
            id,
            name,
            unit_rent,
            purchase_price,
            purchase_date,
            condition,
            flats (name),
            tenant_furniture (
              assigned_quantity,
              tenants (name)
            ),
            total_quantity,
            available_quantity,
            created_at
          `
        );

      if (error) throw error;

      const formattedItems: InventoryItem[] = (data || []).map((item) => ({
        id: item.id,
        name: item.name,
        category: "Furniture",
        condition: item.condition as "Excellent" | "Good" | "Fair" | "Poor",
        location: item.flats?.name || "Unknown",
        assigned:
          !!item.tenant_furniture && item.tenant_furniture.assigned_quantity > 0,
        tenant: item.tenant_furniture?.tenants?.name || null,
        flat: item.flats?.name || null,
        purchaseDate: formatDate(item.purchase_date || item.created_at || ""),
        purchasePrice:
          parseFloat(item.purchase_price?.toString() || "0") ||
          parseFloat(item.unit_rent?.toString() || "0") ||
          0,
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

  // Format date helper
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

  useEffect(() => {
    fetchInventoryItems();
  }, []);

  const handleDeleteItem = async () => {
    if (itemToDelete === null) return;

    setDeleteInProgress(true);

    try {
      const { error } = await supabase
        .from("furniture_items")
        .delete()
        .eq("id", itemToDelete);

      if (error) throw error;

      setInventoryItems((prev) =>
        prev.filter((item) => item.id !== itemToDelete)
      );
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

  const openDeleteDialog = (id: number) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const inventoryStats = {
    totalItems: inventoryItems.length,
    assignedItems: inventoryItems.filter((item) => item.assigned).length,
    totalValue: inventoryItems.reduce(
      (sum, item) => sum + item.purchasePrice,
      0
    ),
    categories: Object.entries(
      inventoryItems.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ),
  };

  const getFilteredItems = () => {
    return inventoryItems.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());

      if (activeTab === "all") return matchesSearch;
      if (activeTab === "assigned") return matchesSearch && item.assigned;
      if (activeTab === "available") return matchesSearch && !item.assigned;
      return matchesSearch;
    });
  };

  return (
    <>
      <PageHeader
        title="Inventory Management"
        description="Track and manage property inventory"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <InventoryForm
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              onItemAdded={fetchInventoryItems}
            />
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Total Items</CardTitle>
            <CardDescription>In inventory</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-2">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-propease-600"></div>
              </div>
            ) : (
              <>
                <div className="flex items-center">
                  <Package2 className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="text-2xl font-bold">
                    {inventoryStats.totalItems}
                  </span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-gray-500">
                    Available:{" "}
                    {inventoryStats.totalItems - inventoryStats.assignedItems}
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
          <CardHeader className="pb-3">
            <CardTitle>Total Value</CardTitle>
            <CardDescription>Inventory worth</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-2">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-propease-600"></div>
              </div>
            ) : (
              <>
                <div className="flex items-center">
                  <span className="text-2xl font-bold">
                    ₹{inventoryStats.totalValue.toLocaleString()}
                  </span>
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
          <CardHeader className="pb-3">
            <CardTitle>Quick Add</CardTitle>
            <CardDescription>Add item to inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full gap-2">
                  <PackagePlus className="h-4 w-4" />
                  New Inventory Item
                </Button>
              </DialogTrigger>
              <InventoryForm
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onItemAdded={fetchInventoryItems}
              />
            </Dialog>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventory Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            defaultValue="all"
            value={activeTab}
            onValueChange={setActiveTab}
          >
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                        <TableCell colSpan={7} className="text-center py-10">
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-propease-600"></div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : getFilteredItems().length > 0 ? (
                      getFilteredItems().map((item) => (
                        <TableRow key={item.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">
                            {item.name}
                          </TableCell>
                          <TableCell>{item.category}</TableCell>
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
                          <TableCell className="text-right space-x-2">
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              onClick={() => openDeleteDialog(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10">
                          <div className="flex flex-col items-center justify-center">
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
                      <TableHead>Condition</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Flat</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10">
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-propease-600"></div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : getFilteredItems().length > 0 ? (
                      getFilteredItems().map((item) => (
                        <TableRow key={item.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">
                            {item.name}
                          </TableCell>
                          <TableCell>{item.category}</TableCell>
                          <TableCell>{item.condition}</TableCell>
                          <TableCell>{item.location}</TableCell>
                          <TableCell>{item.tenant}</TableCell>
                          <TableCell>{item.flat}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                            <Button variant="outline" size="sm">
                              Unassign
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10">
                          <div className="flex flex-col items-center justify-center">
                            <Package2 className="h-10 w-10 text-gray-300 mb-2" />
                            <h3 className="text-lg font-medium text-gray-900">
                              No assigned items found
                            </h3>
                            <p className="text-gray-500 mt-1">
                              {searchQuery
                                ? "Try adjusting your search criteria"
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
                        <TableCell colSpan={7} className="text-center py-10">
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-propease-600"></div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : getFilteredItems().length > 0 ? (
                      getFilteredItems().map((item) => (
                        <TableRow key={item.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">
                            {item.name}
                          </TableCell>
                          <TableCell>{item.category}</TableCell>
                          <TableCell>{item.condition}</TableCell>
                          <TableCell>{item.location}</TableCell>
                          <TableCell>{item.purchaseDate}</TableCell>
                          <TableCell>
                            ₹{item.purchasePrice.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                            <Button variant="outline" size="sm">
                              Assign
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10">
                          <div className="flex flex-col items-center justify-center">
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inventory Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this inventory item? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInProgress}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              disabled={deleteInProgress}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
            >
              {deleteInProgress ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}