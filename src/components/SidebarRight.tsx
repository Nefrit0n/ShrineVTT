import * as ScrollArea from "@radix-ui/react-scroll-area";
import { IconWriting } from "@tabler/icons-react";
import clsx from "clsx";

type ReferenceSection = {
  title: string;
  items: string[];
};

type QuickNote = {
  heading: string;
  body: string;
};

type SessionLog = {
  lastUpdated: string;
  description: string;
};

type SidebarRightProps = {
  referenceSections: ReferenceSection[];
  quickNotes: QuickNote[];
  sessionLog: SessionLog;
};

export default function SidebarRight({ referenceSections, quickNotes, sessionLog }: SidebarRightProps) {
  return (
    <aside className={clsx("panel", "sidebar")} aria-label="Game sidebar">
      <div className="sidebar-section">
        <header>
          <h2>Reference</h2>
        </header>
        <ScrollArea.Root className={clsx("scroll-area")} type="auto">
          <ScrollArea.Viewport style={{ height: "100%" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingRight: 8 }}>
              {referenceSections.map(({ title, items }) => (
                <section key={title} className="sidebar-card">
                  <h3>{title}</h3>
                  <ul>
                    {items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
              {quickNotes.map(({ heading, body }) => (
                <section key={heading} className="sidebar-card">
                  <h3>{heading}</h3>
                  <p>{body}</p>
                </section>
              ))}
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" style={{ width: 8 }}>
            <ScrollArea.Thumb className="scrollbar-thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </div>
      <div className="sidebar-section">
        <header>
          <h2>Session Log</h2>
        </header>
        <div className="sidebar-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="tag">
            <IconWriting size={16} />
            {sessionLog.lastUpdated}
          </div>
          <p>{sessionLog.description}</p>
        </div>
      </div>
    </aside>
  );
}
