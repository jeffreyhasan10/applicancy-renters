import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { typedSupabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Send, RefreshCw } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

interface WhatsAppIntegrationProps {
  tenantId?: string;
  phone?: string;
  paymentLink?: string;
}

type Tenant = Database['public']['Tables']['tenants']['Row'];
type Reminder = Database['public']['Tables']['reminders']['Row'];
type Flat = Database['public']['Tables']['flats']['Row'];

export default function WhatsAppIntegration({ tenantId = "", phone = "", paymentLink }: WhatsAppIntegrationProps) {
  const [message, setMessage] = useState("");
  const [includePaymentLink, setIncludePaymentLink] = useState(false);
  const [includeReminder, setIncludeReminder] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>(tenantId);
  const [selectedPhone, setSelectedPhone] = useState<string>(phone);
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
  const [rentAmount, setRentAmount] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [propertyName, setPropertyName] = useState<string>("");
  const [ownerName, setOwnerName] = useState<string>("");
  const [flats, setFlats] = useState<Flat[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const { data, error } = await typedSupabase.tenants()
          .select('*')
          .order('name', { ascending: true });
          
        if (error) throw error;
        
        if (data) {
          setTenants(data);
          
          if (!tenantId && !phone && data.length > 0) {
            setSelectedTenant(data[0].id);
            setSelectedPhone(data[0].phone);
            
            if (data[0].owner_name) {
              setOwnerName(data[0].owner_name || "");
            }
            
            if (data[0].flat_id) {
              fetchFlatDetails(data[0].flat_id);
            }
          } else if (tenantId) {
            const tenant = data.find(t => t.id === tenantId);
            if (tenant) {
              if (tenant.owner_name) {
                setOwnerName(tenant.owner_name || "");
              }
              if (tenant.flat_id) {
                fetchFlatDetails(tenant.flat_id);
              }
            }
          }
        }
      } catch (error: any) {
        console.error('Error fetching tenants:', error);
        toast({
          variant: "destructive",
          title: "Error fetching tenants",
          description: error.message,
        });
      }
    };
    
    const fetchFlats = async () => {
      try {
        const { data, error } = await typedSupabase.flats()
          .select('*')
          .order('name', { ascending: true });
          
        if (error) throw error;
        
        if (data) {
          setFlats(data);
        }
      } catch (error: any) {
        console.error('Error fetching flats:', error);
      }
    };
    
    fetchTenants();
    fetchFlats();
  }, [tenantId, phone, toast]);
  
  const fetchFlatDetails = async (flatId: string) => {
    try {
      const { data, error } = await typedSupabase.flats()
        .select('*')
        .eq('id', flatId)
        .single();
        
      if (error) throw error;
      
      if (data) {
        setPropertyName(data.name);
        setRentAmount(data.monthly_rent_target.toString());
      }
    } catch (error: any) {
      console.error('Error fetching flat details:', error);
    }
  };
  
  useEffect(() => {
    const fetchReminders = async () => {
      if (!selectedTenant) return;
      
      try {
        const { data, error } = await typedSupabase.from('reminders')
          .select('*')
          .eq('tenant_id', selectedTenant)
          .order('due_date', { ascending: false });
          
        if (error) throw error;
        
        if (data) {
          setReminders(data as Reminder[]);
        }
      } catch (error: any) {
        console.error('Error fetching reminders:', error);
        toast({
          variant: "destructive",
          title: "Error fetching reminders",
          description: error.message,
        });
      }
    };
    
    fetchReminders();
  }, [selectedTenant, toast]);
  
  const handleTenantChange = (value: string) => {
    setSelectedTenant(value);
    const tenant = tenants.find(t => t.id === value);
    if (tenant) {
      setSelectedPhone(tenant.phone);
      if (tenant.owner_name) {
        setOwnerName(tenant.owner_name || "");
      } else {
        setOwnerName("");
      }
      
      if (tenant.flat_id) {
        fetchFlatDetails(tenant.flat_id);
      } else {
        setPropertyName("");
        setRentAmount("");
      }
    }
  };
  
  const handleReminderChange = (value: string) => {
    setSelectedReminder(value);
    
    if (value) {
      const reminder = reminders.find(r => r.id === value);
      if (reminder) {
        const reminderText = `Reminder: ${reminder.title}\nDue Date: ${new Date(reminder.due_date).toLocaleDateString()}\nPriority: ${reminder.priority.toUpperCase()}\n\n${reminder.description || ''}`;
        setMessage(reminderText);
      }
    }
  };
  
  const generateTemplateMessage = () => {
    setIsGeneratingTemplate(true);
    
    try {
      const tenant = tenants.find(t => t.id === selectedTenant);
      const tenantName = tenant ? tenant.name : "tenant";
      
      let templateMessage = `Hi ${tenantName}, this is a reminder that your rent of ₹${rentAmount} for ${propertyName} is due on ${new Date(dueDate).toLocaleDateString()}.`;
      
      if (includePaymentLink && paymentLink) {
        templateMessage += `\n\nPlease make the payment using the link below:\n${paymentLink}`;
      }
      
      templateMessage += `\n\nLet us know once the payment is done. Thank you!\n- ${ownerName || "Management"}`;
      
      setMessage(templateMessage);
    } catch (error) {
      console.error('Error generating template:', error);
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  const sendWhatsAppMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!selectedPhone) {
        toast({
          variant: "destructive",
          title: "No phone number selected",
          description: "Please select a tenant with a valid phone number.",
        });
        return;
      }
      
      setIsLoading(true);
      
      let formattedNumber = selectedPhone.startsWith('+') ? selectedPhone.substring(1) : selectedPhone;
      formattedNumber = formattedNumber.replace(/\s+/g, '');
      
      let whatsappMessage = encodeURIComponent(message);
      
      if (includePaymentLink && paymentLink && !message.includes(paymentLink)) {
        whatsappMessage = encodeURIComponent(`${message}\n\nPayment Link: ${paymentLink}`);
      }
      
      const whatsappURL = `https://wa.me/${formattedNumber}?text=${whatsappMessage}`;
      
      const { data, error } = await typedSupabase.whatsappMessages()
        .insert({
          tenant_id: selectedTenant || null,
          message: includePaymentLink && paymentLink ? `${message}\n\nPayment Link: ${paymentLink}` : message,
          recipient_phone: formattedNumber,
          included_payment_link: includePaymentLink
        })
        .select('id')
        .single();
        
      if (error) throw error;
      
      window.open(whatsappURL, '_blank');
      
      toast({
        title: "WhatsApp message ready",
        description: "WhatsApp has been opened with your message. You can now send it.",
      });
      
      setMessage("");
      setIncludePaymentLink(false);
      setIncludeReminder(false);
      setSelectedReminder("");
      
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error preparing WhatsApp message",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={sendWhatsAppMessage} className="flex flex-col space-y-4">
      <div>
        <Label htmlFor="tenant">Select Tenant</Label>
        <Select 
          value={selectedTenant} 
          onValueChange={handleTenantChange}
          disabled={!!tenantId}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a tenant" />
          </SelectTrigger>
          <SelectContent>
            {tenants.map((tenant) => (
              <SelectItem key={tenant.id} value={tenant.id}>
                {tenant.name} ({tenant.phone})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          value={selectedPhone}
          onChange={(e) => setSelectedPhone(e.target.value)}
          required
          disabled={!!phone}
        />
      </div>
      
      <div className="flex items-center space-x-2">
        <Input
          type="checkbox"
          id="includeReminder"
          className="w-4 h-4"
          checked={includeReminder}
          onChange={(e) => setIncludeReminder(e.target.checked)}
        />
        <Label htmlFor="includeReminder" className="cursor-pointer">
          Use existing reminder
        </Label>
      </div>
      
      {includeReminder && reminders.length > 0 && (
        <div>
          <Label htmlFor="reminder">Select Reminder</Label>
          <Select 
            value={selectedReminder} 
            onValueChange={handleReminderChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a reminder" />
            </SelectTrigger>
            <SelectContent>
              {reminders.map((reminder) => (
                <SelectItem key={reminder.id} value={reminder.id}>
                  {reminder.title} (Due: {new Date(reminder.due_date).toLocaleDateString()})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      
      {includeReminder && reminders.length === 0 && (
        <div className="text-sm text-gray-500 flex items-center">
          <Clock className="w-4 h-4 mr-2" />
          No reminders found for this tenant
        </div>
      )}
      
      <div className="border rounded-md p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-medium">Payment Reminder Template</Label>
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={generateTemplateMessage}
            disabled={isGeneratingTemplate}
            className="flex items-center"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isGeneratingTemplate ? 'animate-spin' : ''}`} />
            Generate Template
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="propertyName">Property Name</Label>
            <Input
              id="propertyName"
              value={propertyName}
              onChange={(e) => setPropertyName(e.target.value)}
              placeholder="Enter property name"
            />
          </div>
          
          <div>
            <Label htmlFor="rentAmount">Rent Amount (₹)</Label>
            <Input
              id="rentAmount"
              value={rentAmount}
              onChange={(e) => setRentAmount(e.target.value)}
              placeholder="Enter rent amount"
              type="number"
            />
          </div>
          
          <div>
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="ownerName">Owner Name</Label>
            <Input
              id="ownerName"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Enter owner name"
            />
          </div>
        </div>
      </div>
      
      <div>
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          placeholder="Enter your message here"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          className="min-h-[120px]"
        />
      </div>
      
      {paymentLink && (
        <div className="flex items-center space-x-2">
          <Input
            type="checkbox"
            id="includePaymentLink"
            className="w-4 h-4"
            checked={includePaymentLink}
            onChange={(e) => setIncludePaymentLink(e.target.checked)}
          />
          <Label htmlFor="includePaymentLink" className="cursor-pointer">
            Include Payment Link
          </Label>
        </div>
      )}
      
      <Button type="submit" disabled={isLoading} className="flex items-center gap-2">
        {isLoading ? "Preparing..." : <>
          <Send className="w-4 h-4" />
          Send via WhatsApp
        </>}
      </Button>
    </form>
  );
}
