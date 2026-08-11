import React from "react";
import { CountingQuestion } from "../../types";
import { Label } from "../ui";

/**
 * Property Studio panel kit.
 *
 * Every technique panel receives the same three props and builds its UI from
 * the primitives below, so panels stay visually identical and a new canvas
 * only has to write its fields, never its chrome.
 */
export interface PanelProps {
  question: CountingQuestion;
  /** Patch top-level question fields (title, instruction, targetCount, …) */
  update: (patch: Partial<CountingQuestion>) => void;
  /** Patch question.config — merged, never replaced */
  updateConfig: (patch: Partial<CountingQuestion["config"]>) => void;
}

/*
  Casting is a panel field like the rest, so it is handed out from here — a
  panel picks it up in the same import as `SelectField`. It lives in its own
  file because it is the one primitive that knows about Mascot Studio.
*/
export { ActorCastField } from "./ActorCastField";
export type { ActorCastFieldProps } from "./ActorCastField";

/** Titled group of related fields. */
export const PanelSection: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-4">
    {title && (
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{title}</span>
    )}
    {children}
  </div>
);

export interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export const SelectField: React.FC<SelectFieldProps> = ({ label, value, onChange, options }) => (
  <div className="flex flex-col gap-1.5">
    <Label>{label}</Label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-xs p-2.5 border border-slate-200 rounded-md outline-none bg-white font-medium focus:border-indigo-400 transition-colors"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

export interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Suffix shown in the value chip, e.g. "cols" or "ms" */
  unit?: string;
  /** Optional custom formatter for the value chip */
  format?: (value: number) => string;
}

export const SliderField: React.FC<SliderFieldProps> = ({ label, value, min, max, step = 1, onChange, unit, format }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex justify-between items-center">
      <Label>{label}</Label>
      <span className="text-[10px] bg-indigo-50 text-indigo-600 font-mono font-bold px-2 py-0.5 rounded border border-indigo-100">
        {format ? format(value) : `${value}${unit ? ` ${unit}` : ""}`}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-indigo-600"
    />
  </div>
);

export interface ToggleFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const ToggleField: React.FC<ToggleFieldProps> = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between p-1 bg-slate-50/50 rounded-lg">
    <span className="text-xs font-bold text-slate-600">{label}</span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 text-indigo-600 accent-indigo-600 cursor-pointer"
    />
  </div>
);

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const TextField: React.FC<TextFieldProps> = ({ label, value, onChange, placeholder }) => (
  <div className="flex flex-col gap-1.5">
    <Label>{label}</Label>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-xs p-2.5 border border-slate-200 rounded-md outline-none bg-white font-medium focus:border-indigo-400 transition-colors"
    />
  </div>
);
