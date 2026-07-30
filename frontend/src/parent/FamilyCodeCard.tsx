/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The family code, as one compact bar: mark, code, privacy note, copy. It is reference
 * information a parent reads once per device, so it earns a single row rather than a stacked
 * card — and the privacy line stays visible, because this code is the whole door key.
 */

import React, { useState } from "react";
import { Check, Copy, Lock } from "lucide-react";
import { Button } from "../components/ui";

/** Simple gradient shield: a mark, not an illustration. */
const ShieldMark: React.FC = () => (
  <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" role="presentation" aria-hidden focusable="false">
    <defs>
      <linearGradient id="family-shield" x1="8" y1="4" x2="32" y2="36" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8B73F7" />
        <stop offset="1" stopColor="#5335D8" />
      </linearGradient>
    </defs>
    <path d="M20 4l12 4v11c0 8-5 15-12 17-7-2-12-9-12-17V8l12-4Z" fill="url(#family-shield)" />
    <circle cx="20" cy="17" r="3.4" fill="#fff" />
    <path d="M14 27c1.6-4 10.4-4 12 0Z" fill="#fff" />
  </svg>
);

export const FamilyCodeCard: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-3xl bg-indigo-50/70 px-5 py-3.5 sm:px-6 sm:py-4 dark:bg-indigo-400/10">
      <ShieldMark />

      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-300">
          Family code
        </p>
        <p className="truncate font-mono text-xl font-black tracking-[0.18em] text-indigo-900 dark:text-[#CFC7FF]">
          {code}
        </p>
      </div>

      <p className="hidden items-center gap-1.5 text-[11px] font-medium text-slate-500 md:flex dark:text-[#9A94B8]">
        <Lock size={12} className="shrink-0" />
        Kids sign in with this on their own device — share it only with people you trust.
      </p>

      <Button
        variant="secondary"
        size="sm"
        onClick={copy}
        className="ml-auto shrink-0 dark:border-white/10 dark:bg-white/10 dark:text-[#DEDCF0] dark:hover:bg-white/15"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
};
