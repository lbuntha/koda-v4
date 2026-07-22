import React from "react";
import { cn } from "../../lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-xs font-bold uppercase tracking-wider text-slate-500 font-mono select-none",
        className
      )}
      {...props}
    />
  )
);
Label.displayName = "Label";
