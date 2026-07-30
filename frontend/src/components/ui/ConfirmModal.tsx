import React, { useEffect, useState } from "react";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "default";
  icon?: React.ReactNode;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  icon,
}) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) setLoading(false);
  }, [isOpen]);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
      onClose();
    } catch {
      setLoading(false);
    }
  };

  const isDanger = variant === "danger";

  return (
    <Dialog isOpen={isOpen} onClose={loading ? () => {} : onClose} maxWidthClassName="max-w-sm">
      <div className="flex flex-col items-center text-center p-1">
        {/* Badge Icon */}
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl mb-3.5 ${
            isDanger
              ? "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
              : "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
          }`}
        >
          {icon ?? (isDanger ? <Trash2 size={22} /> : <AlertTriangle size={22} />)}
        </div>

        {/* Title & Description */}
        <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-[#EDECF8]">
          {title}
        </h3>
        {description && (
          <p className="mt-1.5 text-xs font-semibold text-slate-500 leading-relaxed dark:text-[#9A94B8]">
            {description}
          </p>
        )}

        {/* Actions */}
        <div className="mt-6 flex w-full gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl font-bold dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 rounded-xl font-extrabold text-white shadow-sm ${
              isDanger
                ? "bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500"
                : "bg-[#5C46DF] hover:bg-[#4C36CF] dark:bg-[#BEACFF] dark:text-[#191338] dark:hover:bg-[#AF9CFF]"
            }`}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : confirmText}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
