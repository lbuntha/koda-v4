import React from "react";
import { Blocks } from "lucide-react";
import { CountingTechnique } from "../types";
import { placeValueLabSchema } from "../components/studio/ai-generator/schemas/placeValueLab.schema";
import { defineTechnique } from "./manifest";

export const placeValueLab = defineTechnique({
  technique: CountingTechnique.PLACE_VALUE_LAB,
  defaultThumbnailUrl: "/assets/components/place-value-lab.svg",
  label: "Place Value Lab",
  icon: <Blocks size={14} className="text-indigo-600" />,
  defaultTargetCount: 34,
  component: React.lazy(() => import("../components/canvases/PlaceValueLabCanvas").then(module => ({ default: module.PlaceValueLabCanvas }))),
  panel: React.lazy(() => import("../components/studio/panels/PlaceValueLabPanel").then(module => ({ default: module.PlaceValueLabPanel }))),
  schema: placeValueLabSchema,
});
