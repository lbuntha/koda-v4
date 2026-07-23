import React from "react";
import { cn } from "../../lib/utils";

export type TabsVariant = "default" | "admin" | "underline";

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange?: (value: string) => void;
  variant?: TabsVariant;
}

interface TabsContextValue {
  value: string;
  onValueChange?: (value: string) => void;
  variant: TabsVariant;
  baseId: string;
}

export const TabsContext = React.createContext<TabsContextValue | null>(null);

const safeValue = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "-");

export const Tabs: React.FC<TabsProps> = ({ value, onValueChange, variant = "default", className, ...props }) => {
  const generatedId = React.useId();
  const baseId = `tabs-${generatedId.replace(/:/g, "")}`;

  return (
    <TabsContext.Provider value={{ value, onValueChange, variant, baseId }}>
      <div className={cn("w-full", className)} {...props} />
    </TabsContext.Provider>
  );
};

export const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    return (
      <div
        ref={ref}
        role="tablist"
        className={cn(
          "flex max-w-full items-center overflow-x-auto overscroll-x-contain",
          context?.variant === "admin"
            ? "w-full gap-1 rounded-2xl border border-[#E7E3F6] bg-white p-1.5 shadow-[0_4px_18px_rgba(83,74,183,0.04)] sm:w-fit"
            : context?.variant === "underline"
              ? "w-full gap-5 border-b border-[#E7E3F6] bg-transparent px-1"
              : "justify-start rounded-xl bg-slate-100 p-1 text-slate-500",
          className,
        )}
        {...props}
      />
    );
  },
);
TabsList.displayName = "TabsList";

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, onClick, onKeyDown, children, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error("TabsTrigger must be used inside Tabs");
    const isActive = context.value === value;
    const idValue = safeValue(value);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const list = event.currentTarget.closest('[role="tablist"]');
      const tabs = Array.from(list?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? []);
      if (!tabs.length) return;
      const currentIndex = tabs.indexOf(event.currentTarget);
      const nextIndex = event.key === "Home" ? 0
        : event.key === "End" ? tabs.length - 1
        : event.key === "ArrowRight" ? (currentIndex + 1) % tabs.length
        : (currentIndex - 1 + tabs.length) % tabs.length;
      event.preventDefault();
      tabs[nextIndex].focus();
      tabs[nextIndex].click();
    };

    return (
      <button
        ref={ref}
        id={`${context.baseId}-tab-${idValue}`}
        role="tab"
        type="button"
        aria-selected={isActive}
        aria-controls={`${context.baseId}-panel-${idValue}`}
        tabIndex={isActive ? 0 : -1}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) context.onValueChange?.(value);
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          "inline-flex min-w-fit cursor-pointer select-none items-center justify-center whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
          context.variant === "admin"
            ? "koda-admin-nav-label flex-1 gap-2 rounded-xl px-4 py-2 text-[#6D6997] hover:bg-[#F5F2FF] hover:text-[#0E0B55] focus-visible:ring-[#7C6DD8]/35 sm:flex-none"
            : context.variant === "underline"
              ? "koda-admin-nav-label -mb-px gap-2 rounded-none border-b-2 border-transparent px-1 py-3 text-[#6D6997] hover:text-[#0E0B55] focus-visible:ring-[#7C6DD8]/35"
              : "rounded-lg px-3 py-1.5 text-xs font-bold font-mono uppercase tracking-wider text-slate-500 hover:text-slate-950 focus-visible:ring-indigo-500/20",
          isActive && (context.variant === "admin"
            ? "bg-[#534AB7] text-white shadow-sm hover:bg-[#453DA0] hover:text-white"
            : context.variant === "underline"
              ? "border-[#534AB7] text-[#0E0B55]"
              : "bg-white font-extrabold text-slate-900 shadow-sm"),
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error("TabsContent must be used inside Tabs");
    if (context.value !== value) return null;
    const idValue = safeValue(value);

    return (
      <div
        ref={ref}
        id={`${context.baseId}-panel-${idValue}`}
        role="tabpanel"
        aria-labelledby={`${context.baseId}-tab-${idValue}`}
        tabIndex={0}
        className={cn(
          "animate-fade-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6DD8]/25",
          context.variant === "default" && "mt-2",
          className,
        )}
        {...props}
      />
    );
  },
);
TabsContent.displayName = "TabsContent";
