import {
  Building2,
  IndianRupee,
  Package2,
  Send,
  Link,
  Loader2,
} from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import QuickAction from "@/components/dashboard/QuickAction";
import RecentActivities from "@/components/dashboard/RecentActivities";
import RentCollection from "@/components/dashboard/RentCollection";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import FlatForm from "@/components/forms/FlatForm";
import RentForm from "@/components/forms/RentForm";
import InventoryForm from "@/components/forms/InventoryForm";
import ReminderForm from "@/components/forms/ReminderForm";
import ExpenseForm from "@/components/forms/ExpenseForm";
import PageHeader from "@/components/common/PageHeader";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface DashboardStats {
  totalExpenses: number;
  pendingRents: {
    count: number;
    amount: number;
  };
  currentMonthRevenue: number;
  totalFlats: number;
  occupiedFlats: number;
}

interface Stat {
  title: string;
  value: string;
  description: string;
  icon: JSX.Element;
  trendValue: number;
  trendText: string;
  className?: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalExpenses: 0,
    pendingRents: { count: 0, amount: 0 },
    currentMonthRevenue: 0,
    totalFlats: 0,
    occupiedFlats: 0,
  });
  const [loading, setLoading] = useState(true);
  const [modalStates, setModalStates] = useState({
    flat: false,
    rent: false,
    inventory: false,
    reminder: false,
    expense: false,
  });

  const toggleModal = (type: keyof typeof modalStates) => {
    setModalStates((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch total expenses
      const currentYear = new Date().getFullYear();
      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select("amount")
        .gte("date", `${currentYear}-01-01`)
        .lte("date", `${currentYear}-12-31`);

      if (expensesError) throw new Error(expensesError.message);

      const totalExpenses = (expensesData || []).reduce(
        (sum, expense) => sum + (parseFloat(expense.amount) || 0),
        0
      );

      // Fetch pending rents
      const currentDate = new Date().toISOString().split("T")[0];
      const { data: pendingRentsData, error: pendingRentsError } = await supabase
        .from("rents")
        .select("amount")
        .eq("is_paid", false)
        .lte("due_date", currentDate);

      if (pendingRentsError) throw new Error(pendingRentsError.message);

      const pendingRentsAmount = (pendingRentsData || []).reduce(
        (sum, rent) => sum + (parseFloat(rent.amount) || 0),
        0
      );

      // Fetch current month revenue
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: revenueData, error: revenueError } = await supabase
        .from("rents")
        .select("amount, paid_on")
        .eq("is_paid", true)
        .not("paid_on", "is", null);

      if (revenueError) throw new Error(revenueError.message);

      const currentMonthRevenue = (revenueData || [])
        .filter((rent) => rent.paid_on?.startsWith(currentMonth))
        .reduce((sum, rent) => sum + (parseFloat(rent.amount) || 0), 0);

      // Fetch total flats
      const { data: flatsData, error: flatsError } = await supabase
        .from("flats")
        .select("id");

      if (flatsError) throw new Error(flatsError.message);

      // Fetch occupied flats
      const { data: occupiedFlatsData, error: occupiedFlatsError } = await supabase
        .from("tenants")
        .select("flat_id")
        .eq("is_active", true)
        .not("flat_id", "is", null);

      if (occupiedFlatsError) throw new Error(occupiedFlatsError.message);

      const uniqueOccupiedFlats = [
        ...new Set(
          (occupiedFlatsData || [])
            .map((item) => item.flat_id)
            .filter((id): id is string => !!id)
        ),
      ];

      setStats({
        totalExpenses,
        pendingRents: {
          count: pendingRentsData?.length || 0,
          amount: pendingRentsAmount,
        },
        currentMonthRevenue,
        totalFlats: flatsData?.length || 0,
        occupiedFlats: uniqueOccupiedFlats.length,
      });
    } catch (error: any) {
      console.error("Dashboard fetch error:", error);
      toast({
        title: "Error fetching dashboard data",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
        className: "bg-red-500 text-white border-none",
      });
    } finally {
      setLoading(false);
    }
  };

  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleFormSuccess = () => {
    console.log("Form submission succeeded, refreshing dashboard data");
    fetchDashboardData();
  };

  const formattedStats: Stat[] = [
    {
      title: "Total Expenses",
      value: loading ? "..." : `₹${stats.totalExpenses.toLocaleString()}`,
      description: "This year",
      icon: <IndianRupee className="h-6 w-6 text-luxury-gold" />,
      trendValue: 0,
      trendText: "from last year",
    },
    {
      title: "Pending Rents",
      value: loading ? "..." : `₹${stats.pendingRents.amount.toLocaleString()}`,
      description: loading ? "..." : `${stats.pendingRents.count} tenants`,
      icon: <IndianRupee className="h-6 w-6 text-amber-500" />,
      trendValue: 0,
      trendText: "from last month",
    },
    {
      title: "This Month Revenue",
      value: loading ? "..." : `₹${stats.currentMonthRevenue.toLocaleString()}`,
      description: new Date().toLocaleString("default", {
        month: "long",
        year: "numeric",
      }),
      icon: <IndianRupee className="h-6 w-6 text-emerald-500" />,
      trendValue: 0,
      trendText: "from last month",
    },
    {
      title: "Total Properties",
      value: loading ? "..." : stats.totalFlats.toString(),
      description: loading ? "..." : `${stats.occupiedFlats} occupied`,
      icon: <Building2 className="h-6 w-6 text-blue-500" />,
      trendValue: 0,
      trendText: "from last month",
    },
  ];

  const quickActions = [
    {
      icon: <IndianRupee className="h-6 w-6 text-luxury-charcoal" />,
      label: "Add Expense",
      onClick: () => toggleModal("expense"),
    },
    {
      icon: <Building2 className="h-6 w-6 text-luxury-charcoal" />,
      label: "Add Flat",
      onClick: () => toggleModal("flat"),
    },
    {
      icon: <IndianRupee className="h-6 w-6 text-luxury-charcoal" />,
      label: "Record Rent",
      onClick: () => toggleModal("rent"),
    },
    {
      icon: <Package2 className="h-6 w-6 text-luxury-charcoal" />,
      label: "Inventory",
      onClick: () => toggleModal("inventory"),
    },
    {
      icon: <Send className="h-6 w-6 text-luxury-charcoal" />,
      label: "Reminders",
      onClick: () => toggleModal("reminder"),
    },
    {
      icon: <Link className="h-6 w-6 text-luxury-charcoal" />,
      label: "Payment Links",
      onClick: () => navigate("/payment-links"),
    },
  ];

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-luxury-softwhite to-luxury-cream px-4"
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
            Loading your dashboard...
          </motion.p>
        </div>
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
        title="Dashboard"
        description="Welcome to your Applicancy Renters"
        className="mb-8"
      />

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {formattedStats.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 * index }}
          >
            <StatCard
              {...stat}
              className="bg-white shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-xl border border-luxury-cream"
            />
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8"
      >
        <h2 className="text-xl font-semibold text-luxury-charcoal mb-4 tracking-wide">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-4">
          {quickActions.map((action, index) => (
            <motion.div
              key={index}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 * index }}
              whileHover={{ scale: 1.05 }}
            >
              <QuickAction
                icon={action.icon}
                label={action.label}
                onClick={action.onClick}
                className="bg-luxury-cream hover:bg-luxury-gold/20 transition-colors duration-200 rounded-lg"
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <div className="lg:col-span-2">
          <RentCollection className="bg-white shadow-lg rounded-xl border border-luxury-cream" />
        </div>
        <div>
          <RecentActivities className="bg-white shadow-lg rounded-xl border border-luxury-cream" />
        </div>
      </motion.div>

      <ExpenseForm
        open={modalStates.expense}
        onOpenChange={(open) =>
          setModalStates((prev) => ({ ...prev, expense: open }))
        }
        onSuccess={handleFormSuccess}
      />
      <FlatForm
        open={modalStates.flat}
        onOpenChange={(open) =>
          setModalStates((prev) => ({ ...prev, flat: open }))
        }
        onSuccess={handleFormSuccess}
      />
      <RentForm
        open={modalStates.rent}
        onOpenChange={(open) =>
          setModalStates((prev) => ({ ...prev, rent: open }))
        }
        onSuccess={handleFormSuccess}
      />
      <InventoryForm
        open={modalStates.inventory}
        onOpenChange={(open) =>
          setModalStates((prev) => ({ ...prev, inventory: open }))
        }
        onSuccess={handleFormSuccess}
      />
      <ReminderForm
        open={modalStates.reminder}
        onOpenChange={(open) =>
          setModalStates((prev) => ({ ...prev, reminder: open }))
        }
        onSuccess={handleFormSuccess}
      />
    </motion.div>
  );
}