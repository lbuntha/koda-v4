import React from "react";
import App from "../App";

interface InteractiveStudioPageProps {
  onExit?: () => void;
}

/**
 * Admin-native entry for the existing technique workspace. The admin shell
 * owns navigation and page identity; App supplies only the authored Studio
 * workspace until its technique-neutral orchestration is fully extracted.
 */
export const InteractiveStudioPage: React.FC<InteractiveStudioPageProps> = ({ onExit }) => (
  <div className="h-full min-h-0 w-full overflow-hidden bg-[#FBFAFF]">
    <App embedded initialAdminTab="studio" onExitStudio={onExit} />
  </div>
);
