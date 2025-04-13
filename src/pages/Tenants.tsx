import { Plus, Search, Users2, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { typedSupabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import PageHeader from "@/components/common/PageHeader";

type Tenant = {
  id: string;
  name: string;
  email?: string;
  phone: string;
  flat_id?: string;
  start_date: string;
  is_active: boolean;
  tenant_photo?: string;
  flat_name?: string;
};

type Flat = {
  id: string;
  name: string;
};

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [tenantsPerPage] = useState(5);
  const [tenantToDelete, setTenantToDelete] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    flat_id: "",
    start_date: "",
    is_active: true,
    tenant_photo: "",
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const { toast } = useToast();

  // Fetch tenants and flats
  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch tenants
      const { data: tenantData, error: tenantError } = await typedSupabase
        .from("tenants")
        .select(`
          *,
          flat:flats(name)
        `);

      if (tenantError) throw tenantError;

      const formattedTenants = (tenantData || []).map((tenant: any) => ({
        ...tenant,
        flat_name: tenant.flat?.name || "-",
      }));

      setTenants(formattedTenants);

      // Fetch flats for the form dropdown
      const { data: flatData, error: flatError } = await typedSupabase
        .from("flats")
        .select("id, name");

      if (flatError) throw flatError;

      setFlats(flatData || []);
    } catch (error: any) {
      toast({
        title: "Error fetching data",
        description: error.message || "There was an error fetching the data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle delete tenant
  const handleDeleteTenant = async () => {
    if (!tenantToDelete) {
      toast({
        title: "Error",
        description: "No tenant selected for deletion",
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
      return;
    }

    try {
      setDeleteInProgress(true);

      // Verify tenant exists
      const { data: tenantExists, error: checkError } = await typedSupabase
        .from("tenants")
        .select("id")
        .eq("id", tenantToDelete)
        .single();

      if (checkError || !tenantExists) {
        throw new Error("Tenant does not exist");
      }

      // Delete related records
      const tablesToClear = [
        { table: "rents", errorMsg: "Failed to delete related rent records" },
        {
          table: "tenant_furniture",
          errorMsg: "Failed to delete related furniture records",
        },
        {
          table: "property_documents",
          errorMsg: "Failed to delete related document records",
        },
        {
          table: "whatsapp_messages",
          errorMsg: "Failed to delete related WhatsApp messages",
        },
        {
          table: "payment_links",
          errorMsg: "Failed to delete related payment links",
        },
        { table: "estimates", errorMsg: "Failed to delete related estimates" },
        { table: "reminders", errorMsg: "Failed to delete related reminders" },
      ];

      for (const { table, errorMsg } of tablesToClear) {
        const { error } = await typedSupabase
          .from(table)
          .delete()
          .eq("tenant_id", tenantToDelete);
        if (error) throw new Error(errorMsg);
      }

      // Delete the tenant
      const { error: deleteError } = await typedSupabase
        .from("tenants")
        .delete()
        .eq("id", tenantToDelete);

      if (deleteError) throw new Error("Failed to delete tenant");

      toast({
        title: "Success",
        description: "Tenant and all related records deleted successfully",
      });

      setTenants([]);
      await fetchData();
      setCurrentPage(1);
    } catch (error: any) {
      toast({
        title: "Error deleting tenant",
        description: error.message || "There was an error deleting the tenant",
        variant: "destructive",
      });
    } finally {
      setDeleteInProgress(false);
      setTenantToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  // Open delete dialog
  const openDeleteDialog = (id: string) => {
    setTenantToDelete(id);
    setDeleteDialogOpen(true);
  };

  // Open form for creating or editing
  const openForm = (tenant?: Tenant) => {
    if (tenant) {
      setEditTenant(tenant);
      setFormData({
        name: tenant.name || "",
        email: tenant.email || "",
        phone: tenant.phone || "",
        flat_id: tenant.flat_id || "",
        start_date: tenant.start_date || "",
        is_active: tenant.is_active ?? true,
        tenant_photo: tenant.tenant_photo || "",
      });
    } else {
      setEditTenant(null);
      setFormData({
        name: "",
        email: "",
        phone: "",
        flat_id: "",
        start_date: "",
        is_active: true,
        tenant_photo: "",
      });
    }
    setFormOpen(true);
  };

  // Handle form submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);

    try {
      if (editTenant?.id) {
        // Update existing tenant
        const { error } = await typedSupabase
          .from("tenants")
          .update({
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone,
            flat_id: formData.flat_id || null,
            start_date: formData.start_date,
            is_active: formData.is_active,
            tenant_photo: formData.tenant_photo || null,
          })
          .eq("id", editTenant.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Tenant updated successfully",
        });
      } else {
        // Create new tenant
        const { error } = await typedSupabase.from("tenants").insert([
          {
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone,
            flat_id: formData.flat_id || null,
            start_date: formData.start_date,
            is_active: formData.is_active,
            tenant_photo: formData.tenant_photo || null,
          },
        ]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Tenant created successfully",
        });
      }

      setFormOpen(false);
      setEditTenant(null);
      setFormData({
        name: "",
        email: "",
        phone: "",
        flat_id: "",
        start_date: "",
        is_active: true,
        tenant_photo: "",
      });
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save tenant",
        variant: "destructive",
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Filter tenants
  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch =
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.flat_name?.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeFilter === "all") return matchesSearch;
    if (activeFilter === "active") return matchesSearch && tenant.is_active;
    if (activeFilter === "inactive") return matchesSearch && !tenant.is_active;

    return matchesSearch;
  });

  // Pagination
  const indexOfLastTenant = currentPage * tenantsPerPage;
  const indexOfFirstTenant = indexOfLastTenant - tenantsPerPage;
  const currentTenants = filteredTenants.slice(
    indexOfFirstTenant,
    indexOfLastTenant
  );
  const totalPages = Math.ceil(filteredTenants.length / tenantsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Tenants"
        description="Manage your tenants"
        action={
          <Button className="gap-1" onClick={() => openForm()}>
            <Plus className="h-4 w-4" />
            Add Tenant
          </Button>
        }
      />

      {/* Tenant Form Modal */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTenant ? "Edit Tenant" : "Add Tenant"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="flat_id">Flat</Label>
              <select
                id="flat_id"
                value={formData.flat_id}
                onChange={(e) =>
                  setFormData({ ...formData, flat_id: e.target.value })
                }
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
              >
                <option value="">Select a flat</option>
                {flats.map((flat) => (
                  <option key={flat.id} value={flat.id}>
                    {flat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                id="is_active"
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
            <div>
              <Label htmlFor="tenant_photo">Photo URL</Label>
              <Input
                id="tenant_photo"
                value={formData.tenant_photo}
                onChange={(e) =>
                  setFormData({ ...formData, tenant_photo: e.target.value })
                }
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={formSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={formSubmitting}>
                {formSubmitting
                  ? editTenant
                    ? "Updating..."
                    : "Creating..."
                  : editTenant
                  ? "Update Tenant"
                  : "Create Tenant"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <div className="relative w-full sm:w-64">
            <Input
              placeholder="Search tenants..."
              className="pl-10 pr-3 py-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
          </div>

          <div className="flex space-x-2 overflow-x-auto">
            <Button
              variant={activeFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter("all")}
            >
              All Tenants
            </Button>
            <Button
              variant={activeFilter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter("active")}
            >
              Active
            </Button>
            <Button
              variant={activeFilter === "inactive" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter("inactive")}
            >
              Inactive
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-32 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center text-center">
            <Users2 className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">
              No tenants found
            </h3>
            <p className="text-gray-500 mt-1">
              {searchQuery
                ? "Try adjusting your search criteria"
                : "Get started by adding a new tenant"}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Name
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Contact
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Flat
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Start Date
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentTenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {tenant.tenant_photo ? (
                            <img
                              src={tenant.tenant_photo}
                              alt={`${tenant.name}'s photo`}
                              className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                              onError={(e) => {
                                e.currentTarget.src = "/default-avatar.png";
                              }}
                            />
                          ) : (
                            <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-primary-100 rounded-full">
                              <span className="text-primary-700 font-medium">
                                {tenant.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </span>
                            </div>
                          )}
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {tenant.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {tenant.email || "-"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {tenant.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {tenant.flat_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(tenant.start_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            tenant.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {tenant.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          to={`/tenant/${tenant.id}`}
                          className="text-primary-600 hover:text-primary-900 mr-3"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => openForm(tenant)}
                          className="text-primary-600 hover:text-primary-900 mr-3"
                        >
                          <Edit2 className="h-4 w-4 inline" />
                        </button>
                        <button
                          onClick={() => openDeleteDialog(tenant.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => paginate(Math.max(1, currentPage - 1))}
                        className={
                          currentPage === 1
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>

                    {[...Array(totalPages)].map((_, i) => {
                      if (
                        i === 0 ||
                        i === totalPages - 1 ||
                        (i >= currentPage - 2 && i <= currentPage)
                      ) {
                        return (
                          <PaginationItem key={i}>
                            <PaginationLink
                              onClick={() => paginate(i + 1)}
                              isActive={currentPage === i + 1}
                            >
                              {i + 1}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }
                      if (i === 1 && currentPage > 3) {
                        return (
                          <PaginationItem key="ellipsis-1">
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                      if (
                        i === totalPages - 2 &&
                        currentPage < totalPages - 2
                      ) {
                        return (
                          <PaginationItem key="ellipsis-2">
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                      return null;
                    })}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() =>
                          paginate(Math.min(totalPages, currentPage + 1))
                        }
                        className={
                          currentPage === totalPages
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tenant? This action cannot be
              undone and will also delete all related records (rents, documents,
              etc.).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInProgress}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTenant}
              disabled={deleteInProgress}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
            >
              {deleteInProgress ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}