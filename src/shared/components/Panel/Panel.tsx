import clsx from "clsx";
import type { HTMLAttributes, PropsWithChildren } from "react";

import styles from "./Panel.module.css";

type PanelProps = PropsWithChildren<{
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
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
  ...props
}: PanelProps) {
  return (
    <section {...props} className={clsx(styles.panel, styles[padding], className)}>
      {children}
    </section>
  );
}
