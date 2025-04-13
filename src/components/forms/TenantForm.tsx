import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { typedSupabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Upload, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Tenant {
  id?: string;
  name: string;
  email?: string;
  phone: string;
  flat_id?: string | null;
  start_date: string;
  is_active: boolean;
  owner_name?: string;
  tenant_photo?: string;
  documents?: string[];
  tenant_type?: string | null; // New field
}

interface Flat {
  id: string;
  name: string;
}

interface TenantFormProps {
  tenant?: Tenant;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function TenantForm({ tenant, onSuccess, open, onOpenChange }: TenantFormProps) {
  const isEditing = !!tenant;
  const [formData, setFormData] = useState<Omit<Tenant, 'id'>>({
    name: "",
    email: "",
    phone: "",
    flat_id: null,
    start_date: new Date().toISOString().split('T')[0],
    is_active: true,
    owner_name: "",
    tenant_photo: "",
    documents: [],
    tenant_type: null, // Initialize as null
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [documentsToDelete, setDocumentsToDelete] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentsInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available flats
  const { data: flats = [] } = useQuery({
    queryKey: ['flats'],
    queryFn: async () => {
      const { data, error } = await typedSupabase.from('flats').select('id, name');
      if (error) throw error;
      // Filter out invalid flats
      const validFlats = data.filter(
        (flat: Flat) =>
          flat.id && flat.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      );
      if (validFlats.length !== data.length) {
        console.warn(
          'Invalid flat IDs detected:',
          data.filter(
            (flat: Flat) =>
              !flat.id || !flat.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          )
        );
      }
      return validFlats as Flat[];
    },
  });

  useEffect(() => {
    if (tenant) {
      // Sanitize flat_id to ensure it's null if empty or invalid
      const sanitizedFlatId =
        tenant.flat_id && tenant.flat_id !== "" && tenant.flat_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          ? tenant.flat_id
          : null;
      console.log('Tenant flat_id on load:', tenant.flat_id, 'Sanitized:', sanitizedFlatId); // Debug log
      setFormData({
        name: tenant.name || "",
        email: tenant.email || "",
        phone: tenant.phone || "",
        flat_id: sanitizedFlatId,
        start_date: tenant.start_date || new Date().toISOString().split('T')[0],
        is_active: tenant.is_active !== undefined ? tenant.is_active : true,
        owner_name: tenant.owner_name || "",
        tenant_photo: tenant.tenant_photo || "",
        documents: tenant.documents || [],
        tenant_type: tenant.tenant_type || null, // Load tenant_type
      });

      // Set photo preview if tenant has a photo
      if (tenant.tenant_photo) {
        setPhotoPreview(tenant.tenant_photo);
      }
    }
  }, [tenant]);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle document uploads
  const handleDocumentsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setDocumentFiles((prev) => [...prev, ...newFiles]);
    }
  };

  // Remove document from upload list
  const removeDocument = (index: number) => {
    setDocumentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Mark existing document for deletion
  const removeExistingDocument = (path: string) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents?.filter((doc) => doc !== path) || [],
    }));
    setDocumentsToDelete((prev) => [...prev, path]);
  };

  // Upload a file to Supabase Storage
  const uploadFile = async (file: File, bucket: string, path: string) => {
    const { data, error } = await typedSupabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = typedSupabase.storage.from(bucket).getPublicUrl(data.path);
    return publicUrl;
  };

  // Create/update mutation
  const tenantMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      setIsUploading(true);
      let photoUrl = data.tenant_photo;
      let documentUrls = [...(data.documents || [])];

      // Ensure flat_id is null if empty or invalid
      const finalFlatId =
        data.flat_id && data.flat_id !== "" && data.flat_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          ? data.flat_id
          : null;
      console.log('Submitting flat_id:', finalFlatId); // Debug log

      try {
        // Upload tenant photo if provided
        if (photoFile) {
          const timestamp = new Date().getTime();
          const photoPath = `${timestamp}_${photoFile.name}`;
          photoUrl = await uploadFile(photoFile, 'tenant_photos', photoPath);
        }

        // Upload new documents if provided
        if (documentFiles.length > 0) {
          const uploadPromises = documentFiles.map(async (file) => {
            const timestamp = new Date().getTime();
            const docPath = `${timestamp}_${file.name}`;
            return await uploadFile(file, 'tenant_photos', docPath);
          });

          const newDocUrls = await Promise.all(uploadPromises);
          documentUrls = [...documentUrls, ...newDocUrls];
        }

        // Delete marked documents
        for (const docPath of documentsToDelete) {
          const pathParts = docPath.split('/');
          const fileName = pathParts[pathParts.length - 1];
          await typedSupabase.storage.from('tenant_photos').remove([fileName]);
        }

        if (isEditing && tenant?.id) {
          // Update existing tenant
          const { error } = await typedSupabase
            .from('tenants')
            .update({
              name: data.name,
              email: data.email || null,
              phone: data.phone,
              flat_id: finalFlatId,
              start_date: data.start_date,
              is_active: data.is_active,
              owner_name: data.owner_name || null,
              tenant_photo: photoUrl || null,
              documents: documentUrls,
              tenant_type: data.tenant_type || null, // Save tenant_type
            })
            .eq('id', tenant.id);

          if (error) throw error;
          return { success: true, id: tenant.id };
        } else {
          // Create new tenant
          const { data: newTenant, error } = await typedSupabase
            .from('tenants')
            .insert({
              name: data.name,
              email: data.email || null,
              phone: data.phone,
              flat_id: finalFlatId,
              start_date: data.start_date,
              is_active: data.is_active,
              owner_name: data.owner_name || null,
              tenant_photo: photoUrl || null,
              documents: documentUrls,
              tenant_type: data.tenant_type || null, // Save tenant_type
            })
            .select();

          if (error) throw error;
          return { success: true, id: newTenant?.[0]?.id };
        }
      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast({
        title: isEditing ? "Tenant updated" : "Tenant created",
        description: isEditing
          ? `${formData.name} has been updated successfully.`
          : `${formData.name} has been added successfully.`,
      });
      if (onSuccess) onSuccess();
      if (onOpenChange) onOpenChange(false);

      // Clear file inputs and preview
      setPhotoFile(null);
      setPhotoPreview(null);
      setDocumentFiles([]);
      setDocumentsToDelete([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (documentsInputRef.current) documentsInputRef.current.value = '';
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || `Failed to ${isEditing ? 'update' : 'create'} tenant.`,
      });
      setIsUploading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form data on submit:', formData); // Debug log
    tenantMutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    console.log('Select change:', name, value); // Debug log
    setFormData((prev) => ({
      ...prev,
      [name]: value === "none" ? null : value,
    }));
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Tenant Name</Label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter tenant name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tenant_type">Tenant Type</Label>
        <Select
          value={formData.tenant_type || "none"}
          onValueChange={(value) => handleSelectChange('tenant_type', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select tenant type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="Individual">Individual</SelectItem>
            <SelectItem value="Family">Family</SelectItem>
            <SelectItem value="Company">Company</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="owner_name">Owner/Landlord Name</Label>
        <Input
          id="owner_name"
          name="owner_name"
          value={formData.owner_name || ''}
          onChange={handleChange}
          placeholder="Enter owner/landlord name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Enter email address"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          placeholder="Enter phone number"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="flatId">Assign to Flat</Label>
        <Select
          value={formData.flat_id || "none"}
          onValueChange={(value) => handleSelectChange('flat_id', value)}
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
        <Label htmlFor="tenant_photo">Tenant Photo</Label>
        <div className="flex items-center space-x-4">
          <Avatar className="h-16 w-16 border-2 border-gray-200">
            {photoPreview ? (
              <AvatarImage src={photoPreview} alt={formData.name} />
            ) : (
              <AvatarFallback>{formData.name?.charAt(0) || 'T'}</AvatarFallback>
            )}
          </Avatar>
          <div className="flex flex-col space-y-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center"
            >
              <Camera className="mr-2 h-4 w-4" />
              {photoPreview ? 'Change Photo' : 'Add Photo'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {photoPreview && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  setPhotoPreview(null);
                  setPhotoFile(null);
                  setFormData((prev) => ({ ...prev, tenant_photo: '' }));
                }}
                className="flex items-center"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove Photo
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="documents">Documents</Label>
        <div className="border rounded-md p-4 space-y-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => documentsInputRef.current?.click()}
            className="w-full flex items-center justify-center"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Documents
          </Button>
          <input
            ref={documentsInputRef}
            type="file"
            multiple
            onChange={handleDocumentsChange}
            className="hidden"
          />

          {/* List of existing documents */}
          {formData.documents && formData.documents.length > 0 && (
            <div className="space-y-2 mt-3">
              <p className="text-sm font-medium">Existing Documents:</p>
              <ul className="text-sm">
                {formData.documents.map((doc, index) => {
                  const fileName = doc.split('/').pop() || `Document ${index + 1}`;
                  return (
                    <li key={index} className="flex justify-between items-center py-1">
                      <a
                        href={doc}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate max-w-xs"
                      >
                        {fileName}
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeExistingDocument(doc)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* List of new documents to upload */}
          {documentFiles.length > 0 && (
            <div className="space-y-2 mt-3">
              <p className="text-sm font-medium">New Documents to Upload:</p>
              <ul className="text-sm">
                {documentFiles.map((file, index) => (
                  <li key={index} className="flex justify-between items-center py-1">
                    <span className="truncate max-w-xs">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDocument(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="start_date">Start Date</Label>
        <Input
          id="start_date"
          name="start_date"
          type="date"
          value={formData.start_date}
          onChange={handleChange}
          required
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancel</Button>
        </DialogClose>
        <Button
          type="submit"
          disabled={tenantMutation.isPending || isUploading}
        >
          {(tenantMutation.isPending || isUploading) ? "Saving..." : isEditing ? "Update Tenant" : "Add Tenant"}
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
            <DialogTitle>{isEditing ? "Edit Tenant" : "Add New Tenant"}</DialogTitle>
            <DialogDescription>
              {isEditing ? "Update tenant information" : "Enter tenant details below"}
            </DialogDescription>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
    );
  }

  // Otherwise, just return the form (for backward compatibility)
  return formContent;
}