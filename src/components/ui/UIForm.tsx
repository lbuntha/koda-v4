import React from "react";

const fieldClass = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 text-base font-medium text-ink outline-none transition-colors placeholder:text-muted focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-indigo-950";

export interface UIInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const UIInput = React.forwardRef<HTMLInputElement, UIInputProps>(({ className = "", ...props }, ref) => (
  <input ref={ref} className={`${fieldClass} ${className}`} {...props} />
));
UIInput.displayName = "UIInput";

export interface UISelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const UISelect = React.forwardRef<HTMLSelectElement, UISelectProps>(({ className = "", ...props }, ref) => (
  <select ref={ref} className={`${fieldClass} ${className}`} {...props} />
));
UISelect.displayName = "UISelect";

export interface UIRadioProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const UIRadio = React.forwardRef<HTMLInputElement, UIRadioProps>(({ className = "", type = "radio", ...props }, ref) => (
  <input ref={ref} type={type} className={`h-5 w-5 shrink-0 accent-indigo-600 ${className}`} {...props} />
));
UIRadio.displayName = "UIRadio";
