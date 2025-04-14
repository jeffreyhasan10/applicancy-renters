import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { typedSupabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Expense {
  id?: string;
  flat_id?: string | null;
  title: string;
  amount: number;
  date: string;
  description?: string;
  receipt_id?: string | null;
  category?: string | null;
}

interface Flat {
  id: string;
  name: string;
}

interface ExpenseFormProps {
  expense?: Expense;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function ExpenseForm({
  expense,
  onSuccess,
  open,
  onOpenChange,
}: ExpenseFormProps) {
  const isEditing = !!expense;
  const [formData, setFormData] = useState<Omit<Expense, "id">>({
    flat_id: null,
    title: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
    description: "",
    receipt_id: null,
    category: null,
  });

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available flats
  const { data: flats = [] } = useQuery({
    queryKey: ["flats"],
    queryFn: async () => {
      const { data, error } = await typedSupabase
        .from("flats")
        .select("id, name");
      if (error) throw error;
      // Filter out invalid flats
      const validFlats = data.filter(
        (flat: Flat) =>
          flat.id &&
          flat.id.match(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          )
      );
      if (validFlats.length !== data.length) {
        console.warn(
          "Invalid flat IDs detected:",
          data.filter(
            (flat: Flat) =>
              !flat.id ||
              !flat.id.match(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
              )
          )
        );
      }
      return validFlats as Flat[];
    },
  });

  useEffect(() => {
    if (expense) {
      // Sanitize flat_id and receipt_id
      const sanitizedFlatId =
        expense.flat_id &&
        expense.flat_id !== "" &&
        expense.flat_id.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
          ? expense.flat_id
          : null;
      setFormData({
        flat_id: sanitizedFlatId,
        title: expense.title || "",
        amount: expense.amount || 0,
        date: expense.date || new Date().toISOString().split("T")[0],
        description: expense.description || "",
        receipt_id: expense.receipt_id || null,
        category: expense.category || null,
      });

      // Fetch receipt file path if receipt_id exists
      if (expense.receipt_id) {
        fetchReceiptUrl(expense.receipt_id);
      }
    }
  }, [expense]);

  // Fetch receipt public URL
  const fetchReceiptUrl = async (receiptId: string) => {
    const { data, error } = await typedSupabase
      .from("property_documents")
      .select("file_path")
      .eq("id", receiptId)
      .single();
    if (error) {
      console.error("Error fetching receipt URL:", error);
      return;
    }
    const { data: urlData } = typedSupabase.storage
      .from("property_documents")
      .getPublicUrl(data.file_path);
    setReceiptPreview(urlData.publicUrl);
  };

  // Handle receipt file change
  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReceiptFile(file);

      // Create preview for image files
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setReceiptPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setReceiptPreview(null); // Non-image files won't have a preview
      }
    }
  };

  // Remove receipt
  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    setFormData((prev) => ({ ...prev, receipt_id: null }));
    if (receiptInputRef.current) receiptInputRef.current.value = "";
  };

  // Upload a file to Supabase Storage and create property_documents record
  const uploadReceipt = async (file: File) => {
    const timestamp = new Date().getTime();
    const filePath = `${timestamp}_${file.name}`;
    const { data: uploadData, error: uploadError } = await typedSupabase.storage
      .from("property_documents")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Insert into property_documents
    const { data: docData, error: docError } = await typedSupabase
      .from("property_documents")
      .insert({
        document_type: "receipt",
        file_path: filePath,
        name: file.name,
        uploaded_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (docError) {
      // Cleanup uploaded file if document creation fails
      await typedSupabase.storage.from("property_documents").remove([filePath]);
      throw docError;
    }

    return docData.id;
  };

  // Create/update mutation
  const expenseMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      setIsUploading(true);
      let receiptId = data.receipt_id;

      // Ensure flat_id is null if empty or invalid
      const finalFlatId =
        data.flat_id &&
        data.flat_id !== "" &&
        data.flat_id.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
          ? data.flat_id
          : null;

      try {
        // Upload receipt if provided
        if (receiptFile) {
          receiptId = await uploadReceipt(receiptFile);
        }

        if (isEditing && expense?.id) {
          // Update existing expense
          const { error } = await typedSupabase
            .from("expenses")
            .update({
              flat_id: finalFlatId,
              title: data.title,
              amount: data.amount,
              date: data.date,
              description: data.description || null,
              receipt_id: receiptId || null,
              category: data.category || null,
            })
            .eq("id", expense.id);

          if (error) throw error;
          return { success: true, id: expense.id };
        } else {
          // Create new expense
          const { data: newExpense, error } = await typedSupabase
            .from("expenses")
            .insert({
              flat_id: finalFlatId,
              title: data.title,
              amount: data.amount,
              date: data.date,
              description: data.description || null,
              receipt_id: receiptId || null,
              category: data.category || null,
            })
            .select();

          if (error) throw error;
          return { success: true, id: newExpense?.[0]?.id };
        }
      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({
        title: isEditing ? "Expense updated" : "Expense created",
        description: isEditing
          ? `${formData.title} has been updated successfully.`
          : `${formData.title} has been added successfully.`,
      });
      if (onSuccess) onSuccess();
      if (onOpenChange) onOpenChange(false);

      // Clear file inputs
      setReceiptFile(null);
      setReceiptPreview(null);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || `Failed to ${isEditing ? "update" : "create"} expense.`,
      });
      setIsUploading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.amount < 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Amount cannot be negative.",
      });
      return;
    }
    expenseMutation.mutate(formData);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "amount" ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value === "none" ? null : value,
    }));
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Expense Title</Label>
        <Input
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="Enter expense title"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Amount (₹)</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          value={formData.amount}
          onChange={handleChange}
          placeholder="Enter amount"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          name="date"
          type="date"
          value={formData.date}
          onChange={handleChange}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select
          value={formData.category || "none"}
          onValueChange={(value) => handleSelectChange("category", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="Maintenance">Maintenance</SelectItem>
            <SelectItem value="Utilities">Utilities</SelectItem>
            <SelectItem value="Repairs">Repairs</SelectItem>
            <SelectItem value="Taxes">Taxes</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="flat_id">Assign to Flat</Label>
        <Select
          value={formData.flat_id || "none"}
          onValueChange={(value) => handleSelectChange("flat_id", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select flat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {flats.map((flat) => (
              <SelectItem key={flat.id} value={flat.id}>
                {flat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Enter description"
        />
      </div>

      {/* <div className="space-y-2">
        <Label htmlFor="receipt">Receipt</Label>
        <div className="border rounded-md p-4 space-y-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => receiptInputRef.current?.click()}
            className="w-full flex items-center justify-center"
          >
            <Upload className="mr-2 h-4 w-4" />
            {receiptPreview ? "Change Receipt" : "Upload Receipt"}
          </Button>
          <input
            ref={receiptInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleReceiptChange}
            className="hidden"
          />
          {receiptPreview && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm truncate max-w-xs">
                {receiptFile?.name || "Existing Receipt"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={removeReceipt}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          )}
        </div>
      </div> */}

      <div className="flex justify-end gap-2 pt-4">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button
          type="submit"
          disabled={expenseMutation.isPending || isUploading}
        >
          {(expenseMutation.isPending || isUploading)
            ? "Saving..."
            : isEditing
            ? "Update Expense"
            : "Add Expense"}
        </Button>
      </div>
    </form>
  );

  // If open and onOpenChange props exist, render with Dialog wrapper
  if (open !== undefined && onOpenChange) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Expense" : "Add New Expense"}</DialogTitle>
            <DialogDescription>
              {isEditing ? "Update expense details" : "Enter expense details below"}
            </DialogDescription>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
    );
  }

  // Otherwise, just return the form
  return formContent;
}