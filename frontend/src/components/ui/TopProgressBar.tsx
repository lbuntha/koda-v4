import React, { useEffect, useState } from "react";

export const TopProgressBar: React.FC<{ loading: boolean }> = ({ loading }) => {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loading) {
      setVisible(true);
      setProgress(15);
      const timer1 = setTimeout(() => setProgress(45), 100);
      const timer2 = setTimeout(() => setProgress(75), 300);
      const timer3 = setTimeout(() => setProgress(90), 800);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    } else {
      setProgress(100);
      const timer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1 pointer-events-none bg-indigo-100/30 dark:bg-indigo-950/30">
      <div
        className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-amber-400 shadow-[0_0_10px_rgba(139,92,246,0.8)] transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};
