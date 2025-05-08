import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { typedSupabase, supabase } from "@/integrations/supabase/client";
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
import { generateRentReminderMessage } from "@/utils/messageTemplates";

type Flat = Database["public"]["Tables"]["flats"]["Row"];
type Reminder = Database["public"]["Tables"]["reminders"]["Row"];
type FurnitureItem = Database["public"]["Tables"]["furniture_items"]["Row"];

interface WhatsAppIntegrationProps {
  flatId?: string;
  phone?: string;
  paymentLink?: string;
  rentId?: string;
  onSuccess?: () => void;
  message?: string;
  buttonLabel?: string;
  buttonClassName?: string;
  onClose?: () => void;
}

interface InventoryItem {
  id: string;
  name: string;
  rent: number;
}

export default function WhatsAppIntegration({
  flatId = "",
  phone = "",
  paymentLink,
  rentId,
  onSuccess,
  message: initialMessage = "",
  buttonLabel = "Send Message",
  buttonClassName = "",
  onClose,
}: WhatsAppIntegrationProps) {
  const [message, setMessage] = useState(initialMessage);
  const [includePaymentLink, setIncludePaymentLink] = useState(false);
  const [includeReminder, setIncludeReminder] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [furnitureItems, setFurnitureItems] = useState<FurnitureItem[]>([]);
  const [selectedFlat, setSelectedFlat] = useState<string>(flatId);
  const [selectedPhone, setSelectedPhone] = useState<string>(phone);
  const [rentAmount, setRentAmount] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [propertyName, setPropertyName] = useState<string>("");
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
          subscription = supabase
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

  // Fetch flats
  useEffect(() => {
    const fetchFlats = async () => {
      try {
        const { data, error } = await typedSupabase
          .from("flats")
          .select("*")
          .order("name", { ascending: true });

        if (error) throw error;

        if (data) {
          setFlats(data);
          if (!flatId && !phone && data.length > 0) {
            setSelectedFlat(data[0].id);
            setPropertyName(data[0].name);
            setRentAmount(data[0].monthly_rent_target?.toString() || "");
          } else if (flatId) {
            const flat = data.find((f) => f.id === flatId);
            if (flat) {
              setPropertyName(flat.name);
              setRentAmount(flat.monthly_rent_target?.toString() || "");
            }
          }
        }
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
  }, [flatId, phone, toast, setupSubscription]);

  // Fetch reminders
  useEffect(() => {
    const fetchReminders = async () => {
      if (!selectedFlat) return;

      try {
        const { data, error } = await typedSupabase
          .from("reminders")
          .select("*")
          .eq("flat_id", selectedFlat)
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
  }, [selectedFlat, toast, setupSubscription]);

  // Fetch furniture items
  useEffect(() => {
    const fetchFurnitureItems = async () => {
      if (!selectedFlat) return;

      try {
        const { data, error } = await typedSupabase
          .from("furniture_items")
          .select("*")
          .eq("flat_id", selectedFlat);

        if (error) throw error;

        const items = (data || []).map((item) => ({
          id: item.id,
          name: item.name,
          rent: item.unit_rent || 0,
        }));

        setInventoryItems(items);
        setFurnitureItems(data);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error fetching furniture items",
          description: error.message || "Failed to fetch furniture items.",
        });
      }
    };

    fetchFurnitureItems();
    const unsubscribe = setupSubscription("furniture_items_changes", "furniture_items", fetchFurnitureItems);
    return () => unsubscribe();
  }, [selectedFlat, toast, setupSubscription]);

  // Handle flat selection
  const handleFlatChange = (value: string) => {
    setSelectedFlat(value);
    setInventoryItems([]);
    const flat = flats.find((f) => f.id === value);
    if (flat) {
      setPropertyName(flat.name);
      setRentAmount(flat.monthly_rent_target?.toString() || "");
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
      if (!selectedFlat || !rentAmount || !propertyName || !dueDate || !selectedMonths.length) {
        toast({
          variant: "destructive",
          title: "Missing Information",
          description:
            "Please provide flat, rent amount, property name, due date, and select at least one month.",
        });
        return;
      }

      const message = generateRentReminderMessage({
        tenantName: "Property Manager", // Default recipient
        flatName: propertyName,
        amount: parseFloat(rentAmount),
        dueDate,
        months: selectedMonths,
        paymentLink: paymentLink,
        inventoryItems: inventoryItems.map(item => ({
          name: item.name,
          rent: item.rent
        }))
      });

      setMessage(message);
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
          description: "Please enter a valid phone number.",
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
        finalMessage = generateRentReminderMessage({
          tenantName: "Property Manager",
          flatName: propertyName,
          amount: parseFloat(rentAmount),
          dueDate,
          paymentLink,
          inventoryItems: inventoryItems.map(item => ({
            name: item.name,
            rent: item.rent
          }))
        });
      }

      const { data, error } = await typedSupabase
        .from("whatsapp_messages")
        .insert({
          flat_id: selectedFlat || null,
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
      className="flex flex-col space-y-4 w-full max-w-2xl mx-auto"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone" className="text-sm font-medium text-luxury-charcoal">
            Phone Number
          </Label>
          <Input
            id="phone"
            value={selectedPhone}
            onChange={(e) => setSelectedPhone(e.target.value)}
            required
            disabled={!!phone}
            className="mt-1 border-luxury-cream focus:ring-luxury-gold"
            placeholder="Enter phone number"
          />
        </div>

        {paymentLink && (
          <div className="flex items-center space-x-2 mt-6">
            <Checkbox
              id="includePaymentLink"
              checked={includePaymentLink}
              onCheckedChange={(checked) => setIncludePaymentLink(!!checked)}
              className="border-luxury-cream"
            />
            <Label
              htmlFor="includePaymentLink"
              className="text-sm font-medium text-luxury-charcoal cursor-pointer"
            >
              Include Payment Link
            </Label>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="message" className="text-sm font-medium text-luxury-charcoal">
          Message
        </Label>
        <Textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          className="mt-1 min-h-[120px] border-luxury-cream focus:ring-luxury-gold"
          placeholder="Enter your message here"
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isLoading}
          className={`flex items-center gap-2 bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80 ${buttonClassName}`}
        >
          {isLoading ? (
            "Preparing..."
          ) : (
            <>
              <Send className="w-4 h-4" />
              {buttonLabel}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}