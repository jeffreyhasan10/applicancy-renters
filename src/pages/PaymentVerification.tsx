
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { typedSupabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Check, Upload, X, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PaymentVerification() {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get("id");
  const amount = searchParams.get("amount") || "0";
  const tenantName = searchParams.get("name") || "Tenant";
  
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentInvalid, setPaymentInvalid] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [paymentData, setPaymentData] = useState<any>(null);
  
  useEffect(() => {
    if (!paymentId) {
      setPaymentInvalid(true);
      setIsLoading(false);
      return;
    }
    
    const fetchPaymentData = async () => {
      try {
        const { data, error } = await typedSupabase
          .from("payment_links")
          .select("status, expires_at")
          .eq("id", paymentId)
          .single();
        
        if (error) throw error;
        
        if (!data) {
          setPaymentInvalid(true);
        } else {
          setPaymentData(data);
          
          // Check if payment is already completed
          if (data.status === "completed") {
            setPaymentComplete(true);
          }
          
          // Check if payment link is expired
          if (data.expires_at && new Date(data.expires_at) < new Date() && data.status !== "completed") {
            setPaymentInvalid(true);
          }
        }
      } catch (error) {
        console.error("Error fetching payment data:", error);
        setPaymentInvalid(true);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPaymentData();
  }, [paymentId]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      // Validate file type (only images)
      const file = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      
      if (!validTypes.includes(file.type)) {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: "Please upload a JPEG, JPG, or PNG image."
        });
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: "The maximum file size is 5MB."
        });
        return;
      }
      
      setScreenshot(file);
    }
  };
  
  const uploadScreenshot = async () => {
    if (!screenshot || !paymentId) return null;
    
    setIsUploading(true);
    
    try {
      // Create a folder for payment screenshots if it doesn't exist
      const folderPath = `payment_screenshots/${paymentId}`;
      const filePath = `${folderPath}/${screenshot.name}`;
      
      // Upload the screenshot
      const { error: uploadError } = await typedSupabase
        .storage
        .from('payments')
        .upload(filePath, screenshot);
        
      if (uploadError) throw uploadError;
      
      // Get the public URL of the screenshot
      const { data } = typedSupabase
        .storage
        .from('payments')
        .getPublicUrl(filePath);
        
      return data.publicUrl;
    } catch (error: any) {
      console.error('Error uploading screenshot:', error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Failed to upload payment screenshot."
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!paymentId) {
      toast({
        variant: "destructive",
        title: "Invalid payment",
        description: "Payment ID is missing. Please use a valid payment link."
      });
      return;
    }
    
    if (!screenshot) {
      toast({
        variant: "destructive",
        title: "Screenshot required",
        description: "Please upload a screenshot of your payment."
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Upload the screenshot first
      const screenshotUrl = await uploadScreenshot();
      
      if (!screenshotUrl) {
        throw new Error("Failed to upload screenshot");
      }
      
      // Update the payment status in the database
      const { error } = await typedSupabase
        .from('payment_links')
        .update({
          status: 'completed',
          screenshot_url: screenshotUrl,
          notes: notes || null,
          completed_at: new Date().toISOString()
        })
        .eq('id', paymentId);
        
      if (error) throw error;
      
      // Mark payment as successful
      setPaymentComplete(true);
      
      toast({
        title: "Payment verified",
        description: "Your payment screenshot has been submitted successfully."
      });
    } catch (error: any) {
      console.error('Error submitting payment verification:', error);
      toast({
        variant: "destructive",
        title: "Verification failed",
        description: error.message || "Failed to verify payment."
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Skeleton className="h-8 w-40 mx-auto mb-2" />
            <Skeleton className="h-4 w-60 mx-auto" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (paymentComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-green-100 mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Payment Complete!</CardTitle>
            <CardDescription>
              Thank you for your payment of ₹{parseInt(amount).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-500">
              We have received your payment verification. Your transaction has been recorded successfully.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button variant="outline" onClick={() => window.close()}>Close Window</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  if (paymentInvalid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-red-100 mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-xl">Invalid or Expired Payment Link</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-500">
              This payment link is invalid or has expired. Please contact your property manager for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Payment Verification</CardTitle>
          <CardDescription>
            Please upload a screenshot of your payment to confirm the transaction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="bg-gray-100 p-4 rounded-md mb-4">
                  <div className="text-sm text-gray-500 mb-1">Payment Amount</div>
                  <div className="text-2xl font-bold">₹{parseInt(amount).toLocaleString()}</div>
                  <div className="text-sm text-gray-500 mt-1">For: {tenantName}</div>
                </div>
                
                <Label htmlFor="screenshot">Upload Payment Screenshot</Label>
                <div className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    id="screenshot"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="screenshot" className="cursor-pointer block">
                    {screenshot ? (
                      <div className="space-y-2">
                        <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                          <Check className="h-8 w-8 text-green-600" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">{screenshot.name}</p>
                        <p className="text-xs text-gray-500">Click to change</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                          <Upload className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">Click to upload</p>
                        <p className="text-xs text-gray-500">PNG, JPG, or JPEG</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional information about your payment..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={isSubmitting || isUploading || !screenshot}
              >
                {isSubmitting || isUploading ? "Processing..." : "Confirm Payment"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
