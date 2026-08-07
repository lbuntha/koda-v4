import React from "react";
import { Grid3X3 } from "lucide-react";
import { CountingTechnique } from "../types";
import { numberPathSchema } from "../components/studio/ai-generator/schemas/numberPath.schema";
import { defineTechnique } from "./manifest";

export const numberPath = defineTechnique({
  technique: CountingTechnique.NUMBER_PATH,
  label: "Number Path & 120 Chart",
  icon: <Grid3X3 size={14} className="text-indigo-600" />,
  defaultTargetCount: 42,
  component: React.lazy(() => import("../components/canvases/NumberPathCanvas").then(module => ({ default: module.NumberPathCanvas }))),
  panel: React.lazy(() => import("../components/studio/panels/NumberPathPanel").then(module => ({ default: module.NumberPathPanel }))),
  schema: numberPathSchema,
});
