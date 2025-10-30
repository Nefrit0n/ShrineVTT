import { useState } from "react";
import {
    IconMessage,
    IconSwords,
    IconMap2,
    IconUsersGroup,
    IconPackage,
    IconBook,
    IconTable,
    IconCards,
    IconMusic,
    IconArchive,
    IconSettings,
} from "@tabler/icons-react";
import clsx from "clsx";

const tabs = [
    { id: "chat", label: "Chat", icon: IconMessage },
    { id: "combat", label: "Combat", icon: IconSwords },
    { id: "scenes", label: "Scenes", icon: IconMap2 },
    { id: "actors", label: "Actors", icon: IconUsersGroup },
    { id: "items", label: "Items", icon: IconPackage },
    { id: "journal", label: "Journal", icon: IconBook },
    { id: "tables", label: "Roll Tables", icon: IconTable },
    { id: "cards", label: "Cards", icon: IconCards },
    { id: "music", label: "Music", icon: IconMusic },
    { id: "compendium", label: "Compendium", icon: IconArchive },
    { id: "settings", label: "Settings", icon: IconSettings },
];

export default function SidebarRight() {
    const [active, setActive] = useState("chat");

    return (
        <div className="absolute right-0 top-0 h-full w-80 flex flex-col bg-[#ffffff0f] backdrop-blur-lg border-l border-white/10 z-20">
            <nav className="flex flex-wrap items-center gap-1 p-2 border-b border-white/10">
                {tabs.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActive(id)}
                        title={label}
                        className={clsx(
                            "flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-white transition",
                            active === id && "text-white bg-[#3B82F6]/30 shadow-[0_0_6px_#3B82F6]"
                        )}
                    >
                        <Icon size={18} stroke={1.8} />
                    </button>
                ))}
            </nav>

            <div className="flex-1 overflow-y-auto p-3 text-sm text-gray-200">
                {active === "chat" && (
                    <div>
                        <h2 className="text-lg font-semibold mb-2">Chat</h2>
                        <p>Messages, rolls, and whispers appear here.</p>
                    </div>
                )}
                {active === "combat" && (
                    <div>
                        <h2 className="text-lg font-semibold mb-2">Combat Tracker</h2>
                        <p>Start and track encounters.</p>
                    </div>
                )}
                {active === "scenes" && <p>Scenes overview and management.</p>}
                {active === "actors" && <p>Players, creatures, and NPCs list.</p>}
                {active === "items" && <p>All items, spells, and abilities.</p>}
                {active === "journal" && <p>Notes and adventure logs.</p>}
                {active === "tables" && <p>Random roll tables.</p>}
                {active === "cards" && <p>Decks and hands management.</p>}
                {active === "music" && <p>Music and soundboards.</p>}
                {active === "compendium" && <p>Long-term data storage.</p>}
                {active === "settings" && <p>World and module configuration.</p>}
            </div>
        </div>
    );
}
