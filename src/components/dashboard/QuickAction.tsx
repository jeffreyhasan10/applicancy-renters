
import { Button } from "@/components/ui/button";
import { ReactNode, useState } from "react";
import ActionModal from "./ActionModal";

interface QuickActionProps {
  icon: ReactNode;
  label: string;
  modalTitle?: string;
  modalDescription?: string;
  modalContent?: ReactNode;
  onClick?: () => void;
}

export default function QuickAction({ 
  icon, 
  label, 
  modalTitle, 
  modalDescription, 
  modalContent, 
  onClick 
}: QuickActionProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleAction = () => {
    if (modalContent) {
      setModalOpen(true);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="flex flex-col h-24 w-full md:w-36 items-center justify-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
        onClick={handleAction}
      >
        <div className="text-propease-600">{icon}</div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </Button>

      {modalContent && (
        <ActionModal
          title={modalTitle || label}
          description={modalDescription || `Manage your ${label.toLowerCase()}`}
          open={modalOpen}
          onOpenChange={setModalOpen}
        >
          {modalContent}
        </ActionModal>
      )}
    </>
  );
}
