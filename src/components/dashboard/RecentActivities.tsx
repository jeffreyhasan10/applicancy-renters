import { CalendarClock, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { format, parseISO } from "date-fns";
import { Database } from "@/integrations/supabase/types";

interface Activity {
  id: number;
  action: string;
  description: string;
  date: string;
  type: "rent" | "tenant";
  originalId: number; // ID in original table
}

type RentPayment = Database['public']['Tables']['rents']['Row'] & {
  tenants?: {
    name: string;
  } | null;
}

type Tenant = Database['public']['Tables']['tenants']['Row'] & {
  flats?: {
    name: string;
  } | null;
}

export default function RecentActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = async () => {
    try {
      setLoading(true);

      const { data: rentPayments, error: rentsError } = await supabase
        .from('rents')
        .select(`id, amount, paid_on, tenants:tenant_id(name)`)
        .eq('is_paid', true)
        .order('paid_on', { ascending: false })
        .limit(3) as { data: RentPayment[] | null; error: any };

      if (rentsError) throw rentsError;

      const { data: newTenants, error: tenantsError } = await supabase
        .from('tenants')
        .select(`id, name, created_at, flats:flat_id(name)`)
        .order('created_at', { ascending: false })
        .limit(3) as { data: Tenant[] | null; error: any };

      if (tenantsError) throw tenantsError;

      const rentActivities: Activity[] = (rentPayments || []).map((payment) => ({
        id: Math.random(),
        action: 'Rent Collected',
        description: `₹${parseFloat(payment.amount as unknown as string).toLocaleString()} collected from ${payment.tenants?.name || 'Unknown'}`,
        date: formatDate(payment.paid_on as string),
        type: "rent",
        originalId: payment.id,
      }));

      const tenantActivities: Activity[] = (newTenants || []).map((tenant) => ({
        id: Math.random(),
        action: 'Tenant Added',
        description: `${tenant.name} added to ${tenant.flats?.name || 'Unknown'}`,
        date: formatDate(tenant.created_at),
        type: "tenant",
        originalId: tenant.id,
      }));

      const combinedActivities = [...rentActivities, ...tenantActivities]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 4);

      setActivities(combinedActivities);
    } catch (error: any) {
      toast({
        title: "Error fetching activities",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeActivity = async (activity: Activity) => {
    try {
      const table = activity.type === "rent" ? "rents" : "tenants";
      const { error } = await supabase.from(table).delete().eq("id", activity.originalId);
      if (error) throw error;

      toast({
        title: `${activity.action} removed`,
        variant: "default",
      });

      // Refresh list
      fetchActivities();
    } catch (error: any) {
      toast({
        title: "Error removing activity",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      const now = new Date();
      if (format(date, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')) {
        return `Today at ${format(date, 'h:mm a')}`;
      }
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) {
        return `Yesterday at ${format(date, 'h:mm a')}`;
      }
      return format(date, 'MMM d, yyyy');
    } catch (e) {
      return dateStr;
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-gray-900">Recent Activities</h2>
        <CalendarClock className="h-5 w-5 text-gray-400" />
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-propease-600"></div>
        </div>
      ) : activities.length > 0 ? (
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start justify-between">
              <div className="flex">
                <div className="mr-4 flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-propease-100 flex items-center justify-center">
                    <div className="h-3 w-3 rounded-full bg-propease-500"></div>
                  </div>
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                  <p className="text-sm text-gray-500">{activity.description}</p>
                  <p className="mt-1 text-xs text-gray-400">{activity.date}</p>
                </div>
              </div>
              <button
                onClick={() => removeActivity(activity)}
                className="text-red-500 hover:text-red-700"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center">
          <p className="text-gray-500">No recent activities found</p>
        </div>
      )}

      <div className="mt-6 text-center">
        <button className="text-sm font-medium text-propease-600 hover:text-propease-700">
          View All Activities
        </button>
      </div>
    </div>
  );
}
