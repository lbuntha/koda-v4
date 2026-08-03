import React from "react";
import { Button, Card } from "../components/ui";

export const LandingClosingCta: React.FC<{ isDark?: boolean; onStart: () => void }> = ({ isDark = false, onStart }) => (
  <section className={`w-full bg-white pt-8 transition-colors dark:bg-[#080B18] sm:pt-12 ${isDark ? "dark" : ""}`}>
    <Card className="relative flex aspect-[7/2] min-h-[220px] max-h-[460px] w-full max-w-none items-center justify-center overflow-hidden rounded-none border-x-0 border-violet-100 bg-violet-50 shadow-none dark:border-x-0 dark:border-white/10 dark:bg-[#15172D] sm:min-h-0">
      <img
        src={isDark ? "/assets/koda-closing-cta-banner-dark.png" : "/assets/koda-closing-cta-banner.png"}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="relative z-10 mx-auto w-[90%] sm:w-[52%] min-w-[240px] text-center">
        <h2 className="text-xl font-black leading-tight text-slate-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.7)] dark:text-white dark:drop-shadow-none sm:text-2xl lg:text-3xl">
          Ready to make learning<br className="hidden sm:block" /> their favorite adventure?
        </h2>
        <Button onClick={onStart} size="sm" className="mt-3 min-w-48 bg-violet-600 hover:bg-violet-500 sm:min-w-52">
          Create your family account
        </Button>
        <p className="mt-1.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">Start with your family profile and choose a learner.</p>
      </div>
    </Card>
  </section>
);
