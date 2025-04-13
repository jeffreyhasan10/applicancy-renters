
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
    tenantId: tenantId || "",
    amount: "",
    dueDate: new Date().toISOString().slice(0, 10),
    isPaid: false,
    sendWhatsapp: false,
    customMessage: ""
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch tenants for dropdown
  const { data: tenants } = useQuery({
    queryKey: ["tenants", flatId],
    queryFn: async () => {
      let query = typedSupabase.tenants().select(`id, name, phone, flat_id`);
      
      // Filter by flatId if provided
      if (flatId) {
        query = query.eq('flat_id', flatId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error("Error fetching tenants:", error);
        throw error;
      }
      
      return data;
    },
    enabled: open === true, // Only fetch when dialog is open
  });
  
  // Reset form when opened with tenantId
  useEffect(() => {
    if (open && tenantId) {
      setFormData(prev => ({
        ...prev,
        tenantId: tenantId
      }));
    }
  }, [open, tenantId]);
  
  // Create rent record mutation
  const createRentMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await typedSupabase.from('rents').insert({
        tenant_id: data.tenantId,
        amount: parseFloat(data.amount),
        due_date: data.dueDate,
        is_paid: data.isPaid,
        paid_on: data.isPaid ? new Date().toISOString().slice(0, 10) : null,
        custom_message: data.customMessage || null
      });
      
      if (error) throw error;
      
      // If WhatsApp notification is enabled, send WhatsApp message
      if (data.sendWhatsapp) {
        const { data: tenantData, error: tenantError } = await typedSupabase
          .tenants()
          .select('phone, name')
          .eq('id', data.tenantId)
          .single();
          
        if (tenantError) {
          console.error("Error fetching tenant data:", tenantError);
          throw tenantError;
        }
        
        if (tenantData && tenantData.phone) {
          // Create message based on payment status
          let message = data.isPaid
            ? `Hi ${tenantData.name}, we've recorded your rent payment of ₹${data.amount} dated ${new Date().toLocaleDateString()}. Thank you!`
            : `Hi ${tenantData.name}, a new rent payment of ₹${data.amount} has been added to your account due on ${new Date(data.dueDate).toLocaleDateString()}.`;
            
          // Add custom message if provided
          if (data.customMessage) {
            message += `\n\n${data.customMessage}`;
          }
          
          // Create WhatsApp message record
          await typedSupabase.whatsappMessages().insert({
            tenant_id: data.tenantId,
            message: message,
            recipient_phone: tenantData.phone
          });
          
          // Format phone number for WhatsApp
          const formattedNumber = tenantData.phone.startsWith('+') 
            ? tenantData.phone.substring(1) 
            : tenantData.phone;
          
          // Prepare WhatsApp message URL
          const whatsappMessage = encodeURIComponent(message);
          const whatsappURL = `https://wa.me/${formattedNumber}?text=${whatsappMessage}`;
          
          // Open WhatsApp in new tab
          window.open(whatsappURL, '_blank');
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
      // Reset form
      setFormData({
        tenantId: tenantId || "",
        amount: "",
        dueDate: new Date().toISOString().slice(0, 10),
        isPaid: false,
        sendWhatsapp: false,
        customMessage: ""
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to record rent payment."
      });
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tenantId) {
      toast({
        variant: "destructive",
        title: "Validation error",
        description: "Please select a tenant."
      });
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({
        variant: "destructive",
        title: "Validation error",
        description: "Please enter a valid amount."
      });
      return;
    }
    createRentMutation.mutate(formData);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (value: string) => {
    setFormData(prev => ({ ...prev, tenantId: value }));
  };
  
  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };
  
  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tenantId">Select Tenant</Label>
        <Select value={formData.tenantId} onValueChange={handleSelectChange}>
          <SelectTrigger id="tenantId">
            <SelectValue placeholder="Select a tenant" />
          </SelectTrigger>
          <SelectContent>
            {tenants && tenants.length > 0 ? (
              tenants.map(tenant => (
                <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
              ))
            ) : (
              <SelectItem value="no-tenants" disabled>No tenants available</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="amount">Amount (₹)</Label>
        <Input 
          id="amount" 
          name="amount" 
          type="number" 
          value={formData.amount} 
          onChange={handleChange}
          placeholder="Enter rent amount" 
          required 
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="dueDate">Due Date</Label>
        <Input 
          id="dueDate" 
          name="dueDate" 
          type="date" 
          value={formData.dueDate} 
          onChange={handleChange}
          required 
        />
      </div>
      
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="isPaid" 
          checked={formData.isPaid} 
          onCheckedChange={(checked) => handleCheckboxChange("isPaid", checked as boolean)} 
        />
        <Label htmlFor="isPaid" className="cursor-pointer">Already paid</Label>
      </div>
      
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="sendWhatsapp" 
          checked={formData.sendWhatsapp} 
          onCheckedChange={(checked) => handleCheckboxChange("sendWhatsapp", checked as boolean)} 
        />
        <Label htmlFor="sendWhatsapp" className="cursor-pointer">Send WhatsApp notification</Label>
      </div>
      
      {formData.sendWhatsapp && (
        <div className="space-y-2">
          <Label htmlFor="customMessage">Custom Message (Optional)</Label>
          <Input 
            id="customMessage" 
            name="customMessage" 
            value={formData.customMessage} 
            onChange={handleChange}
            placeholder="Add a custom message to the WhatsApp notification" 
          />
        </div>
      )}
      
      <div className="flex justify-end gap-2 pt-4">
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancel</Button>
        </DialogClose>
        <Button 
          type="submit" 
          disabled={createRentMutation.isPending}
        >
          {createRentMutation.isPending ? "Saving..." : "Record Payment"}
        </Button>
      </div>
    </form>
  );

  // If open and onOpenChange props exist, render with Dialog wrapper
  if (open !== undefined && onOpenChange) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Record Rent Payment</DialogTitle>
            <DialogDescription>
              Enter the details for the rent payment below.
            </DialogDescription>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
    );
  }

  // Otherwise, just return the form
  return formContent;
}
