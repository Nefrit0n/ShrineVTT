import { useMemo, useState } from "react";
import {
  IconArchive,
  IconBackpack,
  IconCards,
  IconDice5,
  IconLayoutKanban,
  IconMessageCircle,
  IconMusic,
  IconNotebook,
  IconSettings,
  IconShield,
  IconUsers
} from "@tabler/icons-react";

const SIDEBAR_SECTIONS = [
  { id: "chat", title: "Chat", icon: IconMessageCircle },
  { id: "combat", title: "Combat", icon: IconShield },
  { id: "scenes", title: "Scenes", icon: IconLayoutKanban },
  { id: "actors", title: "Actors", icon: IconUsers },
  { id: "items", title: "Items", icon: IconBackpack },
  { id: "journals", title: "Journal Entries", icon: IconNotebook },
  { id: "tables", title: "Roll Tables", icon: IconDice5 },
  { id: "cards", title: "Cards", icon: IconCards },
  { id: "music", title: "Music", icon: IconMusic },
  { id: "compendium", title: "Compendium Packs", icon: IconArchive },
  { id: "settings", title: "Settings", icon: IconSettings }
] as const;

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<typeof SIDEBAR_SECTIONS[number]["id"]>(
    SIDEBAR_SECTIONS[0].id
  );

  const activeSection = useMemo(
    () => SIDEBAR_SECTIONS.find((section) => section.id === activeTab) ?? SIDEBAR_SECTIONS[0],
    [activeTab]
  );
  const ActiveIcon = activeSection.icon;

  return (
    <aside className="panel floating-sidebar" aria-label="World sidebar">
      <nav className="sidebar-tabs" role="tablist" aria-label="World navigation">
        {SIDEBAR_SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = section.id === activeTab;

          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              id={`sidebar-tab-${section.id}`}
              aria-controls={`sidebar-tabpanel-${section.id}`}
              className={`sidebar-tab ${isActive ? "sidebar-tab--active" : ""}`}
              title={section.title}
              onClick={() => setActiveTab(section.id)}
            >
              <Icon aria-hidden="true" stroke={1.6} />
              <span className="scene-tools__sr-only">{section.title}</span>
            </button>
          );
        })}
      </nav>

      <div
        id={`sidebar-tabpanel-${activeSection.id}`}
        role="tabpanel"
        aria-labelledby={`sidebar-tab-${activeSection.id}`}
        className="sidebar-focus"
      >
        <div className="sidebar-focus__icon" aria-hidden="true">
          <ActiveIcon stroke={1.6} />
        </div>
        <h3>{activeSection.title}</h3>
      </div>
    </aside>
  );
}
