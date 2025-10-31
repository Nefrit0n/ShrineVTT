import clsx from "clsx";
import type { HTMLAttributes, PropsWithChildren } from "react";

import styles from "./Panel.module.css";

type PanelProps = PropsWithChildren<{
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  chrome?: boolean;
}> &
  HTMLAttributes<HTMLElement>;

/**
 * Panel centralises the glassmorphism styling used across the interface so that
 * feature components can focus solely on behaviour and content.
 */
export default function Panel({
  children,
  className,
  padding = "md",
  chrome = true,
  ...props
}: PanelProps) {
  const panelClasses = clsx(
    chrome ? [styles.panel, styles[padding]] : styles[padding],
    className
  );

  return (
    <section {...props} className={panelClasses}>
      {children}
    </section>
  );
}
