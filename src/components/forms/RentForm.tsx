import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { typedSupabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface RentFormProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  flatId?: string;
  tenantId?: string;
}

export default function RentForm({ open, onOpenChange, flatId, tenantId }: RentFormProps) {
  const [formData, setFormData] = useState({
    flatId: flatId || "",
    tenantId: tenantId || "",
    amount: "",
    dueDate: new Date().toISOString().slice(0, 10),
    isPaid: false,
    paymentMethod: "cash" as "cash" | "bank_transfer" | "upi" | "credit_card" | "other",
    sendWhatsapp: false,
    customMessage: "",
    notes: "",
  });
  const [flatSearch, setFlatSearch] = useState("");
  const [tenantSearch, setTenantSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch flats
  const { data: flats = [], isLoading: flatsLoading } = useQuery({
    queryKey: ["flats"],
    queryFn: async () => {
      const { data, error } = await typedSupabase
        .from("flats")
        .select("id, name, monthly_rent_target, address")
        .order("name", { ascending: true });
      if (error) {
        console.error("Error fetching flats:", error);
        throw error;
      }
      return data;
    },
    enabled: open === true,
  });

  // Fetch tenants for the selected flat
  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ["tenants", formData.flatId],
    queryFn: async () => {
      if (!formData.flatId) return [];
      const { data, error } = await typedSupabase
        .from("tenants")
        .select("id, name, phone, flat_id, start_date")
        .eq("flat_id", formData.flatId)
        .not("flat_id", "is", null)
        .order("name", { ascending: true });
      if (error) {
        console.error("Error fetching tenants:", error);
        throw error;
      }
      return data;
    },
    enabled: open === true && !!formData.flatId,
  });

  // Update amount when flat is selected
  useEffect(() => {
    if (formData.flatId && flats) {
      const selectedFlat = flats.find((flat) => flat.id === formData.flatId);
      if (selectedFlat?.monthly_rent_target != null) {
        setFormData((prev) => ({
          ...prev,
          amount: selectedFlat.monthly_rent_target.toString(),
        }));
      }
    }
  }, [formData.flatId, flats]);

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setFormData({
        flatId: flatId || "",
        tenantId: tenantId || "",
        amount: "",
        dueDate: new Date().toISOString().slice(0, 10),
        isPaid: false,
        paymentMethod: "cash",
        sendWhatsapp: false,
        customMessage: "",
        notes: "",
      });
      setFlatSearch("");
      setTenantSearch("");
    }
  }, [open, flatId, tenantId]);

  // Create rent record mutation
  const createRentMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const amount = parseFloat(data.amount);
      if (amount <= 0) throw new Error("Amount must be positive");

      const { data: newRent, error } = await typedSupabase
        .from("rents")
        .insert({
          tenant_id: data.tenantId,
          flat_id: data.flatId,
          amount,
          due_date: data.dueDate,
          is_paid: data.isPaid,
          paid_on: data.isPaid ? new Date().toISOString().slice(0, 10) : null,
          custom_message: data.customMessage || null,
          notes: data.notes || null,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;

      if (data.isPaid) {
        const { error: transactionError } = await typedSupabase
          .from("payment_transactions")
          .insert({
            rent_id: newRent.id,
            tenant_id: data.tenantId,
            amount,
            payment_date: new Date().toISOString().slice(0, 10),
            payment_method: data.paymentMethod,
            transaction_reference: `Manual-${Date.now()}`,
            status: "paid",
          });

        if (transactionError) throw transactionError;
      }

      if (data.sendWhatsapp) {
        const { data: tenantData, error: tenantError } = await typedSupabase
          .from("tenants")
          .select("phone, name")
          .eq("id", data.tenantId)
          .single();

        if (tenantError) throw tenantError;

        if (tenantData && tenantData.phone) {
          const message = data.isPaid
            ? `Hi ${tenantData.name}, we've recorded your rent payment of ₹${amount.toLocaleString()} on ${new Date().toLocaleDateString()} via ${data.paymentMethod}. Thank you!`
            : `Hi ${tenantData.name}, your rent payment of ₹${amount.toLocaleString()} is due on ${new Date(data.dueDate).toLocaleDateString()}. Please pay via ${data.paymentMethod}.`;

          const finalMessage = data.customMessage ? `${message}\n\n${data.customMessage}` : message;

          await typedSupabase.from("whatsapp_messages").insert({
            tenant_id: data.tenantId,
            message: finalMessage,
            recipient_phone: tenantData.phone,
            sent_at: new Date().toISOString(),
            rent_id: newRent.id,
            status: "pending",
          });

          const formattedNumber = tenantData.phone.startsWith("+")
            ? tenantData.phone.substring(1)
            : tenantData.phone;

          const whatsappMessage = encodeURIComponent(finalMessage);
          const whatsappURL = `https://wa.me/${formattedNumber}?text=${whatsappMessage}`;

          window.open(whatsappURL, "_blank");
        }
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rents"] });
      toast({
        title: "Rent record created",
        description: "The rent payment has been recorded successfully.",
      });
      if (onOpenChange) onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to record rent payment.",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate amount matches monthly rent target
    if (flats.find((flat) => flat.id === formData.flatId)?.monthly_rent_target != null) {
      const rentAmount = parseFloat(formData.amount);
      const selectedFlat = flats.find((flat) => flat.id === formData.flatId);
      if (rentAmount !== selectedFlat?.monthly_rent_target) {
        toast({
          title: "Invalid Amount",
          description: `Rent amount must match the monthly target of ₹${selectedFlat?.monthly_rent_target}`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      // Create rent record
      const { data: rentData, error: rentError } = await typedSupabase
        .from("rents")
        .insert({
          tenant_id: formData.tenantId,
          flat_id: formData.flatId,
          amount: parseFloat(formData.amount),
          due_date: formData.dueDate,
          is_paid: formData.isPaid,
          whatsapp_sent: formData.sendWhatsapp,
          custom_message: formData.customMessage || null,
          notes: formData.notes || null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (rentError) throw rentError;

      // If marked as paid, create payment transaction
      if (formData.isPaid) {
        const { error: transactionError } = await typedSupabase
          .from("payment_transactions")
          .insert({
            rent_id: rentData.id,
            tenant_id: formData.tenantId,
            amount: parseFloat(formData.amount),
            payment_date: new Date().toISOString().split("T")[0],
            payment_method: formData.paymentMethod,
            status: "paid",
          });

        if (transactionError) throw transactionError;
      }

      toast({
        title: "Success",
        description: "Rent record created successfully",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create rent record",
      });
    }
  };

  const handleFlatSelect = (flatId: string) => {
    setFormData((prev) => ({ ...prev, flatId, tenantId: "" }));
    setTenantSearch("");
  };

  const handleTenantSelect = (tenantId: string) => {
    setFormData((prev) => ({ ...prev, tenantId }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const selectedFlat = flats.find((flat) => flat.id === formData.flatId);

  // Filter flats and tenants based on search
  const filteredFlats = flats.filter(
    (flat) =>
      flat.name.toLowerCase().includes(flatSearch.toLowerCase()) ||
      (flat.address && flat.address.toLowerCase().includes(flatSearch.toLowerCase()))
  );

  const filteredTenants = tenants.filter((tenant) =>
    tenant.name.toLowerCase().includes(tenantSearch.toLowerCase())
  );

  const formContent = (
    <form onSubmit={handleSubmit} className="flex flex-col h-full space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Left Side: Flats List */}
        <div className="w-full md:w-1/2">
          <Label className="block mb-2 text-sm font-semibold sm:text-base">Select Flat</Label>
          <div className="relative mb-3">
            <Input
              placeholder="Search flats..."
              value={flatSearch}
              onChange={(e) => setFlatSearch(e.target.value)}
              className="pl-10 text-sm sm:text-base"
            />
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-gray-400" />
          </div>
          <ScrollArea className="h-[150px] sm:h-[200px] md:h-[250px] border rounded-md">
            {flatsLoading ? (
              <p className="p-4 text-gray-500 text-sm">Loading flats...</p>
            ) : filteredFlats.length === 0 ? (
              <p className="p-4 text-gray-500 text-sm">No flats found</p>
            ) : (
              filteredFlats.map((flat) => (
                <div
                  key={flat.id}
                  className={`p-3 sm:p-4 cursor-pointer border-b last:border-b-0 hover:bg-gray-100 ${
                    formData.flatId === flat.id ? "bg-blue-50" : ""
                  }`}
                  onClick={() => handleFlatSelect(flat.id)}
                >
                  <p className="font-medium text-sm sm:text-base">{flat.name}</p>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">
                    {flat.address || "No address"}
                  </p>
                  <p className="text-xs sm:text-sm">
                    Rent: ₹
                    {flat.monthly_rent_target != null
                      ? flat.monthly_rent_target.toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              ))
            )}
          </ScrollArea>
        </div>

        {/* Right Side: Allocated Tenants and Count */}
        <div className="w-full md:w-1/2">
          <Label className="block mb-2 text-sm font-semibold sm:text-base">Allocated Tenants</Label>
          <div className="relative mb-3">
            <Input
              placeholder="Search tenants..."
              value={tenantSearch}
              onChange={(e) => setTenantSearch(e.target.value)}
              className="pl-10 text-sm sm:text-base"
              disabled={!formData.flatId}
            />
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-gray-400" />
          </div>
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-base sm:text-lg">
                {formData.flatId
                  ? `Tenants for ${selectedFlat?.name || "Selected Flat"}`
                  : "Select a flat to view tenants"}
              </CardTitle>
              {formData.flatId && (
                <CardDescription className="text-xs sm:text-sm">
                  {tenantsLoading
                    ? "Loading..."
                    : filteredTenants.length > 0
                    ? `${filteredTenants.length} tenant${
                        filteredTenants.length !== 1 ? "s" : ""
                      } allocated`
                    : "No tenants allocated"}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="p-4">
              <ScrollArea className="h-[120px] sm:h-[150px] md:h-[180px]">
                {tenantsLoading ? (
                  <p className="text-gray-500 text-sm">Loading tenants...</p>
                ) : !formData.flatId ? (
                  <p className="text-gray-500 text-sm">Please select a flat</p>
                ) : filteredTenants.length === 0 ? (
                  <p className="text-gray-500 text-sm">No tenants allocated to this flat</p>
                ) : (
                  filteredTenants.map((tenant) => (
                    <div
                      key={tenant.id}
                      className={`flex items-center p-2 cursor-pointer hover:bg-gray-100 ${
                        formData.tenantId === tenant.id ? "bg-blue-50" : ""
                      }`}
                      onClick={() => handleTenantSelect(tenant.id)}
                    >
                      <Checkbox
                        checked={formData.tenantId === tenant.id}
                        onCheckedChange={() => handleTenantSelect(tenant.id)}
                        className="mr-2"
                      />
                      <div>
                        <p className="font-medium text-sm sm:text-base">{tenant.name}</p>
                        <p className="text-xs sm:text-sm text-gray-500">{tenant.phone}</p>
                        <p className="text-xs sm:text-sm text-gray-500">
                          Since:{" "}
                          {tenant.start_date
                            ? new Date(tenant.start_date).toLocaleDateString()
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-sm sm:text-base">
              Amount (₹)
            </Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              value={formData.amount}
              onChange={handleChange}
              placeholder="Enter rent amount"
              className="text-sm sm:text-base"
              required
            />
            {formData.amount &&
              selectedFlat?.monthly_rent_target != null &&
              parseFloat(formData.amount) < selectedFlat.monthly_rent_target && (
                <p className="text-xs sm:text-sm text-amber-600">
                  Amount is less than target rent (₹
                  {selectedFlat.monthly_rent_target.toLocaleString()})
                </p>
              )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate" className="text-sm sm:text-base">
              Due Date
            </Label>
            <Input
              id="dueDate"
              name="dueDate"
              type="date"
              value={formData.dueDate}
              onChange={handleChange}
              className="text-sm sm:text-base"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="paymentMethod" className="text-sm sm:text-base">
            Payment Method
          </Label>
          <Select
            value={formData.paymentMethod}
            onValueChange={(value) => handleSelectChange("paymentMethod", value)}
          >
            <SelectTrigger id="paymentMethod" className="text-sm sm:text-base">
              <SelectValue placeholder="Select payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="credit_card">Credit Card</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="isPaid"
            checked={formData.isPaid}
            onCheckedChange={(checked) => handleCheckboxChange("isPaid", checked as boolean)}
          />
          <Label htmlFor="isPaid" className="cursor-pointer text-sm sm:text-base">
            Already paid
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="sendWhatsapp"
            checked={formData.sendWhatsapp}
            onCheckedChange={(checked) =>
              handleCheckboxChange("sendWhatsapp", checked as boolean)
            }
            disabled={!formData.tenantId}
          />
          <Label htmlFor="sendWhatsapp" className="cursor-pointer text-sm sm:text-base">
            Send WhatsApp notification
          </Label>
        </div>

        {formData.sendWhatsapp && (
          <div className="space-y-2">
            <Label htmlFor="customMessage" className="text-sm sm:text-base">
              Custom Message (Optional)
            </Label>
            <Input
              id="customMessage"
              name="customMessage"
              value={formData.customMessage}
              onChange={handleChange}
              placeholder="Add a custom message to the WhatsApp notification"
              className="text-sm sm:text-base"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="notes" className="text-sm sm:text-base">
            Notes (Optional)
          </Label>
          <textarea
            id="notes"
            name="notes"
            className="w-full border border-gray-300 rounded-md p-3 text-sm sm:text-base"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Add any notes (e.g., partial payment details)"
            rows={4}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <DialogClose asChild>
          <Button
            type="button"
            variant="outline"
            className="text-sm sm:text-base px-4 py-2"
          >
            Cancel
          </Button>
        </DialogClose>
        <Button
          type="submit"
          disabled={createRentMutation.isPending || !formData.flatId || !formData.tenantId}
          className="text-sm sm:text-base px-4 py-2"
        >
          {createRentMutation.isPending ? "Saving..." : "Record Payment"}
        </Button>
      </div>
    </form>
  );

  if (open !== undefined && onOpenChange) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Rent Payment</DialogTitle>
            <DialogDescription>
              Create a new rent record for the selected property and tenant.
            </DialogDescription>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
    );
  }

  return formContent;
}