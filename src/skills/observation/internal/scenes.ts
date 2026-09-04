import beachJson from "./scenes/beach-sandcastle-shore.json";
import beachCafeJson from "./scenes/beach-seaside-cafe.json";
import parkPicnicJson from "./scenes/park-playground-picnic.json";
import parkPondJson from "./scenes/park-botanical-pond.json";
import homePlayroomJson from "./scenes/home-busy-playroom.json";
import homeBedroomJson from "./scenes/home-cozy-bedroom.json";
import marketFruitJson from "./scenes/market-fruit-market.json";
import marketBakeryJson from "./scenes/market-bakery-cafe.json";
import farmBarnyardJson from "./scenes/farm-barnyard-morning.json";
import farmStandJson from "./scenes/farm-farm-stand.json";
import forestClearingJson from "./scenes/forest-tent-clearing.json";
import forestCabinJson from "./scenes/forest-ranger-cabin.json";
import schoolArtJson from "./scenes/school-art-classroom.json";
import schoolLibraryJson from "./scenes/school-library-lab.json";
import harborDocksJson from "./scenes/harbor-harbor-docks.json";
import harborAquariumJson from "./scenes/harbor-aquarium-gallery.json";
import museumPlanetariumJson from "./scenes/museum-planetarium.json";
import museumRoboticsJson from "./scenes/museum-robotics-hall.json";
import townFestivalJson from "./scenes/town-festival-square.json";
import townParadeJson from "./scenes/town-toy-parade.json";
import castleCourtyardJson from "./scenes/castle-royal-courtyard.json";
import castleFrogMoatJson from "./scenes/castle-frog-moat.json";
import type { ObservationScene } from "./types";

export const SCENES = [
  beachJson, beachCafeJson,
  parkPicnicJson, parkPondJson,
  homePlayroomJson, homeBedroomJson,
  marketFruitJson, marketBakeryJson,
  farmBarnyardJson, farmStandJson,
  forestClearingJson, forestCabinJson,
  schoolArtJson, schoolLibraryJson,
  harborDocksJson, harborAquariumJson,
  museumPlanetariumJson, museumRoboticsJson,
  townFestivalJson, townParadeJson,
  castleCourtyardJson, castleFrogMoatJson,
] as ObservationScene[];
export const SCENE_BY_ID = new Map(SCENES.map((scene) => [scene.id, scene]));
