import { useState } from "react";
import {
    IconUsers,
    IconRulerMeasure,
    IconPhoto,
    IconPencil,
    IconWall,
    IconBulb,
    IconVolume,
    IconNote,
} from "@tabler/icons-react";
import clsx from "clsx";

const tools = [
    { id: "tokens", icon: IconUsers, label: "Tokens" },
    { id: "rulers", icon: IconRulerMeasure, label: "Rulers" },
    { id: "tiles", icon: IconPhoto, label: "Tiles" },
    { id: "drawings", icon: IconPencil, label: "Drawings" },
    { id: "walls", icon: IconWall, label: "Walls" },
    { id: "lights", icon: IconBulb, label: "Lights" },
    { id: "audio", icon: IconVolume, label: "Ambient Audio" },
    { id: "notes", icon: IconNote, label: "Notes" },
];

export default function Sidebar() {
    const [active, setActive] = useState("tokens");

    return (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-3 rounded-2xl bg-[#ffffff0f] backdrop-blur-lg border border-white/10 shadow-lg p-2">
            {tools.map((tool) => {
                const Icon = tool.icon;
                const isActive = tool.id === active;
                return (
                    <button
                        key={tool.id}
                        onClick={() => setActive(tool.id)}
                        className={clsx(
                            "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                            isActive
                                ? "bg-[#3B82F6]/40 text-white shadow-[0_0_10px_#3B82F6]"
                                : "text-gray-400 hover:text-white hover:bg-white/10"
                        )}
                        title={tool.label}
                    >
                        <Icon size={20} stroke={1.8} />
                    </button>
                );
            })}
        </div>
    );
}
