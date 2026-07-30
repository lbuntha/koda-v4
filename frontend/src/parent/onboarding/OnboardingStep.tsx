import React from "react";

interface Props {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

export const OnboardingStep: React.FC<Props> = ({ eyebrow, title, description, children }) => (
  <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-4 sm:py-6">
    <div className="text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7252D8] dark:text-[#CDBEFF]">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-black tracking-tight text-[#27334A] sm:text-2xl dark:text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-xs font-semibold leading-relaxed text-[#8792A5] sm:text-sm dark:text-[#9AA3B5]">{description}</p>
    </div>
    <div className="mt-6">{children}</div>
  </section>
);

