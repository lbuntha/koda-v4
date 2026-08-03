import React from "react";
import { Download } from "lucide-react";
import { useInstallPrompt } from "./useInstallPrompt";
import { Button } from "../components/ui";

export interface PwaInstallButtonProps {
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  showText?: boolean;
}

export const PwaInstallButton: React.FC<PwaInstallButtonProps> = ({
  variant = "outline",
  size = "sm",
  className = "",
  showText = true,
}) => {
  const installPrompt = useInstallPrompt();

  if (!installPrompt.canShow) return null;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => void installPrompt.install()}
      className={`inline-flex items-center gap-2 ${className}`}
      title="Install Koda as an App for offline & full-screen play"
    >
      <Download className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
      {showText && <span>Install App</span>}
    </Button>
  );
};
