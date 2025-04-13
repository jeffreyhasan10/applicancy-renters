import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  onActionClick?: () => void;
  actionLabel?: string;
  actionIcon?: ReactNode;
}

export default function PageHeader({ 
  title, 
  description, 
  action, 
  onActionClick,
  actionLabel = "Add New",
  actionIcon = <Plus className="h-4 w-4" />
}: PageHeaderProps) {
  // Generate default action button if onActionClick is provided and no custom action
  const actionButton = action || (onActionClick && (
    <Button onClick={onActionClick} className="gap-1">
      {actionIcon}
      {actionLabel}
    </Button>
  ));

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 space-y-4 md:space-y-0">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {description && <p className="text-gray-500">{description}</p>}
      </div>
      {actionButton}
    </div>
  );
}
