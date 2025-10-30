import type { ComponentType } from "react";
import type { IconProps } from "@tabler/icons-react";

export type SceneTool = {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<IconProps>;
};
