
import React, { useState } from 'react';
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Item {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

const EstimateGenerator = () => {
  const [estimateTitle, setEstimateTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<Item[]>([{ id: '1', description: '', quantity: 1, unitPrice: 0 }]);
  const [isLoading, setIsLoading] = useState(false);

  const addItem = () => {
    setItems([...items, { id: String(items.length + 1), description: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: string, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const calculateTotalAmount = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const generateEstimate = async () => {
    try {
      setIsLoading(true);
      
      // Insert the estimate into the database using type assertion
      const { data: estimateData, error: estimateError } = await supabase
        .from('estimates' as any)
        .insert({
          title: estimateTitle,
          client_name: clientName,
          client_email: clientEmail,
          total_amount: calculateTotalAmount(),
          issue_date: new Date().toISOString().split('T')[0],
          valid_until: dueDate,
          status: 'pending'
        } as any)
        .select();

      if (estimateError) throw estimateError;
      
      if (!estimateData || !estimateData[0]) {
        throw new Error("Failed to create estimate");
      }
      
      // Get the estimate ID safely
      const estimateId = (estimateData[0] as any).id;

      // Insert each item using type assertion
      const itemsToInsert = items.map(item => ({
        estimate_id: estimateId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.quantity * item.unitPrice
      }));

      const { error: itemsError } = await supabase
        .from('estimate_items' as any)
        .insert(itemsToInsert as any);

      if (itemsError) throw itemsError;

      // Generate a unique share link
      const shareLink = `${window.location.origin}/estimates/view/${estimateId}`;
      
      // Update the estimate with the share link
      const { error: updateError } = await supabase
        .from('estimates' as any)
        .update({ shared_link: shareLink } as any)
        .eq('id', estimateId);

      if (updateError) throw updateError;

      toast({
        title: "Estimate Generated Successfully",
        description: "Your estimate has been saved and can be shared with the client.",
      });

      // Clear the form
      setEstimateTitle("");
      setClientName("");
      setClientEmail("");
      setDueDate("");
      setItems([{ id: '1', description: '', quantity: 1, unitPrice: 0 }]);
    } catch (error: any) {
      toast({
        title: "Error Generating Estimate",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Estimate Generator</CardTitle>
        <CardDescription>Create and manage your estimates.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="estimate-title">Estimate Title</Label>
            <Input
              id="estimate-title"
              placeholder="Estimate Title"
              value={estimateTitle}
              onChange={(e) => setEstimateTitle(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="client-name">Client Name</Label>
            <Input
              id="client-name"
              placeholder="Client Name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="client-email">Client Email</Label>
            <Input
              id="client-email"
              type="email"
              placeholder="Client Email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="due-date">Due Date</Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <h3 className="text-xl font-semibold mt-4">Items</h3>
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
            <div>
              <Label htmlFor={`description-${item.id}`}>Description</Label>
              <Textarea
                id={`description-${item.id}`}
                placeholder="Description"
                value={item.description}
                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`quantity-${item.id}`}>Quantity</Label>
              <Input
                id={`quantity-${item.id}`}
                type="number"
                placeholder="Quantity"
                value={item.quantity}
                onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor={`unit-price-${item.id}`}>Unit Price</Label>
              <Input
                id={`unit-price-${item.id}`}
                type="number"
                placeholder="Unit Price"
                value={item.unitPrice}
                onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value))}
              />
            </div>
            <div className="flex items-center justify-end">
              <Button variant="destructive" size="sm" onClick={() => removeItem(item.id)}>
                <Trash className="h-4 w-4 mr-2" />
                Remove
              </Button>
            </div>
          </div>
        ))}
        <Button variant="secondary" onClick={addItem} className="gap-1 w-full md:w-auto">
          <Plus className="h-4 w-4" />
          Add Item
        </Button>

        <div className="text-right font-bold text-xl">
          Total: ${calculateTotalAmount().toFixed(2)}
        </div>

        <Button className="w-full" onClick={generateEstimate} disabled={isLoading}>
          {isLoading ? "Generating..." : "Generate Estimate"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default EstimateGenerator;
