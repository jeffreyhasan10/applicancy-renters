// ApplianceRentBreakdown.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Appliance {
  id?: string; // tenant_furniture.id
  furniture_item_id: string;
  name: string;
  rent_part: number;
  assigned_quantity: number;
}

interface Flat {
  id: string;
  name: string;
  monthly_rent_target: number;
}

interface ApplianceRentBreakdownProps {
  tenantId: string;
  flatId: string;
}

export default function ApplianceRentBreakdown({
  tenantId,
  flatId,
}: ApplianceRentBreakdownProps) {
  const { toast } = useToast();
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [roundOff, setRoundOff] = useState<number>(0);
  const [flat, setFlat] = useState<Flat | null>(null);
  const [availableItems, setAvailableItems] = useState<
    { id: string; name: string; unit_rent: number; available_quantity: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  // Fetch flat details and tenant's assigned appliances
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch flat
        const { data: flatData, error: flatError } = await supabase
          .from("flats")
          .select("id, name, monthly_rent_target")
          .eq("id", flatId)
          .single();
        if (flatError) throw flatError;
        setFlat(flatData);

        // Fetch assigned appliances
        const { data: tenantFurniture, error: tfError } = await supabase
          .from("tenant_furniture")
          .select(`
            id,
            furniture_item_id,
            rent_part,
            assigned_quantity,
            furniture_items (
              name,
              unit_rent
            )
          `)
          .eq("tenant_id", tenantId);
        if (tfError) throw tfError;

        const formattedAppliances = tenantFurniture.map((tf) => ({
          id: tf.id,
          furniture_item_id: tf.furniture_item_id,
          name: tf.furniture_items.name,
          rent_part: tf.rent_part,
          assigned_quantity: tf.assigned_quantity,
        }));
        setAppliances(formattedAppliances);

        // Fetch available furniture items
        const { data: items, error: itemsError } = await supabase
          .from("furniture_items")
          .select("id, name, unit_rent, available_quantity")
          .eq("flat_id", flatId)
          .gt("available_quantity", 0);
        if (itemsError) throw itemsError;
        setAvailableItems(items);
      } catch (error: any) {
        toast({
          title: "Error fetching data",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tenantId, flatId, toast]);

  // Calculate total rent
  const totalRent = appliances.reduce(
    (sum, app) => sum + app.rent_part * app.assigned_quantity,
    0
  ) + roundOff;

  // Validate total rent against monthly_rent_target
  const isValidRent = flat ? totalRent === flat.monthly_rent_target : true;

  // Add new appliance
  const handleAddAppliance = async (furnitureItemId: string) => {
    const item = availableItems.find((i) => i.id === furnitureItemId);
    if (!item) return;

    try {
      const newAppliance: Appliance = {
        furniture_item_id: item.id,
        name: item.name,
        rent_part: item.unit_rent || 0,
        assigned_quantity: 1,
      };

      // Insert into tenant_furniture
      const { data, error } = await supabase
        .from("tenant_furniture")
        .insert({
          tenant_id: tenantId,
          furniture_item_id: item.id,
          rent_part: newAppliance.rent_part,
          assigned_quantity: newAppliance.assigned_quantity,
        })
        .select("id")
        .single();
      if (error) throw error;

      setAppliances([...appliances, { ...newAppliance, id: data.id }]);
      setAvailableItems(
        availableItems
          .map((i) =>
            i.id === item.id
              ? { ...i, available_quantity: i.available_quantity - 1 }
              : i
          )
          .filter((i) => i.available_quantity > 0)
      );
      toast({
        title: "Appliance added",
        description: `${item.name} assigned to tenant`,
      });
    } catch (error: any) {
      toast({
        title: "Error adding appliance",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Update rent_part
  const handleRentChange = async (
    index: number,
    value: number,
    applianceId: string
  ) => {
    const updatedAppliances = [...appliances];
    updatedAppliances[index].rent_part = value;
    setAppliances(updatedAppliances);

    try {
      const { error } = await supabase
        .from("tenant_furniture")
        .update({ rent_part: value })
        .eq("id", applianceId);
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Error updating rent",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Update assigned_quantity
  const handleQuantityChange = async (
    index: number,
    value: number,
    applianceId: string,
    furnitureItemId: string
  ) => {
    const item = availableItems.find((i) => i.id === furnitureItemId) || {
      available_quantity: 0,
    };
    const currentQuantity = appliances[index].assigned_quantity;
    const delta = value - currentQuantity;
    if (delta > item.available_quantity) {
      toast({
        title: "Insufficient quantity",
        description: `Only ${item.available_quantity} available`,
        variant: "destructive",
      });
      return;
    }

    const updatedAppliances = [...appliances];
    updatedAppliances[index].assigned_quantity = value;
    setAppliances(updatedAppliances);

    try {
      const { error } = await supabase
        .from("tenant_furniture")
        .update({ assigned_quantity: value })
        .eq("id", applianceId);
      if (error) throw error;

      setAvailableItems(
        availableItems.map((i) =>
          i.id === furnitureItemId
            ? { ...i, available_quantity: i.available_quantity - delta }
            : i
        )
      );
    } catch (error: any) {
      toast({
        title: "Error updating quantity",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Remove appliance
  const handleRemoveAppliance = async (index: number, applianceId: string) => {
    try {
      const { error } = await supabase
        .from("tenant_furniture")
        .delete()
        .eq("id", applianceId);
      if (error) throw error;

      const removed = appliances[index];
      setAppliances(appliances.filter((_, i) => i !== index));
      setAvailableItems(
        availableItems.map((i) =>
          i.id === removed.furniture_item_id
            ? {
                ...i,
                available_quantity: i.available_quantity + removed.assigned_quantity,
              }
            : i
        )
      );
      toast({
        title: "Appliance removed",
        description: `${removed.name} unassigned from tenant`,
      });
    } catch (error: any) {
      toast({
        title: "Error removing appliance",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Auto-calculate round-off
  const handleAutoRoundOff = () => {
    if (!flat) return;
    const applianceSum = appliances.reduce(
      (sum, app) => sum + app.rent_part * app.assigned_quantity,
      0
    );
    const newRoundOff = flat.monthly_rent_target - applianceSum;
    setRoundOff(newRoundOff);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Appliance Rent Breakdown</h2>
      <div className="space-y-2">
        <Label>Select Appliance to Add</Label>
        <Select onValueChange={handleAddAppliance} disabled={availableItems.length === 0}>
          <SelectTrigger>
            <SelectValue placeholder="Select an appliance" />
          </SelectTrigger>
          <SelectContent>
            {availableItems.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name} (₹{item.unit_rent}, {item.available_quantity} available)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Appliance Name</TableHead>
            <TableHead>Monthly Rent (₹)</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Total (₹)</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appliances.map((appliance, index) => (
            <TableRow key={appliance.id}>
              <TableCell>{appliance.name}</TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={appliance.rent_part}
                  onChange={(e) =>
                    handleRentChange(index, parseFloat(e.target.value) || 0, appliance.id!)
                  }
                  min="0"
                  className="w-24"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={appliance.assigned_quantity}
                  onChange={(e) =>
                    handleQuantityChange(
                      index,
                      parseInt(e.target.value) || 1,
                      appliance.id!,
                      appliance.furniture_item_id
                    )
                  }
                  min="1"
                  className="w-20"
                />
              </TableCell>
              <TableCell>{appliance.rent_part * appliance.assigned_quantity}</TableCell>
              <TableCell>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemoveAppliance(index, appliance.id!)}
                >
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={3} className="text-right font-semibold">
              Round-Off
            </TableCell>
            <TableCell>
              <Input
                type="number"
                value={roundOff}
                onChange={(e) => setRoundOff(parseFloat(e.target.value) || 0)}
                className="w-24"
              />
              <Button size="sm" onClick={handleAutoRoundOff} className="mt-2">
                Auto Round-Off
              </Button>
            </TableCell>
            <TableCell></TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={3} className="text-right font-semibold">
              Total Rent
            </TableCell>
            <TableCell
              className={isValidRent ? "text-green-600" : "text-red-600"}
            >
              ₹{totalRent.toLocaleString()}
            </TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableBody>
      </Table>
      {!isValidRent && flat && (
        <p className="text-red-600">
          Total rent (₹{totalRent}) does not match flat's monthly rent target (₹
          {flat.monthly_rent_target}).
        </p>
      )}
      {loading && <p>Loading...</p>}
    </div>
  );
}