import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/common/PageHeader";
import { typedSupabase } from "@/integrations/supabase/client";

type CompanyInfo = {
  company_name: string;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
  company_website: string | null;
  company_tax: string | null;
};

export default function CompanyInformation() {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    company_name: "",
    company_email: null,
    company_phone: null,
    company_address: null,
    company_website: null,
    company_tax: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Fetch company info on mount
  useEffect(() => {
    async function fetchCompanyInfo() {
      try {
        setLoading(true);
        const { data, error } = await typedSupabase
          .from("settings")
          .select("company_name, company_email, company_phone, company_address, company_website, company_tax")
          .eq("id", "00000000-0000-0000-0000-000000000001")
          .single();

        if (error) throw error;

        setCompanyInfo({
          company_name: data.company_name || "",
          company_email: data.company_email || null,
          company_phone: data.company_phone || null,
          company_address: data.company_address || null,
          company_website: data.company_website || null,
          company_tax: data.company_tax || null,
        });
      } catch (error: any) {
        toast({
          title: "Error fetching company information",
          description: error.message || "Could not load company information",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchCompanyInfo();
  }, [toast]);

  // Handle form changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setCompanyInfo((prev) => ({
      ...prev,
      [id]: value === "" ? null : value,
    }));
  };

  // Handle save
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await typedSupabase
        .from("settings")
        .update({
          company_name: companyInfo.company_name,
          company_email: companyInfo.company_email,
          company_phone: companyInfo.company_phone,
          company_address: companyInfo.company_address,
          company_website: companyInfo.company_website,
          company_tax: companyInfo.company_tax,
        })
        .eq("id", "00000000-0000-0000-0000-000000000001");

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company information saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error saving company information",
        description: error.message || "Could not save company information",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Company Information"
        description="Update your organization details"
      />

      <Card className="border-t-4 border-t-blue-500">
        <CardHeader className="bg-gray-50 rounded-t-lg">
          <CardTitle className="text-2xl">Company Information</CardTitle>
          <CardDescription>Manage your organization's profile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 pt-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company_name" className="font-medium">
                Company Name
              </Label>
              <Input
                id="company_name"
                value={companyInfo.company_name}
                onChange={handleChange}
                className="focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_email" className="font-medium">
                Company Email
              </Label>
              <Input
                id="company_email"
                type="email"
                value={companyInfo.company_email || ""}
                onChange={handleChange}
                className="focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_phone" className="font-medium">
                Company Phone
              </Label>
              <Input
                id="company_phone"
                value={companyInfo.company_phone || ""}
                onChange={handleChange}
                className="focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_address" className="font-medium">
                Company Address
              </Label>
              <Input
                id="company_address"
                value={companyInfo.company_address || ""}
                onChange={handleChange}
                className="focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_website" className="font-medium">
                Company Website
              </Label>
              <Input
                id="company_website"
                value={companyInfo.company_website || ""}
                onChange={handleChange}
                className="focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_tax" className="font-medium">
                Tax/GST Number
              </Label>
              <Input
                id="company_tax"
                value={companyInfo.company_tax || ""}
                onChange={handleChange}
                className="focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-4 bg-gray-50 rounded-b-lg border-t p-6">
          <Button variant="outline" disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="px-6">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}