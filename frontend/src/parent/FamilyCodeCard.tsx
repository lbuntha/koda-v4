/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button, Card } from "../components/ui";

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
    <Card className="border-indigo-100 bg-indigo-50/60 p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Family code</div>
        <div className="text-2xl font-black font-mono tracking-[0.2em] text-indigo-900">{code}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">Your kids use this to sign in on their own device.</div>
      </div>
      <Button variant="secondary" size="sm" onClick={copy} className="shrink-0">
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </Card>
  );
};
