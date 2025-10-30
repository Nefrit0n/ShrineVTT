import * as ScrollArea from "@radix-ui/react-scroll-area";

const SIDEBAR_SECTIONS = [
  {
    title: "Chat",
    description:
      "Chat messages, whispers, item uses, and rolls appear here. Choose who sees the results by switching between Public Roll, Private GM Roll, Blind GM Roll, or Self-Roll."
  },
  {
    title: "Combat",
    description: "Launch encounters, track initiative, and manage turn order without leaving the canvas."
  },
  {
    title: "Scenes",
    description: "Store theater of the mind setups and tactical battle maps so you can swap between them instantly."
  },
  {
    title: "Actors",
    description: "Keep player characters, creatures, and NPCs organized here for quick access to their sheets."
  },
  {
    title: "Items",
    description: "Items, spells, character abilities, and more live here—ready for you to drag onto character sheets or the scene."
  },
  {
    title: "Journal Entries",
    description: "Plan adventures, track progress, and capture notes. Pin important pages into the scene as Notes for easy reference."
  },
  {
    title: "Roll Tables",
    description: "Build random tables to roll for treasure, encounters, inspiration, or any other surprise you want to spring."
  },
  {
    title: "Cards",
    description: "Manage decks, stacks, and player hands so card-driven mechanics stay organized."
  },
  {
    title: "Music",
    description:
      "Playlists and soundboards are curated here. Each player can independently adjust their own volume from this tab."
  },
  {
    title: "Compendium Packs",
    description:
      "Long-term storage for everything in your World (except encounters). Use it as cold storage to help the World load faster."
  },
  {
    title: "Settings",
    description:
      "Configure settings and controls, manage modules, edit World details, manage users, launch tours, generate support reports, explore documentation, get invitation links, log out, or return to setup. Some options are GM-only."
  }
];

export default function Sidebar() {
  return (
    <aside className="panel floating-sidebar" aria-label="World sidebar">
      <header>
        <span className="tag">World Data</span>
        <h2>The Sidebar</h2>
        <p>
          Access every dataset that powers your World—from chat history to compendium packs—without closing the action on the
          canvas.
        </p>
      </header>

      <ScrollArea.Root className="scroll-area" type="auto">
        <ScrollArea.Viewport className="scroll-area scroll-area__viewport">
          <div className="sidebar-section" role="list">
            {SIDEBAR_SECTIONS.map((section) => (
              <article className="sidebar-card" key={section.title} role="listitem">
                <h3>{section.title}</h3>
                <p>{section.description}</p>
              </article>
            ))}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className="scrollbar" orientation="vertical">
          <ScrollArea.Thumb className="scrollbar-thumb" />
        </ScrollArea.Scrollbar>
        <ScrollArea.Corner />
      </ScrollArea.Root>
    </aside>
  );
}
