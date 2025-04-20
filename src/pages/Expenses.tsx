import React, { useState, useMemo } from "react";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import {
  PlusCircle,
  Search,
  Trash2,
  Edit,
  Loader2,
  FileText,
  IndianRupee,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import ExpenseForm from "@/components/forms/ExpenseForm";
import { typedSupabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DeleteConfirmation from "@/components/common/DeleteConfirmation";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  description?: string | null;
  category?: string | null;
  flat_id?: string | null;
  flats?: {
    name: string;
  } | null;
  receipt_id?: string | null;
  calendar_event_id?: string | null;
}

const Expenses: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    null,
    null,
  ]);
  const [startDate, endDate] = dateRange;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch expenses
  const { data: expenses = [], isLoading, error } = useQuery<Expense[], Error>({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await typedSupabase
        .from("expenses")
        .select(`
          *,
          flats (
            name
          )
        `);
      if (error) {
        console.error("Error fetching expenses:", error);
        throw error;
      }
      return data.map((expense) => ({
        ...expense,
        amount: parseFloat(expense.amount as unknown as string) || 0,
        description: expense.description || null,
      })) as Expense[];
    },
  });

  // Mutation for deleting an expense
  const deleteExpenseMutation = useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      const { data: expense, error: expenseError } = await typedSupabase
        .from("expenses")
        .select("receipt_id, calendar_event_id")
        .eq("id", id)
        .single();

      if (expenseError) {
        console.error("Error fetching expense for deletion:", expenseError);
        throw expenseError;
      }

      // Delete associated calendar event if exists
      if (expense?.calendar_event_id) {
        const { error: eventError } = await typedSupabase
          .from("calendar_events")
          .delete()
          .eq("id", expense.calendar_event_id);
        if (eventError) {
          console.error("Error deleting calendar event:", eventError);
          throw eventError;
        }
      }

      if (expense?.receipt_id) {
        const { data: doc, error: docFetchError } = await typedSupabase
          .from("property_documents")
          .select("file_path")
          .eq("id", expense.receipt_id)
          .single();

        if (docFetchError) {
          console.error("Error fetching receipt document:", docFetchError);
          throw docFetchError;
        }

        if (doc?.file_path) {
          const { error: storageError } = await typedSupabase.storage
            .from("property_documents")
            .remove([doc.file_path]);
          if (storageError) {
            console.error("Error deleting receipt from storage:", storageError);
            throw storageError;
          }
        }

        const { error: docError } = await typedSupabase
          .from("property_documents")
          .delete()
          .eq("id", expense.receipt_id);
        if (docError) {
          console.error("Error deleting receipt document:", docError);
          throw docError;
        }
      }

      const { error } = await typedSupabase
        .from("expenses")
        .delete()
        .eq("id", id);
      if (error) {
        console.error("Error deleting expense:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({
        title: "Success",
        description: "Expense deleted successfully.",
        className: "bg-luxury-gold text-luxury-charcoal border-none",
      });
      setDeleteOpen(false);
      setExpenseToDelete(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete expense.",
        className: "bg-red-500 text-white border-none",
      });
      setDeleteOpen(false);
    },
  });

  // Filter expenses based on search query and date range
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const searchStr = `${expense.title} ${expense.description || ""}`.toLowerCase();
      const matchesSearch = searchStr.includes(searchQuery.toLowerCase());

      const expenseDate = new Date(expense.date);
      const matchesDateRange =
        (!startDate || expenseDate >= startDate) &&
        (!endDate || expenseDate <= endDate);

      return matchesSearch && matchesDateRange;
    });
  }, [expenses, searchQuery, startDate, endDate]);

  const handleEdit = (expense: Expense) => {
    setSelectedExpense(expense);
    setEditOpen(true);
  };

  const handleDelete = (id: string) => {
    setExpenseToDelete(id);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (expenseToDelete) {
      deleteExpenseMutation.mutate(expenseToDelete);
    }
  };

  // Format date safely
  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Invalid Date";
    }
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
            Loading your expenses...
          </motion.p>
        </div>
      </motion.div>
    );
  }

  if (error) {
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
              Error Loading Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error.message || "An error occurred while fetching expenses."}</p>
            <p className="mt-4 text-luxury-charcoal">Please try refreshing the page or contact support if the issue persists.</p>
            <Button
              variant="outline"
              className="mt-4 border-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/20"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["expenses"] })}
            >
              Retry Loading
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="p-6 bg-luxury-softwhite min-h-screen"
      >
        <PageHeader
          title="Expenses"
          description="Manage your property-related expenses with ease."
          actionLabel="Add Expense"
          actionIcon={<PlusCircle className="mr-2 h-4 w-4" />}
          onActionClick={() => setOpen(true)}
          className="mb-8"
        />

        <Card className="w-full bg-white shadow-lg rounded-xl border border-luxury-cream">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-luxury-charcoal tracking-wide">
              Expenses List
            </CardTitle>
          </CardHeader>
          <CardContent>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="grid gap-4"
            >
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-luxury-charcoal" />
                  <Input
                    type="search"
                    placeholder="Search expenses..."
                    className="pl-10 border-luxury-cream focus:ring-luxury-gold focus:border-luxury-gold"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search expenses"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-luxury-charcoal" />
                  <DatePicker
                    selectsRange
                    startDate={startDate}
                    endDate={endDate}
                    onChange={(update: [Date | null, Date | null]) => {
                      setDateRange(update);
                    }}
                    isClearable
                    placeholderText="Select date range"
                    className="border-luxury-cream focus:ring-luxury-gold focus:border-luxury-gold rounded-md p-2 w-full sm:w-auto"
                    wrapperClassName="w-full sm:w-auto"
                  />
                </div>
              </div>

              {filteredExpenses.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-center p-8"
                >
                  <IndianRupee className="mx-auto h-12 w-12 text-luxury-charcoal/50" />
                  <h3 className="mt-2 text-sm font-semibold text-luxury-charcoal">
                    No expenses found
                  </h3>
                  <p className="mt-1 text-sm text-luxury-charcoal/70">
                    {searchQuery || startDate || endDate
                      ? "No expenses match your search or date criteria."
                      : "Get started by adding your first expense."}
                  </p>
                  <Button
                    onClick={() => setOpen(true)}
                    className="mt-6 bg-luxury-gold text-luxury-charcoal hover:bg-luxury-gold/80"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Expense
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
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-luxury-charcoal uppercase tracking-wider"
                        >
                          Title
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-luxury-charcoal uppercase tracking-wider"
                        >
                          Amount
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-luxury-charcoal uppercase tracking-wider"
                        >
                          Date
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-luxury-charcoal uppercase tracking-wider"
                        >
                          Category
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-luxury-charcoal uppercase tracking-wider"
                        >
                          Property
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-luxury-charcoal uppercase tracking-wider"
                        >
                          Description
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-right text-xs font-medium text-luxury-charcoal uppercase tracking-wider"
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-luxury-cream">
                      {filteredExpenses.map((expense, index) => (
                        <motion.tr
                          key={expense.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 * index }}
                          className="hover:bg-luxury-cream/30 transition-colors duration-200"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-luxury-charcoal">
                            {expense.title}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-luxury-charcoal">
                            ₹{Number(expense.amount).toLocaleString("en-IN")}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-luxury-charcoal">
                            {formatDate(expense.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-luxury-charcoal">
                            {expense.category || "None"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-luxury-charcoal">
                            {expense.flats?.name ?? "Unassigned"}
                          </td>
                          <td className="px-6 py-4 text-sm text-luxury-charcoal">
                            <Tooltip>
                              <TooltipTrigger>
                                <span className="line-clamp-1">
                                  {expense.description || "No description"}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{expense.description || "No description"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              {expense.receipt_id && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={async () => {
                                    try {
                                      const { data: doc, error: docFetchError } = await typedSupabase
                                        .from("property_documents")
                                        .select("file_path")
                                        .eq("id", expense.receipt_id)
                                        .single();
              
                                      if (docFetchError || !doc?.file_path) {
                                        throw new Error("Failed to fetch receipt file path.");
                                      }
              
                                      const { data: publicUrlData } = typedSupabase.storage
                                        .from("property_documents")
                                        .getPublicUrl(doc.file_path);
              
                                      if (!publicUrlData.publicUrl) {
                                        throw new Error("Failed to generate public URL for receipt.");
                                      }
              
                                      window.open(publicUrlData.publicUrl, "_blank");
                                    } catch (error: any) {
                                      toast({
                                        variant: "destructive",
                                        title: "Error",
                                        description: error.message || "Failed to view receipt.",
                                      });
                                    }
                                  }}
                                  title="View Receipt"
                                  className="text-luxury-charcoal hover:bg-luxury-gold/20"
                                  aria-label="View receipt"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="secondary"
                                size="icon"
                                onClick={() => handleEdit(expense)}
                                title="Edit Expense"
                                className="text-luxury-charcoal hover:bg-luxury-gold/20"
                                aria-label="Edit expense"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => handleDelete(expense.id)}
                                disabled={deleteExpenseMutation.isPending}
                                title="Delete Expense"
                                className="bg-red-500 hover:bg-red-600"
                                aria-label="Delete expense"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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

        <ExpenseForm open={open} onOpenChange={setOpen} />
        {selectedExpense && editOpen && (
          <ExpenseForm
            open={editOpen}
            onOpenChange={setEditOpen}
            expense={selectedExpense}
          />
        )}
        <DeleteConfirmation
          title="Delete Expense"
          description={`Are you sure you want to delete ${
            expenses.find((expense) => expense.id === expenseToDelete)?.title || "this expense"
          }? This action cannot be undone and will remove any associated receipt and calendar event.`}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onConfirm={confirmDelete}
          isLoading={deleteExpenseMutation.isPending}
          itemName={expenses.find((expense) => expense.id === expenseToDelete)?.title || "this expense"}
        />
      </motion.div>
    </TooltipProvider>
  );
};

export default Expenses;