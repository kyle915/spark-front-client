import * as React from "react";

export type ColorResult = {
  hex: string;
};

export const SketchPicker: React.ComponentType<{
  color?: string;
  onChange?: (color: ColorResult) => void;
  disableAlpha?: boolean;
}>;
