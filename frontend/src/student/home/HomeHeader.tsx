import React from "react";
import { LogOut } from "lucide-react";
import { Button } from "../../components/ui";

interface Props {
  studentName: string;
  studentAvatar?: string | null;
  onExit: () => void;
  /** Optional slot on the right of the greeting (e.g. a streak in later bands). */
  right?: React.ReactNode;
}

/** Shared student-home header: avatar + greeting + Exit. */
export const HomeHeader: React.FC<Props> = ({ studentName, studentAvatar, onExit, right }) => (
  <header className="border-b border-[#E8E5F2] bg-white/90 px-5 py-4 backdrop-blur md:px-8">
    <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5B48D6] text-xl font-bold text-white shadow-lg shadow-violet-200" aria-hidden>
          {studentAvatar || studentName.trim().charAt(0).toUpperCase() || "🙂"}
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8178AE]">Today’s learning</p>
          <h1 className="text-lg font-bold">Hi {studentName}</h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {right}
        <Button variant="outline" onClick={onExit}>
          <LogOut size={16} /> <span className="hidden sm:inline">Exit</span>
        </Button>
      </div>
    </div>
  </header>
);
