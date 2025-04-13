import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { typedSupabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface Flat {
  id: string;
  name: string;
  address: string;
  monthly_rent?: number;
  monthly_rent_target?: number;
  description?: string;
}

interface FormData {
  name: string;
  address: string;
  monthly_rent_target: string;
  description: string;
}

interface FlatFormProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  flat?: Flat;
}

const initialFormData: FormData = {
  name: "",
  address: "",
  monthly_rent_target: "",
  description: "",
};

export default function FlatForm({ open = false, onOpenChange = () => {}, flat }: FlatFormProps) {
  const isEditing = !!flat;
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (flat) {
      setFormData({
        name: flat.name || "",
        address: flat.address || "",
        monthly_rent_target: (flat.monthly_rent_target || flat.monthly_rent || 0).toString(),
        description: flat.description || "",
      });
    } else {
      setFormData(initialFormData);
    }
    setErrors({});
  }, [flat, open]);

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};
    if (!formData.name.trim()) newErrors.name = "Flat name is required";
    if (!formData.address.trim()) newErrors.address = "Address is required";
    if (!formData.monthly_rent_target || isNaN(Number(formData.monthly_rent_target)) || Number(formData.monthly_rent_target) <= 0) {
      newErrors.monthly_rent_target = "Please enter a valid rent amount";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const flatMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (isEditing && flat) {
        const { error } = await typedSupabase
          .flats()
          .update({
            name: data.name.trim(),
            address: data.address.trim(),
            monthly_rent_target: parseFloat(data.monthly_rent_target) || 0,
            description: data.description.trim() || null,
          })
          .eq("id", flat.id);

        if (error) throw new Error(error.message || "Failed to update flat");
        return { success: true, id: flat.id };
      } else {
        const { data: newFlat, error } = await typedSupabase
          .flats()
          .insert({
            name: data.name.trim(),
            address: data.address.trim(),
            monthly_rent_target: parseFloat(data.monthly_rent_target) || 0,
            description: data.description.trim() || null,
          })
          .select();

        if (error) throw new Error(error.message || "Failed to create flat");
        return { success: true, id: newFlat?.[0]?.id };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flats"] });
      toast({
        title: isEditing ? "Flat updated" : "Flat created",
        description: isEditing
          ? `${formData.name} has been updated successfully.`
          : `${formData.name} has been added successfully.`,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || `Failed to ${isEditing ? "update" : "create"} flat.`,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      flatMutation.mutate(formData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleDialogClose = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setFormData(initialFormData);
      setErrors({});
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="w-full max-w-md sm:max-w-lg p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Flat" : "Add Flat"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the flat details below." : "Enter the details for the new flat."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Flat Name
            </Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Flat #101"
              required
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
              className="w-full"
            />
            {errors.name && (
              <p id="name-error" className="text-sm text-destructive">
                {errors.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm font-medium">
              Flat Address
            </Label>
            <Input
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Enter complete address"
              required
              aria-invalid={!!errors.address}
              aria-describedby={errors.address ? "address-error" : undefined}
              className="w-full"
            />
            {errors.address && (
              <p id="address-error" className="text-sm text-destructive">
                {errors.address}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthly_rent_target" className="text-sm font-medium">
              Monthly Rent Target (₹)
            </Label>
            <Input
              id="monthly_rent_target"
              name="monthly_rent_target"
              type="number"
              min="0"
              step="1"
              value={formData.monthly_rent_target}
              onChange={handleChange}
              placeholder="Enter target amount"
              required
              aria-invalid={!!errors.monthly_rent_target}
              aria-describedby={errors.monthly_rent_target ? "rent-error" : undefined}
              className="w-full"
            />
            {errors.monthly_rent_target && (
              <p id="rent-error" className="text-sm text-destructive">
                {errors.monthly_rent_target}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter property description"
              rows={4}
              className="w-full resize-none"
              aria-describedby="description-hint"
            />
            <p id="description-hint" className="text-xs text-muted-foreground">
              Optional: Add details about the flat.
            </p>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-4 pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="w-full sm:w-auto">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={flatMutation.isPending}
              className="w-full sm:w-auto"
            >
              {flatMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                "Update Flat"
              ) : (
                "Add Flat"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}