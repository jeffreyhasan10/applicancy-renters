import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { typedSupabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Send, RefreshCw } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { Checkbox } from "@/components/ui/checkbox";
import { format, parseISO, isValid } from "date-fns";

interface WhatsAppIntegrationProps {
  tenantId?: string;
  phone?: string;
  paymentLink?: string;
  rentId?: string; // Added to link to specific rent record
  onSuccess?: () => void; // Callback for successful message send
}

type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
type Reminder = Database["public"]["Tables"]["reminders"]["Row"];
type Flat = Database["public"]["Tables"]["flats"]["Row"];
type FurnitureItem = Database["public"]["Tables"]["furniture_items"]["Row"];

interface InventoryItem {
  id: string;
  name: string;
  rent: number;
}

export default function WhatsAppIntegration({
  tenantId = "",
  phone = "",
  paymentLink,
  rentId,
  onSuccess,
}: WhatsAppIntegrationProps) {
  const [message, setMessage] = useState("");
  const [includePaymentLink, setIncludePaymentLink] = useState(false);
  const [includeReminder, setIncludeReminder] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [furnitureItems, setFurnitureItems] = useState<FurnitureItem[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>(tenantId);
  const [selectedPhone, setSelectedPhone] = useState<string>(phone);
  const [rentAmount, setRentAmount] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [propertyName, setPropertyName] = useState<string>("");
  const [ownerName, setOwnerName] = useState<string>("");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const { toast } = useToast();

  // Real-time subscription setup
  const setupSubscription = useCallback(
    (channelName: string, table: string, callback: () => void) => {
      let subscription = null;
      let retryCount = 0;
      const maxRetries = 3;

      const subscribe = () => {
        try {
          subscription = typedSupabase
            .channel(channelName)
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table },
              callback
            )
            .subscribe((status, err) => {
              if (status === "SUBSCRIBED") {
                retryCount = 0;
              }
              if (err && retryCount < maxRetries) {
                retryCount++;
                setTimeout(subscribe, 5000 * retryCount);
                toast({
                  variant: "destructive",
                  title: "Real-time Error",
                  description: `Retrying subscription for ${table} (${retryCount}/${maxRetries})`,
                });
              }
            });
        } catch (error) {
          toast({
            variant: "destructive",
            title: "Real-time Error",
            description: `Failed to initialize subscription for ${table}.`,
          });
        }
      };

      subscribe();

      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    },
    [toast]
  );

  // Fetch tenants
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const { data, error } = await typedSupabase
          .from("tenants")
          .select("id, name, phone, owner_name, flat_id")
          .order("name", { ascending: true });

        if (error) throw error;

        if (data) {
          setTenants(data);
          if (!tenantId && !phone && data.length > 0) {
            setSelectedTenant(data[0].id);
            setSelectedPhone(data[0].phone);
            setOwnerName(data[0].owner_name || "");
            if (data[0].flat_id) {
              fetchFlatDetails(data[0].flat_id);
            }
          } else if (tenantId) {
            const tenant = data.find((t) => t.id === tenantId);
            if (tenant) {
              setOwnerName(tenant.owner_name || "");
              if (tenant.flat_id) {
                fetchFlatDetails(tenant.flat_id);
              }
            }
          }
        }
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error fetching tenants",
          description: error.message || "Failed to fetch tenants.",
        });
      }
    };

    fetchTenants();
    const unsubscribe = setupSubscription("tenants_changes", "tenants", fetchTenants);
    return () => unsubscribe();
  }, [tenantId, phone, toast, setupSubscription]);

  // Fetch flats
  useEffect(() => {
    const fetchFlats = async () => {
      try {
        const { data, error } = await typedSupabase
          .from("flats")
          .select("id, name, monthly_rent_target")
          .order("name", { ascending: true });

        if (error) throw error;

        setFlats(data);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error fetching flats",
          description: error.message || "Failed to fetch flats.",
        });
      }
    };

    fetchFlats();
    const unsubscribe = setupSubscription("flats_changes", "flats", fetchFlats);
    return () => unsubscribe();
  }, [toast, setupSubscription]);

  // Fetch reminders
  useEffect(() => {
    const fetchReminders = async () => {
      if (!selectedTenant) return;

      try {
        const { data, error } = await typedSupabase
          .from("reminders")
          .select("id, title, due_date, description, priority")
          .eq("tenant_id", selectedTenant)
          .order("due_date", { ascending: false });

        if (error) throw error;

        setReminders(data);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error fetching reminders",
          description: error.message || "Failed to fetch reminders.",
        });
      }
    };

    fetchReminders();
    const unsubscribe = setupSubscription("reminders_changes", "reminders", fetchReminders);
    return () => unsubscribe();
  }, [selectedTenant, toast, setupSubscription]);

  // Fetch furniture items
  useEffect(() => {
    const fetchFurnitureItems = async () => {
      if (!selectedTenant) return;

      try {
        const { data, error } = await typedSupabase
          .from("tenant_furniture")
          .select(`
            furniture_item_id,
            rent_part,
            furniture_items (
              id,
              name,
              unit_rent
            )
          `)
          .eq("tenant_id", selectedTenant);

        if (error) throw error;

        const items = data
          .map((tf) => ({
            id: tf.furniture_items?.id || "",
            name: tf.furniture_items?.name || "",
            rent: tf.rent_part || tf.furniture_items?.unit_rent || 0,
          }))
          .filter((item) => item.id && item.name);

        setInventoryItems(items);
        setFurnitureItems(data.map((tf) => tf.furniture_items).filter(Boolean));
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error fetching furniture items",
          description: error.message || "Failed to fetch furniture items.",
        });
      }
    };

    fetchFurnitureItems();
    const unsubscribe = setupSubscription("tenant_furniture_changes", "tenant_furniture", fetchFurnitureItems);
    return () => unsubscribe();
  }, [selectedTenant, toast, setupSubscription]);

  // Fetch flat details
  const fetchFlatDetails = async (flatId: string) => {
    try {
      const { data, error } = await typedSupabase
        .from("flats")
        .select("name, monthly_rent_target")
        .eq("id", flatId)
        .single();

      if (error) throw error;

      if (data) {
        setPropertyName(data.name);
        setRentAmount(data.monthly_rent_target?.toString() || "");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching flat details",
        description: error.message || "Failed to fetch flat details.",
      });
    }
  };

  // Handle tenant selection
  const handleTenantChange = (value: string) => {
    setSelectedTenant(value);
    setInventoryItems([]);
    const tenant = tenants.find((t) => t.id === value);
    if (tenant) {
      setSelectedPhone(tenant.phone);
      setOwnerName(tenant.owner_name || "");
      if (tenant.flat_id) {
        fetchFlatDetails(tenant.flat_id);
      } else {
        setPropertyName("");
        setRentAmount("");
      }
    }
  };

  // Handle reminder selection
  const handleReminderChange = (value: string) => {
    setSelectedReminder(value);
    if (value) {
      const reminder = reminders.find((r) => r.id === value);
      if (reminder) {
        const reminderText = `Reminder: ${reminder.title}\nDue Date: ${
          reminder.due_date && isValid(parseISO(reminder.due_date))
            ? format(parseISO(reminder.due_date), "MM/dd/yyyy")
            : "N/A"
        }\nPriority: ${reminder.priority.toUpperCase()}\n\n${reminder.description || ""}`;
        setMessage(reminderText);
      }
    }
  };

  // Generate template message
  const generateTemplateMessage = () => {
    setIsGeneratingTemplate(true);

    try {
      if (!selectedTenant || !rentAmount || !propertyName || !dueDate || !selectedMonths.length) {
        toast({
          variant: "destructive",
          title: "Missing Information",
          description:
            "Please provide tenant, rent amount, property name, due date, and select at least one month.",
        });
        return;
      }

      const tenant = tenants.find((t) => t.id === selectedTenant);
      const tenantName = tenant ? tenant.name : "Customer";
      const totalAmount = parseFloat(rentAmount) * selectedMonths.length;
      const monthsList = selectedMonths.join(", ");
      const dueDateFormatted =
        dueDate && isValid(parseISO(dueDate))
          ? format(parseISO(dueDate), "dd MMM yyyy")
          : "N/A";

      let templateMessage = `Dear ${tenantName},\nGreetings!\n\n`;
      templateMessage += `Upcoming payment of your furniture monthly rent for month of ${monthsList} was due on ${dueDateFormatted}\n\n`;
      templateMessage += `Payment due is INR Rs ${totalAmount.toLocaleString()}\n\n`;
      templateMessage += `Please Pay the rent to avoid any miss payment.\n\n`;

      if (inventoryItems.length > 0) {
        templateMessage += `New inventory items:\n`;
        inventoryItems.forEach((item) => {
          if (item.name && item.rent > 0) {
            templateMessage += `- ${item.name}: ₹${item.rent.toLocaleString()}\n`;
          }
        });
        templateMessage += "\n";
      }

      if (includePaymentLink && paymentLink) {
        templateMessage += `Please make the payment using the link below:\n${paymentLink}\n\n`;
      }

      templateMessage += `Thank you\nApplicancy Renters`;
      setMessage(templateMessage);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error generating template",
        description: error.message || "Failed to generate template message.",
      });
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  // Send WhatsApp message
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

      if (!message.trim()) {
        toast({
          variant: "destructive",
          title: "Message is empty",
          description: "Please enter a message to send.",
        });
        return;
      }

      const phoneRegex = /^\+?\d{10,15}$/;
      if (!phoneRegex.test(selectedPhone.replace(/\s+/g, ""))) {
        toast({
          variant: "destructive",
          title: "Invalid phone number",
          description: "Please enter a valid phone number (10-15 digits).",
        });
        return;
      }

      setIsLoading(true);

      let formattedNumber = selectedPhone.startsWith("+")
        ? selectedPhone.substring(1)
        : selectedPhone;
      formattedNumber = formattedNumber.replace(/\s+/g, "");

      let finalMessage = message;
      if (includePaymentLink && paymentLink && !message.includes(paymentLink)) {
        finalMessage += `\n\nPayment Link: ${paymentLink}`;
      }

      const { data, error } = await typedSupabase
        .from("whatsapp_messages")
        .insert({
          tenant_id: selectedTenant || null,
          message: finalMessage,
          recipient_phone: formattedNumber,
          included_payment_link: includePaymentLink,
          rent_id: rentId || null,
          sent_at: new Date().toISOString(),
          status: "pending",
        })
        .select("id")
        .single();

      if (error) throw error;

      if (rentId) {
        await typedSupabase
          .from("rents")
          .update({
            whatsapp_sent: true,
            last_reminder_date: new Date().toISOString().split("T")[0],
            custom_message: finalMessage,
          })
          .eq("id", rentId);
      }

      const whatsappMessage = encodeURIComponent(finalMessage);
      const whatsappURL = `https://wa.me/${formattedNumber}?text=${whatsappMessage}`;

      window.open(whatsappURL, "_blank");

      toast({
        title: "WhatsApp message ready",
        description: "WhatsApp has been opened with your message. You can now send it.",
      });

      setMessage("");
      setIncludePaymentLink(false);
      setIncludeReminder(false);
      setSelectedReminder("");
      setSelectedMonths([]);
      setInventoryItems([]);
      onSuccess?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error preparing WhatsApp message",
        description: error.message || "Failed to prepare WhatsApp message.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle inventory item selection
  const handleInventoryChange = (id: string) => {
    const item = furnitureItems.find((fi) => fi.id === id);
    if (item && !inventoryItems.some((ii) => ii.id === id)) {
      setInventoryItems((prev) => [
        ...prev,
        { id: item.id, name: item.name, rent: item.unit_rent || 0 },
      ]);
    }
  };

  // Remove inventory item
  const removeInventoryItem = (id: string) => {
    setInventoryItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Available months
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return (
    <form
      onSubmit={sendWhatsAppMessage}
      className="flex flex-col space-y-4"
      aria-label="WhatsApp Message Form"
    >
      <div>
        <Label htmlFor="tenant">Select Tenant</Label>
        <Select
          value={selectedTenant}
          onValueChange={handleTenantChange}
          disabled={!!tenantId}
          aria-label="Select a tenant"
        >
          <SelectTrigger id="tenant" className="w-full">
            <SelectValue placeholder="Select a tenant" />
          </SelectTrigger>
          <SelectContent>
            {tenants.length > 0 ? (
              tenants.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.phone})
                </SelectItem>
              ))
            ) : (
              <SelectItem value="" disabled>
                No tenants available
              </SelectItem>
            )}
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
          aria-label="Tenant phone number"
          placeholder="Enter phone number"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="includeReminder"
          checked={includeReminder}
          onCheckedChange={(checked) => setIncludeReminder(!!checked)}
          aria-label="Use existing reminder"
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
            aria-label="Select a reminder"
          >
            <SelectTrigger id="reminder" className="w-full">
              <SelectValue placeholder="Select a reminder" />
            </SelectTrigger>
            <SelectContent>
              {reminders.map((reminder) => (
                <SelectItem key={reminder.id} value={reminder.id}>
                  {reminder.title} (Due:{" "}
                  {reminder.due_date && isValid(parseISO(reminder.due_date))
                    ? format(parseISO(reminder.due_date), "MM/dd/yyyy")
                    : "N/A"}
                  )
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {includeReminder && reminders.length === 0 && (
        <div className="text-sm text-gray-500 flex items-center">
          <Clock className="w-4 h-4 mr-2" aria-hidden="true" />
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
            aria-label="Generate template message"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isGeneratingTemplate ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
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
              required
              aria-label="Property name"
            />
          </div>

          <div>
            <Label htmlFor="rentAmount">Rent Amount per Month (₹)</Label>
            <Input
              id="rentAmount"
              value={rentAmount}
              onChange={(e) => setRentAmount(e.target.value)}
              placeholder="Enter rent amount"
              type="number"
              required
              min="0"
              aria-label="Rent amount per month"
            />
          </div>

          <div>
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              aria-label="Due date"
            />
          </div>

          <div>
            <Label htmlFor="ownerName">Owner Name</Label>
            <Input
              id="ownerName"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Enter owner name"
              aria-label="Owner name"
            />
          </div>

          <div className="md:col-span-2">
            <Label>Months Due</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {months.map((month) => (
                <div key={month} className="flex items-center space-x-2">
                  <Checkbox
                    id={`month-${month}`}
                    checked={selectedMonths.includes(month)}
                    onCheckedChange={(checked) =>
                      setSelectedMonths((prev) =>
                        checked
                          ? [...prev, month]
                          : prev.filter((m) => m !== month)
                      )
                    }
                    aria-label={`Include ${month} in payment reminder`}
                  />
                  <Label
                    htmlFor={`month-${month}`}
                    className="cursor-pointer text-sm"
                  >
                    {month}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="furnitureItems">Furniture Items</Label>
            <Select
              onValueChange={handleInventoryChange}
              aria-label="Select furniture item"
            >
              <SelectTrigger id="furnitureItems" className="w-full">
                <SelectValue placeholder="Select furniture item" />
              </SelectTrigger>
              <SelectContent>
                {furnitureItems.length > 0 ? (
                  furnitureItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} (₹{item.unit_rent?.toLocaleString()})
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="" disabled>
                    No furniture items available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {inventoryItems.length > 0 && (
              <div className="mt-2 space-y-2">
                {inventoryItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-gray-100 p-2 rounded"
                  >
                    <span>
                      {item.name}: ₹{item.rent.toLocaleString()}
                    </span>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeInventoryItem(item.id)}
                      aria-label={`Remove ${item.name} from inventory`}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
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
          aria-label="Message content"
        />
      </div>

      {paymentLink && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="includePaymentLink"
            checked={includePaymentLink}
            onCheckedChange={(checked) => setIncludePaymentLink(!!checked)}
            aria-label="Include payment link"
          />
          <Label htmlFor="includePaymentLink" className="cursor-pointer">
            Include Payment Link
          </Label>
        </div>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="flex items-center gap-2"
        aria-label="Send WhatsApp message"
      >
        {isLoading ? (
          "Preparing..."
        ) : (
          <>
            <Send className="w-4 h-4" aria-hidden="true" />
            Send via WhatsApp
          </>
        )}
      </Button>
    </form>
  );
}