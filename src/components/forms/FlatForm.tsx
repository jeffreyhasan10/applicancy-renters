import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { typedSupabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import type { Database } from "@/integrations/supabase/types";

type Flat = {
  id: string;
  name: string;
  address: string;
  monthly_rent_target: number;
  description: string | null;
  created_at: string;
  security_deposit: number | null;
};

interface FormData {
  name: string;
  address: string;
  monthly_rent_target: string;
  security_deposit: string;
  description: string;
  created_at: string;
}

interface FlatFormProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  flat?: Flat;
  onSuccess?: () => void;
}

const initialFormData: FormData = {
  name: "",
  address: "",
  monthly_rent_target: "",
  security_deposit: "",
  description: "",
  created_at: new Date().toISOString().split('T')[0]
};

export default function FlatForm({ open = false, onOpenChange = () => {}, flat, onSuccess }: FlatFormProps) {
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
        monthly_rent_target: (flat.monthly_rent_target || 0).toString(),
        security_deposit: (flat.security_deposit || "").toString(),
        description: flat.description || "",
        created_at: flat.created_at ? new Date(flat.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
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
    if (
      !formData.monthly_rent_target ||
      isNaN(Number(formData.monthly_rent_target)) ||
      Number(formData.monthly_rent_target) <= 0
    ) {
      newErrors.monthly_rent_target = "Please enter a valid rent amount";
    }
    if (
      formData.security_deposit &&
      (isNaN(Number(formData.security_deposit)) || Number(formData.security_deposit) < 0)
    ) {
      newErrors.security_deposit = "Please enter a valid security deposit amount";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const flatMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const flatData = {
        name: data.name.trim(),
        address: data.address.trim(),
        monthly_rent_target: parseFloat(data.monthly_rent_target) || 0,
        security_deposit: data.security_deposit ? parseFloat(data.security_deposit) : null,
        description: data.description.trim() || null,
        created_at: data.created_at
      };

      if (isEditing && flat) {
        const { error } = await typedSupabase
          .from("flats")
          .update(flatData)
          .eq("id", flat.id);
        if (error) throw new Error(error.message || "Failed to update flat");
        return { success: true, id: flat.id };
      } else {
        const { data: newFlat, error } = await typedSupabase
          .from("flats")
          .insert(flatData)
          .select()
          .single();
        if (error) throw new Error(error.message || "Failed to create flat");
        return { success: true, id: newFlat.id };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flats"] });
      queryClient.invalidateQueries({ queryKey: ["flat", flat?.id] });
      toast({
        title: isEditing ? "Flat updated" : "Flat created",
        description: isEditing
          ? `${formData.name} has been updated successfully.`
          : `${formData.name} has been added successfully.`,
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      if (onSuccess) onSuccess();
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
      <DialogContent className="max-w-md sm:max-w-lg md:max-w-xl p-4 sm:p-5 overflow-y-auto max-h-[90vh] bg-white border border-luxury-cream">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-lg font-semibold text-luxury-charcoal">
            {isEditing ? "Edit Flat" : "Add Flat"}
          </DialogTitle>
          <DialogDescription className="text-sm text-luxury-charcoal/70">
            {isEditing ? "Update the flat details below." : "Enter the details for the new flat."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Flat Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-luxury-charcoal">
                Flat Name*
              </Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Flat #101"
                required
                className="border-luxury-cream focus:ring-luxury-gold focus:border-luxury-gold"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "name-error" : undefined}
              />
              {errors.name && (
                <p id="name-error" className="text-xs text-destructive mt-1">
                  {errors.name}
                </p>
              )}
            </div>

            {/* Monthly Rent Target */}
            <div className="space-y-1.5">
              <Label htmlFor="monthly_rent_target" className="text-sm font-medium text-luxury-charcoal">
                Monthly Rent (₹)*
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
                className="border-luxury-cream focus:ring-luxury-gold focus:border-luxury-gold"
                aria-invalid={!!errors.monthly_rent_target}
                aria-describedby={errors.monthly_rent_target ? "rent-error" : undefined}
              />
              {errors.monthly_rent_target && (
                <p id="rent-error" className="text-xs text-destructive mt-1">
                  {errors.monthly_rent_target}
                </p>
              )}
            </div>
          </div>

          {/* Security Deposit */}
          <div className="space-y-1.5">
            <Label htmlFor="security_deposit" className="text-sm font-medium text-luxury-charcoal">
              Security Deposit (₹)
            </Label>
            <Input
              id="security_deposit"
              name="security_deposit"
              type="number"
              min="0"
              step="1"
              value={formData.security_deposit}
              onChange={handleChange}
              placeholder="Enter deposit amount"
              className="border-luxury-cream focus:ring-luxury-gold focus:border-luxury-gold"
              aria-invalid={!!errors.security_deposit}
              aria-describedby={errors.security_deposit ? "deposit-error" : undefined}
            />
            {errors.security_deposit && (
              <p id="deposit-error" className="text-xs text-destructive mt-1">
                {errors.security_deposit}
              </p>
            )}
            <p className="text-xs text-luxury-charcoal/70 mt-1">
              Specify the security deposit for the flat
            </p>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-sm font-medium text-luxury-charcoal">
              Address*
            </Label>
            <Input
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Enter complete address"
              required
              className="border-luxury-cream focus:ring-luxury-gold focus:border-luxury-gold"
              aria-invalid={!!errors.address}
              aria-describedby={errors.address ? "address-error" : undefined}
            />
            {errors.address && (
              <p id="address-error" className="text-xs text-destructive mt-1">
                {errors.address}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm font-medium text-luxury-charcoal">
              Description
            </Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter property description"
              rows={3}
              className="resize-none border-luxury-cream focus:ring-luxury-gold focus:border-luxury-gold"
              aria-describedby="description-hint"
            />
            <p id="description-hint" className="text-xs text-luxury-charcoal/70">
              Optional: Add details about the flat
            </p>
          </div>

          {/* Created Date */}
          <div className="space-y-1.5">
            <Label htmlFor="created_at" className="text-sm font-medium text-luxury-charcoal">
              Created Date
            </Label>
            <Input
              id="created_at"
              name="created_at"
              type="date"
              value={formData.created_at}
              onChange={handleChange}
              className="border-luxury-cream focus:ring-luxury-gold focus:border-luxury-gold"
            />
          </div>

          <DialogFooter className="pt-2 flex gap-3">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-24 border-luxury-cream text-luxury-charcoal hover:bg-luxury-gold/20"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={flatMutation.isPending}
              size="sm"
              className="w-full sm:w-32 bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
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