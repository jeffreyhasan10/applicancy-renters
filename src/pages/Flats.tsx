import React, { useState } from "react";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { PlusCircle, Search, Trash2, MessageSquare, Edit, Building2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import FlatForm from "@/components/forms/FlatForm";
import { typedSupabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DeleteConfirmation from "@/components/common/DeleteConfirmation";
import WhatsAppIntegration from "@/components/integrations/WhatsAppIntegration";
import RentForm from "@/components/forms/RentForm";
import { motion } from "framer-motion";

interface FlatData {
  id: string;
  created_at: string;
  name: string;
  address: string;
  monthly_rent_target: number | null;
  tenants?: {
    id: string;
    phone: string;
  }[] | null;
}

interface Flat {
  id: string;
  created_at: string;
  name: string;
  address: string;
  description: string;
  monthly_rent: number;
  deposit: number;
  bedrooms: number;
  bathrooms: number;
  square_footage: number;
  amenities: string[];
  tenant_id: string | null;
  is_available: boolean;
  property_type: string;
  year_built: number;
  parking_spots: number;
  lease_terms: string;
  images: string[];
  documents: string[];
  tenants?: {
    id: string;
    phone: string;
  }[] | null;
}

const Flats = () => {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [rentOpen, setRentOpen] = useState(false);
  const [selectedFlat, setSelectedFlat] = useState<Flat | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [flatToDelete, setFlatToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string | null>(null);
  const { toast } = useToast();

  const queryClient = useQueryClient();

  // Fetch flats
  const { data: flats, isLoading, isError, error } = useQuery<FlatData[], Error>({
    queryKey: ["flats"],
    queryFn: async () => {
      const { data, error } = await typedSupabase.from("flats").select(`
        *,
        tenants (
          id,
          phone
        )
      `);
      if (error) {
        console.error("Error fetching flats:", error);
        throw new Error(error.message);
      }
      return data as FlatData[];
    },
  });

  // Mutation for deleting a flat
  const deleteFlatMutation = useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      const { data: tenants } = await typedSupabase
        .from("tenants")
        .select("id")
        .eq("flat_id", id);

      if (tenants && tenants.length > 0) {
        const tenantIds = tenants.map((tenant) => tenant.id);
        if (tenantIds.length > 0) {
          const { error: rentsError } = await typedSupabase
            .from("rents")
            .delete()
            .in("tenant_id", tenantIds);
          if (rentsError) {
            console.error("Error deleting associated rents:", rentsError);
            throw new Error(rentsError.message);
          }
        }
        const { error: tenantsError } = await typedSupabase
          .from("tenants")
          .update({ flat_id: null })
          .in("id", tenantIds);
        if (tenantsError) {
          console.error("Error updating tenants:", tenantsError);
          throw new Error(tenantsError.message);
        }
      }

      const { error: photosError } = await typedSupabase
        .from("property_photos")
        .delete()
        .eq("flat_id", id);
      if (photosError) {
        console.error("Error deleting associated photos:", photosError);
        throw new Error(photosError.message);
      }

      const { error: docsError } = await typedSupabase
        .from("property_documents")
        .delete()
        .eq("flat_id", id);
      if (docsError) {
        console.error("Error deleting associated documents:", docsError);
        throw new Error(docsError.message);
      }

      const { error } = await typedSupabase.from("flats").delete().eq("id", id);
      if (error) {
        console.error("Error deleting flat:", error);
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flats"] });
      toast({
        title: "Success",
        description: "Property and associated data deleted successfully.",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      setDeleteOpen(false);
      setFlatToDelete(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete property.",
        className: "bg-red-500 text-white border-none",
      });
      setDeleteOpen(false);
    },
  });

  const filteredFlats = React.useMemo(() => {
    if (!flats) return [];
    return flats.filter((flat) => {
      const searchStr = `${flat.name} ${flat.address}`.toLowerCase();
      return searchStr.includes(searchQuery.toLowerCase());
    });
  }, [flats, searchQuery]);

  const mapFlatToUIModel = (flat: FlatData): Flat => {
    return {
      id: flat.id,
      created_at: flat.created_at,
      name: flat.name,
      address: flat.address,
      description: "",
      monthly_rent: flat.monthly_rent_target ?? 0,
      deposit: 0,
      bedrooms: 0,
      bathrooms: 0,
      square_footage: 0,
      amenities: [],
      tenant_id: null,
      is_available: true,
      property_type: "",
      year_built: 0,
      parking_spots: 0,
      lease_terms: "",
      images: [],
      documents: [],
      tenants: flat.tenants,
    };
  };

  const handleEdit = (flat: FlatData) => {
    setSelectedFlat(mapFlatToUIModel(flat));
    setEditOpen(true);
  };

  const handleDelete = (id: string) => {
    setFlatToDelete(id);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (flatToDelete) {
      deleteFlatMutation.mutate(flatToDelete);
    }
  };

  const handleWhatsAppOpen = (phoneNumber: string | null) => {
    setSelectedPhoneNumber(phoneNumber);
    setWhatsappOpen(true);
  };

  const handleWhatsAppClose = () => {
    setWhatsappOpen(false);
    setSelectedPhoneNumber(null);
  };

  const handleRentRecord = (flat: FlatData) => {
    setSelectedFlat(mapFlatToUIModel(flat));
    setRentOpen(true);
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="min-h-[400px] flex flex-col items-center justify-center bg-gradient-to-b from-luxury-softwhite to-luxury-cream px-4"
      >
        <div className="flex flex-col items-center space-y-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          >
            <Loader2 className="h-12 w-12 text-luxury-gold" />
          </motion.div>
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-luxury-charcoal text-lg font-semibold tracking-wide"
          >
            Loading your properties...
          </motion.p>
        </div>
      </motion.div>
    );
  }

  if (isError) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="p-8 mx-auto max-w-4xl"
      >
        <Card className="border-red-200 bg-red-50 shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="text-red-600 text-xl font-semibold tracking-wide">
              Error Loading Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error?.message || "An error occurred while fetching properties."}</p>
            <p className="mt-4 text-luxury-charcoal">Please try refreshing the page or contact support if the issue persists.</p>
            <Button
              variant="outline"
              className="mt-4 border-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/20"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["flats"] })}
            >
              Retry Loading
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="p-6 bg-luxury-softwhite min-h-screen"
    >
      <PageHeader
        title="Properties"
        description="Manage your properties and their details with ease."
        actionLabel="Add Property"
        actionIcon={<PlusCircle className="mr-2 h-4 w-4" />}
        onActionClick={() => setOpen(true)}
        className="mb-8"
      />

      <Card className="w-full bg-white shadow-lg rounded-xl border border-luxury-cream">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-luxury-charcoal tracking-wide">
            Properties List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="grid gap-4"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-luxury-charcoal" />
              <Input
                type="search"
                placeholder="Search properties..."
                className="pl-10 border-luxury-cream focus:ring-luxury-gold focus:border-luxury-gold"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {filteredFlats.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center p-8"
              >
                <Building2 className="mx-auto h-12 w-12 text-luxury-charcoal/50" />
                <h3 className="mt-2 text-sm font-semibold text-luxury-charcoal">
                  No properties found
                </h3>
                <p className="mt-1 text-sm text-luxury-charcoal/70">
                  {searchQuery ? "No properties match your search criteria." : "Get started by adding your first property."}
                </p>
                <Button
                  onClick={() => setOpen(true)}
                  className="mt-6 bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Property
                </Button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="overflow-x-auto"
              >
                <table className="min-w-full divide-y divide-luxury-cream">
                  <thead className="bg-luxury-cream/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-luxury-charcoal uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-luxury-charcoal uppercase tracking-wider">
                        Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-luxury-charcoal uppercase tracking-wider">
                        Rent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-luxury-charcoal uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-luxury-charcoal uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-luxury-cream">
                    {filteredFlats.map((flat, index) => (
                      <motion.tr
                        key={flat.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * index }}
                        className="hover:bg-luxury-cream/30 transition-colors duration-200"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-luxury-charcoal">
                          {flat.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-luxury-charcoal/80">
                          {flat.address}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-luxury-charcoal">
                          {flat.monthly_rent_target != null
                            ? `₹${flat.monthly_rent_target.toLocaleString()}`
                            : "Not set"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-luxury-charcoal">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              flat.tenants && flat.tenants.length > 0
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {flat.tenants && flat.tenants.length > 0 ? "Occupied" : "Available"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRentRecord(flat)}
                              title="Record Rent"
                              className="border-luxury-cream text-luxury-charcoal hover:bg-luxury-gold/20"
                            >
                              Add Rent
                            </Button>
                            <Button
                              variant="secondary"
                              size="icon"
                              onClick={() => handleEdit(flat)}
                              title="Edit Property"
                              className="text-luxury-charcoal hover:bg-luxury-gold/20"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => handleDelete(flat.id)}
                              disabled={deleteFlatMutation.isLoading}
                              title="Delete Property"
                              className="bg-red-500 hover:bg-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            {flat.tenants && flat.tenants.length > 0 && (
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleWhatsAppOpen(flat.tenants?.[0]?.phone || null)}
                                title="Send WhatsApp"
                                className="border-luxury-cream text-luxury-charcoal hover:bg-luxury-gold/20"
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </motion.div>
        </CardContent>
      </Card>

      <FlatForm open={open} onOpenChange={setOpen} />
      {selectedFlat && editOpen && (
        <FlatForm open={editOpen} onOpenChange={setEditOpen} flat={selectedFlat} />
      )}
      {selectedFlat && rentOpen && (
        <RentForm open={rentOpen} onOpenChange={setRentOpen} />
      )}
      <DeleteConfirmation
        title="Delete Property"
        description={`Are you sure you want to delete ${
          flats?.find((flat) => flat.id === flatToDelete)?.name || "this property"
        }? This action will also remove all associated data including photos, documents, and tenant associations.`}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDelete}
        isLoading={deleteFlatMutation.isLoading}
        itemName={flats?.find((flat) => flat.id === flatToDelete)?.name || "this property"}
      />
      {whatsappOpen && selectedPhoneNumber && (
        <WhatsAppIntegration phone={selectedPhoneNumber} onClose={handleWhatsAppClose} />
      )}
    </motion.div>
  );
};

export default Flats;