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
  Send,
  Trash 
} from "lucide-react";
import WhatsAppIntegration from "@/components/integrations/WhatsAppIntegration";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { motion } from "framer-motion";

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  
  const { data: tenants, isLoading: isLoadingTenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await typedSupabase
        .from('tenants')
        .select(`id, name, phone`)
        .order('name', { ascending: true });
        
      if (error) throw error;
      return data || [];
    }
  });
  
  const { data: paymentLinks, isLoading: isLoadingPaymentLinks } = useQuery({
    queryKey: ["paymentLinks"],
    queryFn: async () => {
      const { data, error } = await typedSupabase
        .from('payment_links')
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
      
      const { data, error } = await typedSupabase
        .from('payment_links')
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
      
      const { error: updateError } = await typedSupabase
        .from('payment_links')
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
  
  const deletePaymentLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await typedSupabase
        .from('payment_links')
        .delete()
        .eq('id', linkId);
        
      if (error) throw error;
      return linkId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paymentLinks"] });
      toast({
        title: "Payment link deleted",
        description: "The payment link has been successfully removed."
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error deleting payment link",
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
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Links</h1>
          <p className="text-muted-foreground mt-1">Create and manage payment links for your tenants.</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button className="hover:bg-primary-dark transition-colors">
              <Plus className="mr-2 h-4 w-4" />
              New Payment Link
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Payment Link</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleCreatePaymentLink} className="space-y-6 py-4">
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
                  className="transition-colors focus:ring-2"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="E.g., Rent for April 2023"
                  className="min-h-[100px]"
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
                  className="transition-colors focus:ring-2"
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <DialogClose asChild>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button 
                  type="submit" 
                  disabled={createPaymentLinkMutation.isPending}
                  className="hover:bg-primary-dark transition-colors"
                >
                  {createPaymentLinkMutation.isPending ? "Creating..." : "Create Payment Link"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 bg-gray-100 p-1 rounded-lg">
          <TabsTrigger value="active" className="transition-colors">Active Links</TabsTrigger>
          <TabsTrigger value="completed" className="transition-colors">Completed</TabsTrigger>
          <TabsTrigger value="expired" className="transition-colors">Expired</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab}>
          {isLoadingPaymentLinks ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : filteredPaymentLinks.length === 0 ? (
            <Card className="border-none shadow-sm">
              <CardHeader className="text-center">
                <CardTitle className="text-xl">No {activeTab} Payment Links</CardTitle>
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
                  <Button 
                    onClick={() => setIsOpen(true)}
                    className="hover:bg-primary-dark transition-colors"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Payment Link
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPaymentLinks.map((link: any) => {
                const isActive = link.status === 'active';
                const isExpired = link.expires_at && new Date(link.expires_at) < new Date();
                const status = isExpired ? 'expired' : link.status;
                
                return (
                  <motion.div
                    key={link.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card 
                      className={`
                        ${!isActive ? "opacity-90" : ""} 
                        hover:shadow-lg transition-shadow duration-200
                        flex flex-col h-full border-none shadow-sm
                      `}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <CardTitle className="text-lg truncate">{link.tenant?.name || "Unknown Tenant"}</CardTitle>
                            <CardDescription className="line-clamp-2 text-sm">{link.description || "No description"}</CardDescription>
                          </div>
                          <Badge className={`
                            ${status === 'active' ? 'bg-green-100 text-green-800' :
                            status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            status === 'expired' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'}
                            shrink-0 text-xs
                          `}>
                            {status}
                          </Badge>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pb-3 flex-grow">
                        <div className="flex justify-between items-center text-lg font-semibold mb-4">
                          <span>₹{link.amount.toLocaleString()}</span>
                          <span className="text-sm text-gray-500">
                            {new Date(link.generated_at).toLocaleDateString()}
                          </span>
                        </div>
                        
                        {link.status === 'completed' && (
                          <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700 mb-4">
                            <div className="flex items-center">
                              <FileCheck className="h-4 w-4 mr-2" />
                              <span>
                                Payment verified {link.completed_at ? format(new Date(link.completed_at), 'MMM d, yyyy') : 'recently'}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {isActive && (
                          <div className="bg-gray-100 p-3 rounded-lg flex items-center justify-between mb-4">
                            <span className="text-sm text-gray-700 truncate flex-1 mr-2">
                              {link.payment_link.substring(0, 35)}...
                            </span>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-gray-200"
                              onClick={() => copyToClipboard(link.payment_link)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </CardContent>
                      
                      <CardFooter className="pt-0">
                        <div className="flex gap-2 w-full flex-wrap">
                          {isActive && (
                            <>
                              <Button 
                                variant="outline" 
                                className="flex-1 min-w-[100px] hover:bg-gray-100 transition-colors text-sm"
                                onClick={() => copyToClipboard(link.payment_link)}
                              >
                                <Link className="mr-2 h-4 w-4" />
                                Copy
                              </Button>
                              <Button 
                                className="flex-1 min-w-[100px] hover:bg-green-600 transition-colors text-sm"
                                onClick={() => openWhatsAppForLink(link.payment_link, link.tenant, link.id)}
                              >
                                <Send className="mr-2 h-4 w-4" />
                                WhatsApp
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="w-10 h-10 hover:bg-red-100 text-red-600"
                                onClick={() => {
                                  setLinkToDelete(link.id);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash className="h-5 w-5" />
                              </Button>
                            </>
                          )}
                          
                          {status === 'completed' && (
                            <>
                              <Button 
                                variant="outline" 
                                className="flex-1 min-w-[100px] hover:bg-gray-100 transition-colors text-sm"
                                onClick={() => openVerificationDetails(link.id)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Details
                              </Button>
                              <Button 
                                variant="secondary" 
                                className="flex-1 min-w-[100px] hover:bg-gray-200 transition-colors text-sm"
                                onClick={() => window.open(link.screenshot_url, '_blank')}
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Screenshot
                              </Button>
                            </>
                          )}
                          
                          {status === 'expired' && (
                            <>
                              <Button 
                                variant="outline" 
                                className="flex-1 min-w-[100px] text-sm" 
                                disabled
                              >
                                Link Expired
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="w-10 h-10 hover:bg-red-100 text-red-600"
                                onClick={() => {
                                  setLinkToDelete(link.id);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash className="h-5 w-5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </CardFooter>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {whatsappOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="mt-8 p-6 border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Send Payment Link via WhatsApp</CardTitle>
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
              <Button 
                variant="outline" 
                onClick={() => setWhatsappOpen(false)}
                className="hover:bg-gray-100 transition-colors"
              >
                Close
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      )}

      {viewVerificationOpen && selectedVerification && (
        <Dialog open={viewVerificationOpen} onOpenChange={setViewVerificationOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Payment Verification Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-sm text-gray-500 mb-2">Payment Information</h4>
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
                  <h4 className="font-medium text-sm mb-2">Additional Notes</h4>
                  <div className="bg-gray-50 p-4 rounded-lg text-sm">
                    {selectedVerification.notes}
                  </div>
                </div>
              )}
              
              {selectedVerification.screenshot_url && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Payment Screenshot</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <img 
                      src={selectedVerification.screenshot_url} 
                      alt="Payment Screenshot" 
                      className="max-h-[300px] w-full object-contain"
                    />
                  </div>
                  <div className="flex justify-end mt-3">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(selectedVerification.screenshot_url, '_blank')}
                      className="hover:bg-gray-100 transition-colors"
                    >
                      <ExternalLink className="mr-2 h-3 w-3" />
                      Open Full Size
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setViewVerificationOpen(false)}
                className="hover:bg-gray-100 transition-colors"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Payment Link</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete this payment link? This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteDialogOpen(false);
                setLinkToDelete(null);
              }}
              className="hover:bg-gray-100 transition-colors"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (linkToDelete) {
                  deletePaymentLinkMutation.mutate(linkToDelete);
                  setDeleteDialogOpen(false);
                  setLinkToDelete(null);
                }
              }}
              disabled={deletePaymentLinkMutation.isPending}
              className="hover:bg-red-700 transition-colors"
            >
              {deletePaymentLinkMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}