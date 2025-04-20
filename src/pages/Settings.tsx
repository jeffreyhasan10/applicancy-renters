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
  CardProps,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/common/PageHeader";
import { typedSupabase } from "@/integrations/supabase/client";

type Settings = {
  // Company Information
  company_name: string;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
  company_website: string | null;
  company_tax: string | null;

  // Financial Settings
  rent_due_day: number;
  grace_period: number;
  late_fee_percentage: number;
  notice_period: number;
  security_deposit: number;
  maintenance_budget: number;
  default_currency: string;

  // Other Settings
  lease_template: string;
  default_notification_before: number | null;
};

// Currency options
const currencies = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD", "AED"];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    // Company Information
    company_name: "",
    company_email: null,
    company_phone: null,
    company_address: null,
    company_website: null,
    company_tax: null,

    // Financial Settings
    rent_due_day: 1,
    grace_period: 0,
    late_fee_percentage: 0,
    notice_period: 30,
    security_deposit: 1,
    maintenance_budget: 0,
    default_currency: "USD",

    // Other Settings
    lease_template: "",
    default_notification_before: 60,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("company");
  const { toast } = useToast();

  // Fetch settings on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const { data, error } = await typedSupabase
          .from("settings")
          .select("*")
          .eq("id", "00000000-0000-0000-0000-000000000001")
          .single();

        if (error) throw error;

        setSettings({
          // Company Information
          company_name: data.company_name || "",
          company_email: data.company_email || null,
          company_phone: data.company_phone || null,
          company_address: data.company_address || null,
          company_website: data.company_website || null,
          company_tax: data.company_tax || null,

          // Financial Settings
          rent_due_day: data.rent_due_day || 1,
          grace_period: data.grace_period || 0,
          late_fee_percentage: data.late_fee_percentage || 0,
          notice_period: data.notice_period || 30,
          security_deposit: data.security_deposit || 1,
          maintenance_budget: data.maintenance_budget || 0,
          default_currency: data.default_currency || "USD",

          // Other Settings
          lease_template: data.lease_template || "",
          default_notification_before: data.default_notification_before || 60,
        });
      } catch (error: any) {
        toast({
          title: "Error fetching settings",
          description: error.message || "Could not load settings",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, [toast]);

  // Handle text input changes
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [id]: value === "" ? null : value,
    }));
  };

  // Handle number input changes
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [id]: value === "" ? 0 : Number(value),
    }));
  };

  // Handle select changes
  const handleSelectChange = (value: string, id: string) => {
    setSettings((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  // Handle save
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await typedSupabase
        .from("settings")
        .update(settings)
        .eq("id", "00000000-0000-0000-0000-000000000001");

      if (error) throw error;

      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error saving settings",
        description: error.message || "Could not save settings",
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
        title="Settings"
        description="Manage your system configuration"
      />

      <Tabs defaultValue="company" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 max-w-md mb-6">
          <TabsTrigger value="company">Company Info</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="other">Other Settings</TabsTrigger>
        </TabsList>

        {/* Company Information Tab */}
        <TabsContent value="company">
          <SettingsCard
            title="Company Information"
            description="Manage your organization's profile"
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company_name" className="font-medium">
                  Company Name
                </Label>
                <Input
                  id="company_name"
                  value={settings.company_name}
                  onChange={handleTextChange}
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
                  value={settings.company_email || ""}
                  onChange={handleTextChange}
                  className="focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_phone" className="font-medium">
                  Company Phone
                </Label>
                <Input
                  id="company_phone"
                  value={settings.company_phone || ""}
                  onChange={handleTextChange}
                  className="focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_address" className="font-medium">
                  Company Address
                </Label>
                <Input
                  id="company_address"
                  value={settings.company_address || ""}
                  onChange={handleTextChange}
                  className="focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_website" className="font-medium">
                  Company Website
                </Label>
                <Input
                  id="company_website"
                  value={settings.company_website || ""}
                  onChange={handleTextChange}
                  className="focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_tax" className="font-medium">
                  Tax/GST Number
                </Label>
                <Input
                  id="company_tax"
                  value={settings.company_tax || ""}
                  onChange={handleTextChange}
                  className="focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </SettingsCard>
        </TabsContent>

        {/* Financial Settings Tab */}
        <TabsContent value="financial">
          <SettingsCard
            title="Financial Settings"
            description="Configure rent, fees, and financial defaults"
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rent_due_day" className="font-medium">
                  Rent Due Day (1-31)
                </Label>
                <Input
                  id="rent_due_day"
                  type="number"
                  min={1}
                  max={31}
                  value={settings.rent_due_day}
                  onChange={handleNumberChange}
                  className="focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grace_period" className="font-medium">
                  Grace Period (Days)
                </Label>
                <Input
                  id="grace_period"
                  type="number"
                  min={0}
                  value={settings.grace_period}
                  onChange={handleNumberChange}
                  className="focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="late_fee_percentage" className="font-medium">
                  Late Fee Percentage (%)
                </Label>
                <Input
                  id="late_fee_percentage"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={settings.late_fee_percentage}
                  onChange={handleNumberChange}
                  className="focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notice_period" className="font-medium">
                  Notice Period (Days)
                </Label>
                <Input
                  id="notice_period"
                  type="number"
                  min={0}
                  value={settings.notice_period}
                  onChange={handleNumberChange}
                  className="focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="security_deposit" className="font-medium">
                  Default Security Deposit (Months)
                </Label>
                <Input
                  id="security_deposit"
                  type="number"
                  min={0}
                  step={0.5}
                  value={settings.security_deposit}
                  onChange={handleNumberChange}
                  className="focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maintenance_budget" className="font-medium">
                  Maintenance Budget
                </Label>
                <Input
                  id="maintenance_budget"
                  type="number"
                  min={0}
                  step={100}
                  value={settings.maintenance_budget}
                  onChange={handleNumberChange}
                  className="focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_currency" className="font-medium">
                  Default Currency
                </Label>
                <Select
                  value={settings.default_currency}
                  onValueChange={(value) => handleSelectChange(value, "default_currency")}
                >
                  <SelectTrigger id="default_currency" className="focus:ring-2 focus:ring-blue-500">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SettingsCard>
        </TabsContent>

        {/* Other Settings Tab */}
        <TabsContent value="other">
          <SettingsCard
            title="Other Settings"
            description="Manage notification and document defaults"
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="lease_template" className="font-medium">
                  Default Lease Template
                </Label>
                <Input
                  id="lease_template"
                  value={settings.lease_template || ""}
                  onChange={handleTextChange}
                  className="focus:ring-2 focus:ring-blue-500"
                  placeholder="Template identifier or path"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Enter a template identifier or path to your default lease document
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_notification_before" className="font-medium">
                  Default Notification Time (Minutes)
                </Label>
                <Input
                  id="default_notification_before"
                  type="number"
                  min={0}
                  value={settings.default_notification_before || 60}
                  onChange={handleNumberChange}
                  className="focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Time before events when notifications are sent by default
                </p>
              </div>
            </div>
          </SettingsCard>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4 mt-8">
        <Button variant="outline" disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} className="px-6">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save All Settings"}
        </Button>
      </div>
    </>
  );
}

// Reusable Settings Card Component
function SettingsCard({
  title,
  description,
  children,
  ...props
}: CardProps & {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-t-4 border-t-blue-500" {...props}>
      <CardHeader className="bg-gray-50 rounded-t-lg">
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 pt-6">
        {children}
      </CardContent>
    </Card>
  );
}