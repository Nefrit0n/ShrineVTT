import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

import { Panel } from "@/shared/components/Panel";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

import type { WorldSidebarProps, WorldSidebarSection } from "./WorldSidebar.types";

export default function WorldSidebar({ sections, initialSectionId }: WorldSidebarProps) {
  const [activeTab, setActiveTab] = useState<string>(
    initialSectionId ?? sections[0]?.id ?? "chat"
  );
  const tabsViewportRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const activeSection = useMemo<WorldSidebarSection | undefined>(
    () => sections.find((section) => section.id === activeTab),
    [activeTab, sections]
  );

  useEffect(() => {
    const el = tabsViewportRef.current;
    if (!el) return;

    const activeButton = el.querySelector<HTMLButtonElement>(
      `#world-sidebar-tab-${activeTab}`
    );

    activeButton?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [activeTab]);

  const updateScrollState = useCallback(() => {
    const el = tabsViewportRef.current;
    if (!el) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
    const tolerance = 2;

    setCanScrollLeft(scrollLeft > tolerance);
    setCanScrollRight(scrollLeft < maxScrollLeft - tolerance);
  }, []);

  useEffect(() => {
    const el = tabsViewportRef.current;
    if (!el) return;

    updateScrollState();

    const handleScroll = () => updateScrollState();
    el.addEventListener("scroll", handleScroll, { passive: true });

    window.addEventListener("resize", updateScrollState);

    return () => {
      el.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  useEffect(() => {
    updateScrollState();
  }, [sections, updateScrollState]);

  const scrollTabs = useCallback((direction: "left" | "right") => {
    const el = tabsViewportRef.current;
    if (!el) return;

    const { clientWidth, scrollLeft, scrollWidth } = el;
    const scrollAmount = Math.max(0, Math.floor(clientWidth * 0.75));
    const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
    const target =
      direction === "left"
        ? Math.max(0, scrollLeft - scrollAmount)
        : Math.min(maxScrollLeft, scrollLeft + scrollAmount);

    el.scrollTo({ left: target, behavior: "smooth" });
  }, []);

  return (
    <aside className="world-sidebar" aria-label="World sidebar">
      <div className="world-sidebar__tabs">
        <button
          type="button"
          className="world-sidebar__scroll world-sidebar__scroll--prev"
          onClick={() => scrollTabs("left")}
          aria-label="Scroll sidebar tabs left"
          disabled={!canScrollLeft}
        >
          <IconChevronLeft aria-hidden="true" stroke={1.6} />
        </button>
        <div className="world-sidebar__tabs-viewport" ref={tabsViewportRef}>
          <nav className="world-sidebar__tablist" role="tablist" aria-label="World navigation">
            {sections.map(({ id, title, icon: Icon }) => {
              const isActive = id === activeTab;

              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  id={`world-sidebar-tab-${id}`}
                  aria-controls={`world-sidebar-tabpanel-${id}`}
                  className={clsx("world-sidebar__tab", { "world-sidebar__tab--active": isActive })}
                  onClick={() => setActiveTab(id)}
                >
                  <Icon aria-hidden="true" stroke={1.6} />
                  <span className="sr-only">{title}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <button
          type="button"
          className="world-sidebar__scroll world-sidebar__scroll--next"
          onClick={() => scrollTabs("right")}
          aria-label="Scroll sidebar tabs right"
          disabled={!canScrollRight}
        >
          <IconChevronRight aria-hidden="true" stroke={1.6} />
        </button>
      </div>

      <Panel
        padding="sm"
        className="world-sidebar__content"
        aria-labelledby={activeSection ? `world-sidebar-tab-${activeSection.id}` : undefined}
        role="tabpanel"
        id={activeSection ? `world-sidebar-tabpanel-${activeSection.id}` : undefined}
      >
        {activeSection && (
          <header className="world-sidebar__content-header">
            <div className="world-sidebar__content-heading">
              <h3>{activeSection.title}</h3>
              {activeSection.description && <p>{activeSection.description}</p>}
            </div>
          </header>
        )}
        <div className="world-sidebar__content-body">
          {activeSection?.content ?? (
            <p className="sidebar-placeholder">Select a tab to view its tools.</p>
          )}
        </div>
      </Panel>
    </aside>
  );
}
