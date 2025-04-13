import { useState } from "react";
import { typedSupabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { 
  ClipboardCopy, 
  Copy, 
  Download, 
  ExternalLink, 
  Eye, 
  FileCheck, 
  Link, 
  Plus, 
  Send 
} from "lucide-react";
import WhatsAppIntegration from "@/components/integrations/WhatsAppIntegration";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function PaymentLinks() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [selectedTenantPhone, setSelectedTenantPhone] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [expiryDays, setExpiryDays] = useState<string>("7");
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [selectedPaymentLink, setSelectedPaymentLink] = useState<string>("");
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>("");
  const [viewVerificationOpen, setViewVerificationOpen] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("active");
  
  const queryClient = useQueryClient();
  
  const { data: tenants, isLoading: isLoadingTenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await typedSupabase.tenants()
        .select(`id, name, phone`)
        .order('name', { ascending: true });
        
      if (error) throw error;
      return data || [];
    }
  });
  
  const { data: paymentLinks, isLoading: isLoadingPaymentLinks } = useQuery({
    queryKey: ["paymentLinks"],
    queryFn: async () => {
      const { data, error } = await typedSupabase.from('payment_links')
        .select(`
          *,
          tenant:tenants (
            name,
            phone
          )
        `)
        .order('generated_at', { ascending: false });
        
      if (error) throw error;
      return data || [];
    }
  });
  
  const createPaymentLinkMutation = useMutation({
    mutationFn: async (formData: {
      tenantId: string;
      amount: number;
      description?: string;
      expiryDays: number;
    }) => {
      const tenant = tenants?.find(t => t.id === formData.tenantId);
      if (!tenant) throw new Error("Selected tenant not found");
      
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + formData.expiryDays);
      
      const { data, error } = await typedSupabase.from('payment_links')
        .insert({
          tenant_id: formData.tenantId,
          amount: formData.amount,
          description: formData.description || null,
          expires_at: expiryDate.toISOString(),
          status: 'active',
          payment_link: window.location.origin + '/payment-verification'
        })
        .select('id')
        .single();
        
      if (error) throw error;
      
      const paymentLink = `${window.location.origin}/payment-verification?id=${data.id}&amount=${formData.amount}&name=${encodeURIComponent(tenant.name)}`;
      
      const { error: updateError } = await typedSupabase.from('payment_links')
        .update({ payment_link: paymentLink })
        .eq('id', data.id);
        
      if (updateError) throw updateError;
      
      setSelectedTenantPhone(tenant.phone);
      
      return { link: paymentLink, id: data.id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["paymentLinks"] });
      setSelectedPaymentLink(data.link);
      setSelectedPaymentId(data.id);
      toast({
        title: "Payment link created",
        description: "The payment link has been generated successfully."
      });
      setIsOpen(false);
      setWhatsappOpen(true);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error creating payment link",
        description: error.message
      });
    }
  });
  
  const handleCreatePaymentLink = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTenant) {
      toast({
        variant: "destructive",
        title: "Tenant required",
        description: "Please select a tenant."
      });
      return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Please enter a valid amount greater than 0."
      });
      return;
    }
    
    createPaymentLinkMutation.mutate({
      tenantId: selectedTenant,
      amount: parseFloat(amount),
      description,
      expiryDays: parseInt(expiryDays) || 7
    });
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied to clipboard",
        description: "The payment link has been copied to your clipboard."
      });
    });
  };
  
  const openWhatsAppForLink = (paymentLink: string, tenant: any, id: string) => {
    setSelectedPaymentLink(paymentLink);
    setSelectedPaymentId(id);
    if (tenant && tenant.phone) {
      setSelectedTenantPhone(tenant.phone);
    }
    setWhatsappOpen(true);
  };

  const openVerificationDetails = async (linkId: string) => {
    try {
      const { data: linkData, error: linkError } = await typedSupabase
        .from('payment_links')
        .select('*')
        .eq('id', linkId)
        .single();
        
      if (linkError) throw linkError;
      
      setSelectedVerification(linkData);
      setViewVerificationOpen(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching verification details",
        description: error.message
      });
    }
  };
  
  const handleDialogChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSelectedTenant("");
      setAmount("");
      setDescription("");
      setExpiryDays("7");
    }
  };

  const handleTenantChange = (value: string) => {
    setSelectedTenant(value);
    const tenant = tenants?.find(t => t.id === value);
    if (tenant && tenant.phone) {
      setSelectedTenantPhone(tenant.phone);
    } else {
      setSelectedTenantPhone("");
    }
  };

  const filterPaymentLinks = (links: any[] = []) => {
    if (activeTab === 'active') {
      return links.filter(link => link.status === 'active');
    } else if (activeTab === 'completed') {
      return links.filter(link => link.status === 'completed');
    } else if (activeTab === 'expired') {
      return links.filter(link => 
        link.status !== 'completed' && 
        link.expires_at && 
        new Date(link.expires_at) < new Date()
      );
    }
    return links;
  };

  const filteredPaymentLinks = filterPaymentLinks(paymentLinks);
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Links</h1>
          <p className="text-muted-foreground">Create and manage payment links for your tenants.</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Payment Link
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Payment Link</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleCreatePaymentLink} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tenant">Select Tenant</Label>
                <Select value={selectedTenant} onValueChange={handleTenantChange}>
                  <SelectTrigger id="tenant">
                    <SelectValue placeholder="Select a tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingTenants ? (
                      <SelectItem value="loading" disabled>Loading tenants...</SelectItem>
                    ) : tenants?.length === 0 ? (
                      <SelectItem value="empty" disabled>No tenants available</SelectItem>
                    ) : (
                      tenants?.map(tenant => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name} ({tenant.phone})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  min="1"
                  step="0.01"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="E.g., Rent for April 2023"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="expiryDays">Expires After (Days)</Label>
                <Input
                  id="expiryDays"
                  type="number"
                  value={expiryDays}
                  onChange={e => setExpiryDays(e.target.value)}
                  min="1"
                  max="30"
                  required
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button 
                  type="submit" 
                  disabled={createPaymentLinkMutation.isPending}
                >
                  {createPaymentLinkMutation.isPending ? "Creating..." : "Create Payment Link"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="active">Active Links</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab}>
          {isLoadingPaymentLinks ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : filteredPaymentLinks.length === 0 ? (
            <Card>
              <CardHeader className="text-center">
                <CardTitle>No {activeTab} Payment Links</CardTitle>
                <CardDescription>
                  {activeTab === 'active' 
                    ? "You haven't created any active payment links yet." 
                    : activeTab === 'completed'
                    ? "There are no completed payment transactions yet."
                    : "There are no expired payment links."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                {activeTab === 'active' && (
                  <Button onClick={() => setIsOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Payment Link
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPaymentLinks.map((link: any) => {
                const isActive = link.status === 'active';
                const isExpired = link.expires_at && new Date(link.expires_at) < new Date();
                const status = isExpired ? 'expired' : link.status;
                
                return (
                  <Card key={link.id} className={!isActive ? "opacity-90" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{link.tenant?.name || "Unknown Tenant"}</CardTitle>
                          <CardDescription className="line-clamp-1">{link.description || "No description"}</CardDescription>
                        </div>
                        <Badge className={`
                          ${status === 'active' ? 'bg-green-100 text-green-800' :
                          status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          status === 'expired' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'}
                        `}>
                          {status}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pb-2">
                      <div className="flex justify-between text-lg font-semibold mb-2">
                        <span>₹{link.amount.toLocaleString()}</span>
                        <span className="text-sm text-gray-500">
                          {new Date(link.generated_at).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {link.status === 'completed' && (
                        <div className="bg-blue-50 p-2 rounded text-sm text-blue-700 mb-2">
                          <div className="flex items-center">
                            <FileCheck className="h-4 w-4 mr-1" />
                            <span>
                              Payment verified {link.completed_at ? format(new Date(link.completed_at), 'MMM d, yyyy') : 'recently'}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {isActive && (
                        <div className="bg-gray-100 p-2 rounded flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-700 truncate flex-1">
                            {link.payment_link.substring(0, 35)}...
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => copyToClipboard(link.payment_link)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                    
                    <CardFooter>
                      {isActive && (
                        <div className="flex gap-2 w-full">
                          <Button 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => copyToClipboard(link.payment_link)}
                          >
                            <Link className="mr-2 h-4 w-4" />
                            Copy Link
                          </Button>
                          <Button 
                            className="flex-1"
                            onClick={() => openWhatsAppForLink(link.payment_link, link.tenant, link.id)}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Send via WhatsApp
                          </Button>
                        </div>
                      )}
                      
                      {status === 'completed' && (
                        <div className="flex gap-2 w-full">
                          <Button 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => openVerificationDetails(link.id)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Button>
                          <Button 
                            variant="secondary" 
                            className="flex-1"
                            onClick={() => window.open(link.screenshot_url, '_blank')}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View Screenshot
                          </Button>
                        </div>
                      )}
                      
                      {status === 'expired' && (
                        <Button variant="outline" className="w-full" disabled>
                          Link Expired
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {whatsappOpen && (
        <Card className="mt-6 p-4">
          <CardHeader>
            <CardTitle>Send Payment Link via WhatsApp</CardTitle>
            <CardDescription>The payment link will be included in your message.</CardDescription>
          </CardHeader>
          <CardContent>
            <WhatsAppIntegration 
              paymentLink={selectedPaymentLink} 
              tenantId={selectedTenant}
              phone={selectedTenantPhone}
            />
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button variant="outline" onClick={() => setWhatsappOpen(false)}>
              Close
            </Button>
          </CardFooter>
        </Card>
      )}

      {viewVerificationOpen && selectedVerification && (
        <Dialog open={viewVerificationOpen} onOpenChange={setViewVerificationOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Payment Verification Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 p-4 rounded-md">
                <h4 className="font-medium text-sm text-gray-500 mb-1">Payment Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Amount</p>
                    <p className="font-medium">₹{selectedVerification.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge className={`
                      ${selectedVerification.status === 'active' ? 'bg-green-100 text-green-800' :
                      selectedVerification.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      'bg-orange-100 text-orange-800'}
                    `}>
                      {selectedVerification.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Created On</p>
                    <p className="font-medium">{format(new Date(selectedVerification.generated_at), 'MMM d, yyyy')}</p>
                  </div>
                  {selectedVerification.completed_at && (
                    <div>
                      <p className="text-sm text-gray-500">Completed On</p>
                      <p className="font-medium">{format(new Date(selectedVerification.completed_at), 'MMM d, yyyy')}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {selectedVerification.notes && (
                <div>
                  <h4 className="font-medium text-sm mb-1">Additional Notes</h4>
                  <div className="bg-gray-50 p-3 rounded-md text-sm">
                    {selectedVerification.notes}
                  </div>
                </div>
              )}
              
              {selectedVerification.screenshot_url && (
                <div>
                  <h4 className="font-medium text-sm mb-1">Payment Screenshot</h4>
                  <div className="border rounded-md overflow-hidden">
                    <img 
                      src={selectedVerification.screenshot_url} 
                      alt="Payment Screenshot" 
                      className="max-h-[300px] w-full object-contain"
                    />
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(selectedVerification.screenshot_url, '_blank')}
                    >
                      <ExternalLink className="mr-2 h-3 w-3" />
                      Open Full Size
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewVerificationOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
