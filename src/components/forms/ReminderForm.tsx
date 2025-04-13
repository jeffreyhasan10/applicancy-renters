import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { typedSupabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";

type Reminder = Database['public']['Tables']['reminders']['Row'];
type ReminderInsert = Database['public']['Tables']['reminders']['Insert'];

interface ReminderFormProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  tenantId?: string;
}

export default function ReminderForm({ open, onOpenChange, tenantId }: ReminderFormProps) {
  const [formData, setFormData] = useState<ReminderInsert & { sendWhatsapp?: boolean }>({
    title: "",
    description: null,
    due_date: new Date().toISOString().slice(0, 10),
    priority: "medium",
    assigned_to: "Admin",
    tenant_id: tenantId || null,
    status: "pending",
    sendWhatsapp: false
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const createReminderMutation = useMutation({
    mutationFn: async (data: ReminderInsert & { sendWhatsapp?: boolean }) => {
      const { sendWhatsapp, ...reminderData } = data;
      
      const { error } = await typedSupabase.reminders().insert(reminderData);
      
      if (error) throw error;
      
      if (sendWhatsapp && data.tenant_id) {
        const { data: tenantData, error: tenantError } = await typedSupabase
          .tenants()
          .select('phone, name')
          .eq('id', data.tenant_id)
          .single();
          
        if (tenantError) {
          console.error("Error fetching tenant data:", tenantError);
        } else if (tenantData && tenantData.phone) {
          const message = `Reminder: ${data.title}\nDue Date: ${data.due_date}\nPriority: ${data.priority.toUpperCase()}\n\n${data.description}`;
          
          await typedSupabase.whatsappMessages().insert({
            tenant_id: data.tenant_id,
            message: message,
            recipient_phone: tenantData.phone
          });
          
          const formattedNumber = tenantData.phone.startsWith('+') 
            ? tenantData.phone.substring(1) 
            : tenantData.phone;
          
          const whatsappMessage = encodeURIComponent(message);
          const whatsappURL = `https://wa.me/${formattedNumber}?text=${whatsappMessage}`;
          
          window.open(whatsappURL, '_blank');
        }
      }
      
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast({
        title: "Reminder created",
        description: "The reminder has been created successfully.",
      });
      if (onOpenChange) onOpenChange(false);
      setFormData({
        title: "",
        description: null,
        due_date: new Date().toISOString().slice(0, 10),
        priority: "medium",
        assigned_to: "Admin",
        tenant_id: tenantId || null,
        status: "pending",
        sendWhatsapp: false
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create reminder."
      });
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title) {
      toast({
        variant: "destructive",
        title: "Validation error",
        description: "Please enter a reminder title."
      });
      return;
    }
    
    if (!formData.due_date) {
      toast({
        variant: "destructive",
        title: "Validation error",
        description: "Please select a due date."
      });
      return;
    }
    
    createReminderMutation.mutate(formData);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };
  
  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Reminder Title</Label>
        <Input 
          id="title" 
          name="title" 
          value={formData.title} 
          onChange={handleChange}
          placeholder="Enter reminder title" 
          required 
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea 
          id="description" 
          name="description" 
          value={formData.description || ''} 
          onChange={handleChange}
          placeholder="Enter reminder details" 
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="due_date">Due Date</Label>
        <Input 
          id="due_date" 
          name="due_date" 
          type="date" 
          value={formData.due_date as string} 
          onChange={handleChange}
          required 
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="priority">Priority</Label>
        <Select 
          value={formData.priority} 
          onValueChange={(value) => handleSelectChange("priority", value)}
        >
          <SelectTrigger id="priority">
            <SelectValue placeholder="Select priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="assigned_to">Assigned To</Label>
        <Input 
          id="assigned_to" 
          name="assigned_to" 
          value={formData.assigned_to} 
          onChange={handleChange}
          placeholder="Enter assignee name" 
          required 
        />
      </div>
      
      {tenantId && (
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="sendWhatsapp"
            name="sendWhatsapp"
            checked={formData.sendWhatsapp || false}
            onChange={handleCheckboxChange}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="sendWhatsapp" className="cursor-pointer">
            Send WhatsApp notification
          </Label>
        </div>
      )}
      
      <div className="flex justify-end gap-2 pt-4">
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancel</Button>
        </DialogClose>
        <Button 
          type="submit"
          disabled={createReminderMutation.isPending}
        >
          {createReminderMutation.isPending ? "Adding..." : "Add Reminder"}
        </Button>
      </div>
    </form>
  );

  if (open !== undefined && onOpenChange) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Reminder</DialogTitle>
            <DialogDescription>
              Create a new reminder for your property management tasks.
            </DialogDescription>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
    );
  }

  return formContent;
}
