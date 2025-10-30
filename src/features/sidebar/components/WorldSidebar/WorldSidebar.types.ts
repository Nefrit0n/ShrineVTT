import type { ComponentType, ReactNode } from "react";
import type { IconProps } from "@tabler/icons-react";

export type WorldSidebarSection = {
  id: string;
  title: string;
  icon: ComponentType<IconProps>;
  description?: string;
  content?: ReactNode;
};

export type WorldSidebarProps = {
  sections: WorldSidebarSection[];
  initialSectionId?: string;
};
