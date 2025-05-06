import { AlertTriangle, AlertCircle, CalendarDays, Filter } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Database } from "@/integrations/supabase/types";

interface RentData {
  id: string;
  tenant: string;
  flatName: string;
  amount: number;
  dueDate: string;
  daysPending: number;
  status: "upcoming" | "due-today" | "overdue";
}

type RentWithTenant = Database["public"]["Tables"]["rents"]["Row"] & {
  tenants?: {
    name: string;
    flat_id: string;
    flats?: {
      name: string;
    } | null;
  } | null;
};

export default function RentCollection() {
  const [collectionRate, setCollectionRate] = useState(0);
  const [pendingRents, setPendingRents] = useState<RentData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRentData = async () => {
    try {
      setLoading(true);
      const currentDate = new Date().toISOString().split("T")[0];

      // Get pending rents including tenant and flat information
      const { data, error } = (await supabase
        .from("rents")
        .select(
          `
          id,
          amount,
          due_date,
          tenants:tenant_id(name, flat_id, flats:flat_id(name))
        `
        )
        .or(`is_paid.eq.false,and(due_date.gte.${currentDate})`)
        .order("due_date", { ascending: true })
        .limit(10)) as { data: RentWithTenant[] | null; error: any };

      if (error) throw error;

      // Calculate collection rate (paid vs total rents for the current month)
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0];

      const { data: monthRents, error: monthError } = (await supabase
        .from("rents")
        .select("is_paid")
        .gte("due_date", currentMonthStart)
        .lte("due_date", currentMonthEnd)) as {
        data: { is_paid: boolean }[] | null;
        error: any;
      };

      if (monthError) throw monthError;

      const totalMonthRents = monthRents?.length || 0;
      const paidMonthRents =
        monthRents?.filter((rent) => rent.is_paid).length || 0;
      const calculatedRate =
        totalMonthRents > 0
          ? Math.round((paidMonthRents / totalMonthRents) * 100)
          : 0;

      setCollectionRate(calculatedRate);

      // Format rent data
      const today = new Date().setHours(0, 0, 0, 0);
      const formattedRents = (data || []).map((rent) => {
        const dueDate = new Date(rent.due_date).setHours(0, 0, 0, 0);
        const diffTime = dueDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let status: "upcoming" | "due-today" | "overdue";
        if (diffDays > 0) status = "upcoming";
        else if (diffDays === 0) status = "due-today";
        else status = "overdue";

        return {
          id: rent.id,
          tenant: rent.tenants?.name || "Tenant",
          flatName: rent.tenants?.flats?.name || "Tenant",
          amount: parseFloat(rent.amount as unknown as string),
          dueDate: new Date(rent.due_date).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          daysPending: diffDays < 0 ? Math.abs(diffDays) : 0,
          status,
        };
      });

      setPendingRents(formattedRents.slice(0, 3)); // Limit to 3 items for display
    } catch (error: any) {
      toast({
        title: "Error fetching rent data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRentData();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Rent Collection</CardTitle>
          <CardDescription>
            {new Date().toLocaleString("default", {
              month: "long",
              year: "numeric",
            })}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          <Filter className="h-4 w-4" />
          <span>Filter</span>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Collection Progress</span>
            <span className="text-sm font-medium">{collectionRate}%</span>
          </div>
          <Progress value={collectionRate} className="h-2" />
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-propease-600"></div>
          </div>
        ) : pendingRents.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <CalendarDays className="h-10 w-10 text-gray-300 mb-2" />
            <p className="text-gray-500 text-center">
              No pending rents to display
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRents.map((rent) => (
              <div
                key={rent.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
              >
                <div>
                  <p className="font-medium text-sm">{rent.tenant}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                    <CalendarDays className="h-3 w-3" />
                    <span>{rent.dueDate}</span>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-right">
                    ₹{rent.amount.toLocaleString()}
                  </p>
                  <div className="flex items-center mt-1 justify-end">
                    {rent.status === "overdue" && (
                      <span className="flex items-center gap-1 text-xs text-red-500">
                        <AlertCircle className="h-3 w-3" />
                        {rent.daysPending} days overdue
                      </span>
                    )}
                    {rent.status === "due-today" && (
                      <span className="flex items-center gap-1 text-xs text-amber-500">
                        <AlertTriangle className="h-3 w-3" />
                        Due today
                      </span>
                    )}
                    {rent.status === "upcoming" && (
                      <span className="flex items-center gap-1 text-xs text-blue-500">
                        <CalendarDays className="h-3 w-3" />
                        Upcoming
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button className="w-full" variant="outline">
          View All Pending Rents
        </Button>
      </CardFooter>
    </Card>
  );
}
