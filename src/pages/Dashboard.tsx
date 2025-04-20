import {
  Building2,
  IndianRupee,
  Package2,
  Send,
  Link,
  Loader2,
  Calendar,
  X,
  TrendingUp,
  AlertCircle,
  BarChart3,
  Clock,
  Activity,
  ChevronRight,
} from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import QuickAction from "@/components/dashboard/QuickAction";
import RecentActivities from "@/components/dashboard/RecentActivities";
import RentCollection from "@/components/dashboard/RentCollection";
import CalendarView from "@/components/dashboard/CalendarView";
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
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface DashboardStats {
  totalExpenses: number;
  pendingRents: {
    count: number;
    amount: number;
  };
  currentMonthRevenue: number;
  totalFlats: number;
  occupiedFlats: number;
  comparisons: {
    expenses: number;
    pendingRents: number;
    revenue: number;
    flats: number;
  };
}

interface Stat {
  title: string;
  value: string;
  description: string;
  icon: JSX.Element;
  trendValue: number;
  trendText: string;
  className?: string;
  iconBg?: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalExpenses: 0,
    pendingRents: { count: 0, amount: 0 },
    currentMonthRevenue: 0,
    totalFlats: 0,
    occupiedFlats: 0,
    comparisons: {
      expenses: 0,
      pendingRents: 0,
      revenue: 0,
      flats: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [modalStates, setModalStates] = useState({
    flat: false,
    rent: false,
    inventory: false,
    reminder: false,
    expense: false,
    calendar: false,
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

      const lastYear = currentYear - 1;
      const { data: lastYearExpensesData, error: lastYearExpensesError } =
        await supabase
          .from("expenses")
          .select("amount")
          .gte("date", `${lastYear}-01-01`)
          .lte("date", `${lastYear}-12-31`);

      if (lastYearExpensesError) throw new Error(lastYearExpensesError.message);

      const totalExpenses = (expensesData || []).reduce(
        (sum, expense) => sum + (parseFloat(expense.amount) || 0),
        0
      );

      const lastYearExpenses = (lastYearExpensesData || []).reduce(
        (sum, expense) => sum + (parseFloat(expense.amount) || 0),
        0
      );

      const expenseComparison =
        lastYearExpenses > 0
          ? ((totalExpenses - lastYearExpenses) / lastYearExpenses) * 100
          : 0;

      // Fetch pending rents
      const currentDate = new Date().toISOString().split("T")[0];
      const { data: pendingRentsData, error: pendingRentsError } =
        await supabase
          .from("rents")
          .select("amount")
          .eq("is_paid", false)
          .lte("due_date", currentDate);

      if (pendingRentsError) throw new Error(pendingRentsError.message);

      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastMonthDate = lastMonth.toISOString().split("T")[0];

      const {
        data: lastMonthPendingRentsData,
        error: lastMonthPendingRentsError,
      } = await supabase
        .from("rents")
        .select("amount")
        .eq("is_paid", false)
        .lte("due_date", lastMonthDate);

      if (lastMonthPendingRentsError)
        throw new Error(lastMonthPendingRentsError.message);

      const pendingRentsAmount = (pendingRentsData || []).reduce(
        (sum, rent) => sum + (parseFloat(rent.amount) || 0),
        0
      );

      const lastMonthPendingRentsAmount = (
        lastMonthPendingRentsData || []
      ).reduce((sum, rent) => sum + (parseFloat(rent.amount) || 0), 0);

      const pendingRentsComparison =
        lastMonthPendingRentsAmount > 0
          ? ((pendingRentsAmount - lastMonthPendingRentsAmount) /
              lastMonthPendingRentsAmount) *
            100
          : 0;

      // Fetch current month revenue
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: revenueData, error: revenueError } = await supabase
        .from("rents")
        .select("amount, paid_on")
        .eq("is_paid", true)
        .not("paid_on", "is", null);

      if (revenueError) throw new Error(revenueError.message);

      const lastMonthString = lastMonth.toISOString().slice(0, 7);

      const currentMonthRevenue = (revenueData || [])
        .filter((rent) => rent.paid_on?.startsWith(currentMonth))
        .reduce((sum, rent) => sum + (parseFloat(rent.amount) || 0), 0);

      const lastMonthRevenue = (revenueData || [])
        .filter((rent) => rent.paid_on?.startsWith(lastMonthString))
        .reduce((sum, rent) => sum + (parseFloat(rent.amount) || 0), 0);

      const revenueComparison =
        lastMonthRevenue > 0
          ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
          : 0;

      // Fetch total flats
      const { data: flatsData, error: flatsError } = await supabase
        .from("flats")
        .select("id");

      if (flatsError) throw new Error(flatsError.message);

      const { data: lastMonthFlatsData, error: lastMonthFlatsError } =
        await supabase
          .from("flats")
          .select("id")
          .lte("created_at", lastMonthDate);

      if (lastMonthFlatsError) throw new Error(lastMonthFlatsError.message);

      // Fetch occupied flats
      const { data: occupiedFlatsData, error: occupiedFlatsError } =
        await supabase
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

      const flatsComparison =
        lastMonthFlatsData.length > 0
          ? ((flatsData.length - lastMonthFlatsData.length) /
              lastMonthFlatsData.length) *
            100
          : 0;

      setStats({
        totalExpenses,
        pendingRents: {
          count: pendingRentsData?.length || 0,
          amount: pendingRentsAmount,
        },
        currentMonthRevenue,
        totalFlats: flatsData?.length || 0,
        occupiedFlats: uniqueOccupiedFlats.length,
        comparisons: {
          expenses: expenseComparison,
          pendingRents: pendingRentsComparison,
          revenue: revenueComparison,
          flats: flatsComparison,
        },
      });
    } catch (error: any) {
      console.error("Dashboard fetch error:", error);
      toast({
        title: "Error fetching dashboard data",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
        className: "bg-red-500 text-white border-none shadow-lg rounded-xl",
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
    fetchDashboardData();
  };

  const formattedStats: Stat[] = [
    {
      title: "Total Expenses",
      value: loading ? "..." : `₹${stats.totalExpenses.toLocaleString()}`,
      description: "This year",
      icon: <IndianRupee className="h-6 w-6 text-red-600" />,
      trendValue: stats.comparisons.expenses,
      trendText: "from last year",
      className:
        "border-red-200 bg-white hover:bg-red-50 transition-colors duration-300",
      iconBg: "bg-red-100",
    },
    {
      title: "Pending Rents",
      value: loading ? "..." : `₹${stats.pendingRents.amount.toLocaleString()}`,
      description: loading ? "..." : `${stats.pendingRents.count} tenants`,
      icon: <AlertCircle className="h-6 w-6 text-amber-600" />,
      trendValue: stats.comparisons.pendingRents,
      trendText: "from last month",
      className:
        "border-amber-200 bg-white hover:bg-amber-50 transition-colors duration-300",
      iconBg: "bg-amber-100",
    },
    {
      title: "This Month Revenue",
      value: loading ? "..." : `₹${stats.currentMonthRevenue.toLocaleString()}`,
      description: new Date().toLocaleString("default", {
        month: "long",
        year: "numeric",
      }),
      icon: <BarChart3 className="h-6 w-6 text-emerald-600" />,
      trendValue: stats.comparisons.revenue,
      trendText: "from last month",
      className:
        "border-emerald-200 bg-white hover:bg-emerald-50 transition-colors duration-300",
      iconBg: "bg-emerald-100",
    },
    {
      title: "Total Properties",
      value: loading ? "..." : stats.totalFlats.toString(),
      description: loading ? "..." : `${stats.occupiedFlats} occupied`,
      icon: <Building2 className="h-6 w-6 text-blue-600" />,
      trendValue: stats.comparisons.flats,
      trendText: "from last month",
      className:
        "border-blue-200 bg-white hover:bg-blue-50 transition-colors duration-300",
      iconBg: "bg-blue-100",
    },
  ];

  const quickActions = [
    {
      icon: <IndianRupee className="h-6 w-6 text-white" />,
      label: "Add Expense",
      onClick: () => toggleModal("expense"),
      tooltip: "Record a new expense",
      bgColor:
        "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
      borderColor: "border-red-300",
      textColor: "text-white",
    },
    {
      icon: <Building2 className="h-6 w-6 text-white" />,
      label: "Add Flat",
      onClick: () => toggleModal("flat"),
      tooltip: "Add a new property",
      bgColor:
        "bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
      borderColor: "border-blue-300",
      textColor: "text-white",
    },
    {
      icon: <IndianRupee className="h-6 w-6 text-white" />,
      label: "Record Rent",
      onClick: () => toggleModal("rent"),
      tooltip: "Log a rent payment",
      bgColor:
        "bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700",
      borderColor: "border-emerald-300",
      textColor: "text-white",
    },
    {
      icon: <Package2 className="h-6 w-6 text-white" />,
      label: "Inventory",
      onClick: () => toggleModal("inventory"),
      tooltip: "Manage inventory items",
      bgColor:
        "bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700",
      borderColor: "border-purple-300",
      textColor: "text-white",
    },
    {
      icon: <Send className="h-6 w-6 text-white" />,
      label: "Reminders",
      onClick: () => toggleModal("reminder"),
      tooltip: "Set a new reminder",
      bgColor:
        "bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700",
      borderColor: "border-amber-300",
      textColor: "text-white",
    },
    {
      icon: <Link className="h-6 w-6 text-white" />,
      label: "Payment Links",
      onClick: () => navigate("/payment-links"),
      tooltip: "Generate payment links",
      bgColor:
        "bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700",
      borderColor: "border-indigo-300",
      textColor: "text-white",
    },
    {
      icon: <Calendar className="h-6 w-6 text-white" />,
      label: "View Calendar",
      onClick: () => toggleModal("calendar"),
      tooltip: "View all events",
      bgColor:
        "bg-gradient-to-br from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700",
      borderColor: "border-cyan-300",
      textColor: "text-white",
    },
  ];

  // Enhanced StatCard component
  const CustomStatCard = ({
    title,
    value,
    description,
    icon,
    trendValue,
    trendText,
    className,
    iconBg,
  }: Stat) => (
    <motion.div
      className={`rounded-2xl p-4 sm:p-6 border shadow-lg backdrop-blur-sm ${className} flex flex-col h-full justify-between transition-transform duration-300 hover:shadow-xl`}
      whileHover={{ scale: 1.03 }}
      role="region"
      aria-label={title}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <p className="text-gray-600 font-medium text-sm sm:text-base tracking-wide">
            {title}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            {value}
          </p>
          <p className="text-xs sm:text-sm text-gray-500">{description}</p>
        </div>
        <div className={`rounded-full p-2 sm:p-3 ${iconBg} shadow-md`}>{icon}</div>
      </div>
      <div className="mt-4 flex items-center">
        <span
          className={`text-xs sm:text-sm font-medium flex items-center ${
            trendValue >= 0 ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {trendValue >= 0 ? (
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
          ) : (
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1 transform rotate-180" />
          )}
          {trendValue >= 0 ? "+" : ""}
          {trendValue.toFixed(1)}%
        </span>
        <span className="text-xs sm:text-sm text-gray-500 ml-1">{trendText}</span>
      </div>
    </motion.div>
  );

  // Enhanced QuickAction component
  const CustomQuickAction = ({
    icon,
    label,
    onClick,
    className,
    textColor,
  }: any) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          onClick={onClick}
          className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl shadow-md transition-all duration-300 border min-w-[120px] sm:min-w-[140px] h-28 sm:h-32 group ${className}`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          role="button"
          aria-label={label}
        >
          <div className="rounded-full p-2 sm:p-3 mb-2 transform transition-transform duration-300 group-hover:scale-110">
            {icon}
          </div>
          <span
            className={`text-xs sm:text-sm font-medium transition-all ${textColor} flex items-center text-center`}
          >
            {label}
            <ChevronRight className="h-4 w-0 opacity-0 transition-all duration-300 group-hover:w-4 group-hover:opacity-100 ml-0 group-hover:ml-1" />
          </span>
        </motion.button>
      </TooltipTrigger>
      <TooltipContent className="bg-gray-800 text-white border-none shadow-lg rounded-xl">
        {label}
      </TooltipContent>
    </Tooltip>
  );

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-slate-100 px-4 sm:px-6 overflow-x-hidden"
      >
        <div className="flex flex-col items-center space-y-6 bg-white/40 backdrop-blur-md p-8 sm:p-10 rounded-2xl shadow-xl border border-blue-100 max-w-md w-full">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="relative"
          >
            <div className="absolute inset-0 rounded-full bg-blue-200/50 blur-xl transform scale-150"></div>
            <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 text-blue-500 relative z-10" />
          </motion.div>
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-gray-800 text-lg sm:text-xl font-semibold tracking-wide text-center"
          >
            Loading your dashboard...
          </motion.p>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ delay: 0.4, duration: 1.5, ease: "easeInOut" }}
            className="h-1 bg-blue-500 rounded-full mt-2 w-48 sm:w-64"
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-blue-50 via-white to-slate-50 min-h-screen max-w-full overflow-x-hidden"
    >
      <PageHeader
        title="Dashboard"
        description="Welcome to your Applicancy Renters"
        className="mb-6 sm:mb-8"
      />

      {/* Stat Cards */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-full"
      >
        {formattedStats.map((stat, index) => (
          <CustomStatCard key={index} {...stat} />
        ))}
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 sm:mt-10 max-w-full"
      >
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6 tracking-tight flex items-center">
          <span className="bg-gradient-to-r from-blue-100 to-blue-200 p-2 rounded-xl mr-2 shadow-sm">
            <Activity className="h-5 w-5 text-blue-600" />
          </span>
          Quick Actions
        </h2>
        <TooltipProvider>
          <ScrollArea className="w-full max-w-full">
            <div className="flex gap-3 sm:gap-4 pb-4">
              {quickActions.map((action, index) => (
                <div key={index} className="flex-none">
                  <CustomQuickAction
                    icon={action.icon}
                    label={action.label}
                    onClick={action.onClick}
                    className={`${action.bgColor} transition-all duration-300 border ${action.borderColor} shadow-lg`}
                    textColor={action.textColor}
                  />
                </div>
              ))}
            </div>
            <ScrollBar
              orientation="horizontal"
              className="bg-gray-200 rounded-full"
            />
          </ScrollArea>
        </TooltipProvider>
      </motion.div>

      {/* Rent Collection and Recent Activities */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 sm:mt-10 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 max-w-full"
      >
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center">
            <span className="bg-gradient-to-r from-emerald-100 to-emerald-200 p-2 rounded-xl mr-2 shadow-sm">
              <IndianRupee className="h-5 w-5 text-emerald-600" />
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">
              Rent Collection
            </h2>
          </div>
          <div className="bg-white shadow-xl rounded-2xl border border-emerald-200 overflow-hidden backdrop-blur-sm hover:shadow-emerald-100/50 transition-shadow duration-300">
            <div className="p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 border-b border-emerald-200">
              <h3 className="text-base sm:text-lg font-semibold text-emerald-700 flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Monthly Collection Overview
              </h3>
            </div>
            <RentCollection className="p-4 sm:p-6" />
          </div>
        </div>
        <div>
          <div className="mb-4 flex items-center">
            <span className="bg-gradient-to-r from-amber-100 to-amber-200 p-2 rounded-xl mr-2 shadow-sm">
              <Clock className="h-5 w-5 text-amber-600" />
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">
              Recent Activity
            </h2>
          </div>
          <div className="bg-white shadow-xl rounded-2xl border border-amber-200 overflow-hidden backdrop-blur-sm hover:shadow-amber-100/50 transition-shadow duration-300">
            <div className="p-4 bg-gradient-to-r from-amber-50 to-amber-100 border-b border-amber-200">
              <h3 className="text-base sm:text-lg font-semibold text-amber-700 flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Latest Updates
              </h3>
            </div>
            <RecentActivities className="p-4 sm:p-6" />
          </div>
        </div>
      </motion.div>

      {/* Calendar Modal */}
      <AnimatePresence>
        {modalStates.calendar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-x-hidden"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-2xl w-full max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-hidden shadow-lg"
            >
              <div className="flex justify-between items-center p-4 border-b border-gray-200">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800">
                  Calendar
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleModal("calendar")}
                  className="rounded-full h-8 w-8 text-gray-600 hover:bg-gray-100"
                  aria-label="Close calendar"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(90vh-64px)]">
                <CalendarView />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Forms */}
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