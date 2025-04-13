
import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: ReactNode;
  trendValue?: number;
  trendText?: string;
  colorClass?: string;
}

export default function StatCard({
  title,
  value,
  description,
  icon,
  trendValue,
  trendText,
  colorClass = "bg-white",
}: StatCardProps) {
  return (
    <div className={`${colorClass} p-6 rounded-xl shadow-sm`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
        <div className="p-3 rounded-lg bg-gray-100">{icon}</div>
      </div>
      
      {trendValue !== undefined && trendText && (
        <div className="mt-4 flex items-center">
          <div
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              trendValue >= 0
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {trendValue >= 0 ? "↑" : "↓"} {Math.abs(trendValue)}%
          </div>
          <span className="ml-2 text-xs text-gray-500">{trendText}</span>
        </div>
      )}
    </div>
  );
}
