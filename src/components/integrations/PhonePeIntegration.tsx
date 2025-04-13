import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Tenant {
  id: string;
  name: string;
  phone: string;
}

export default function PhonePeIntegration() {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('id, name, phone')
          .eq('is_active', true);
        
        if (error) throw error;
        setTenants(data || []);
      } catch (error: any) {
        console.error("Error fetching tenants:", error.message);
        toast({
          title: "Error fetching tenants",
          description: error.message,
          variant: "destructive"
        });
      }
    };
    
    fetchTenants();
  }, []);
  
  const handleTenantChange = (value: string) => {
    setSelectedTenant(value);
    const selectedTenantData = tenants.find(t => t.id === value);
    if (selectedTenantData) {
      setPhoneNumber(selectedTenantData.phone);
    }
  };
  
  const generatePaymentLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      
      // For demo purposes, generate a mock payment link
      const mockLink = `https://phonepay.in/pay/${Math.random().toString(36).substring(2, 15)}`;
      
      // Calculate expiry date (7 days from now)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7);
      
      // Save the payment link to database using type assertion
      const { error } = await supabase
        .from('payment_links' as any)
        .insert({
          tenant_id: selectedTenant,
          amount: parseFloat(amount),
          description,
          payment_link: mockLink,
          expires_at: expiryDate.toISOString()
        } as any);
        
      if (error) throw error;
      
      setPaymentLink(mockLink);
      toast({
        title: "Payment Link Generated",
        description: "The link has been created and can now be shared with your tenant.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error generating payment link",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(paymentLink);
    toast({
      title: "Copied to clipboard",
      description: "Payment link has been copied to clipboard",
    });
  };
  
  const shareViaWhatsApp = () => {
    const message = encodeURIComponent(`Please complete your payment of ₹${amount} using this link: ${paymentLink}`);
    const whatsappURL = `https://wa.me/${phoneNumber.replace(/\s+/g, "")}?text=${message}`;
    window.open(whatsappURL, "_blank");
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          PhonePe Payment Link Generator
        </CardTitle>
        <CardDescription>
          Create payment links for rent collection via PhonePe
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tenant">Select Tenant</Label>
          <Select onValueChange={handleTenantChange} value={selectedTenant}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a tenant" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map(tenant => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.phone})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="phone">Tenant Phone Number</Label>
          <Input
            id="phone"
            placeholder="Enter phone number with country code"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Amount (₹)</Label>
          <Input
            id="amount"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            placeholder="e.g., Rent for April 2023"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        
        {paymentLink && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md">
            <p className="text-sm font-medium mb-2">Payment Link:</p>
            <div className="flex items-center gap-2">
              <Input value={paymentLink} readOnly />
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                Copy
              </Button>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={shareViaWhatsApp}
              className="mt-2 w-full"
            >
              Share via WhatsApp
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={generatePaymentLink} 
          className="w-full"
          disabled={isLoading}
        >
          Generate Payment Link
        </Button>
      </CardFooter>
    </Card>
  );
}
