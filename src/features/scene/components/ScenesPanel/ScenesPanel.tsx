import { useMemo, useState } from "react";
import {
  IconFolder,
  IconMap2,
  IconPlus,
  IconSearch
} from "@tabler/icons-react";

import type { FC } from "react";

type SceneSummary = {
  id: string;
  name: string;
  folderId: string;
  description?: string;
  previewGradient: string;
};

type SceneFolder = {
  id: string;
  name: string;
  accent: string;
};

const SCENE_FOLDERS: SceneFolder[] = [
  { id: "old", name: "Old Scenes", accent: "purple" },
  { id: "unfinished", name: "Unfinished Scenes", accent: "maroon" },
  { id: "prepared", name: "Prepared Scenes", accent: "green" }
];

const SCENE_DATA: SceneSummary[] = [
  {
    id: "crossroad",
    name: "Crossroad",
    folderId: "old",
    previewGradient:
      "linear-gradient(135deg, rgba(74, 104, 152, 0.82), rgba(30, 42, 78, 0.92)), url('https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=60')"
  },
  {
    id: "docks",
    name: "Docks",
    folderId: "unfinished",
    previewGradient:
      "linear-gradient(150deg, rgba(58, 88, 118, 0.85), rgba(18, 26, 46, 0.94)), url('https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=60')"
  },
  {
    id: "tavern",
    name: "Tavern",
    folderId: "prepared",
    previewGradient:
      "linear-gradient(155deg, rgba(120, 74, 52, 0.78), rgba(20, 16, 12, 0.92)), url('https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=600&q=60')"
  }
];

const ScenesPanel: FC = () => {
  const [query, setQuery] = useState("");

  const filteredScenes = useMemo(() => {
    if (!query.trim()) {
      return SCENE_DATA;
    }

    const normalized = query.trim().toLowerCase();

    return SCENE_DATA.filter((scene) =>
      [scene.name, scene.description]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized))
    );
  }, [query]);

  const groupedScenes = useMemo(() => {
    return SCENE_FOLDERS.map((folder) => ({
      folder,
      scenes: filteredScenes.filter((scene) => scene.folderId === folder.id)
    })).filter(({ scenes }) => scenes.length > 0);
  }, [filteredScenes]);

  return (
    <div className="scenes-panel">
      <header className="scenes-panel__header" aria-label="Scene controls">
        <div className="scenes-panel__primary-actions">
          <button type="button" className="scenes-panel__action scenes-panel__action--primary">
            <IconPlus aria-hidden="true" stroke={1.6} />
            <span>Create Scene</span>
          </button>
          <button type="button" className="scenes-panel__action">
            <IconFolder aria-hidden="true" stroke={1.6} />
            <span>Create Folder</span>
          </button>
        </div>
        <label className="scenes-panel__search" htmlFor="scenes-panel-search">
          <IconSearch aria-hidden="true" stroke={1.6} />
          <input
            id="scenes-panel-search"
            type="search"
            placeholder="Search Scenes"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </header>

      <div className="scenes-panel__folders">
        {groupedScenes.length === 0 ? (
          <div className="scenes-panel__empty">No scenes match your search.</div>
        ) : (
          groupedScenes.map(({ folder, scenes }) => (
            <section
              key={folder.id}
              className={"scenes-panel__folder"}
              aria-labelledby={`scene-folder-${folder.id}`}
            >
              <header
                className={"scenes-panel__folder-header"}
                data-accent={folder.accent}
                id={`scene-folder-${folder.id}`}
              >
                <div className="scenes-panel__folder-label">
                  <IconFolder aria-hidden="true" stroke={1.6} />
                  <span>{folder.name}</span>
                </div>
                <IconMap2 aria-hidden="true" stroke={1.6} />
              </header>
              <ul className="scenes-panel__list">
                {scenes.map((scene) => (
                  <li key={scene.id} className="scenes-panel__list-item">
                    <button
                      type="button"
                      className="scenes-panel__scene"
                      style={{ backgroundImage: scene.previewGradient }}
                    >
                      <span className="scenes-panel__scene-name">{scene.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
};

export default ScenesPanel;
