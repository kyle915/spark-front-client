import { useEffect, useState } from "react";
import { isLightMode, onAppearanceChange } from "@/theme/appearance";
import {
  sparkMapBackground,
  sparkMapStyle,
  type MapAppearance,
  type MapStyleRule,
} from "./sparkMapStyle";

const current = (): MapAppearance => (isLightMode() ? "light" : "dark");

/** The shared map style for the appearance on screen; follows the switch. */
export function useSparkMapStyle(): {
  appearance: MapAppearance;
  styles: MapStyleRule[];
  backgroundColor: string;
} {
  const [appearance, setAppearance] = useState<MapAppearance>(current);
  useEffect(() => {
    setAppearance(current());
    return onAppearanceChange(() => setAppearance(current()));
  }, []);
  return {
    appearance,
    styles: sparkMapStyle(appearance),
    backgroundColor: sparkMapBackground(appearance),
  };
}
