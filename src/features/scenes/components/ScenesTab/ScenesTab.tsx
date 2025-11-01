import {
  ChangeEvent,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import {
  IconCopy,
  IconDotsVertical,
  IconInfoCircle,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";

import {
  activateScene,
  createScene,
  deleteScene,
  duplicateScene,
  fetchScene,
  reorderScenes,
  updateScene,
} from "../../api/scenesApi";
import type { Scene, SceneCreatePayload, SceneMode, SceneStatus } from "../../types";

import SceneEditor from "./SceneEditor";
import SceneList from "./SceneList";
import ScenePreview from "./ScenePreview";
import styles from "./ScenesTab.module.css";
import type { EditorSection, SceneFormState } from "./ScenesTab.shared";

type ScenesTabProps = {
  scenes: Scene[];
  activeSceneId: string | null;
  onScenesUpdated: () => Promise<void> | void;
  onActivateLocally: (sceneId: string) => void;
};

type EditorState = {
  open: boolean;
  mode: "create" | "edit";
};

type MenuState = {
  scene: Scene;
  anchor: { x: number; y: number };
};

const STATUS_LABELS: Record<SceneStatus, string> = {
  active: "Активна",
  hidden: "Скрыта",
  draft: "Черновик",
};

const MODE_LABELS: Record<SceneMode, string> = {
  theatre: "Театр воображения",
  tactical: "Тактическая карта",
};

const STATUS_CLASSNAMES: Record<SceneStatus, string> = {
  active: styles.statusActive,
  hidden: styles.statusHidden,
  draft: styles.statusDraft,
};

const emptyFormState: SceneFormState = {
  name: "",
  backgroundUrl: "",
  width: "40",
  height: "40",
  gridSize: "5",
  mode: "theatre",
  status: "draft",
  tags: [],
};

export default function ScenesTab({
  scenes,
  activeSceneId,
  onScenesUpdated,
  onActivateLocally,
}: ScenesTabProps) {
  const [list, setList] = useState<Scene[]>(scenes);
  const [searchValue, setSearchValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [previewScene, setPreviewScene] = useState<Scene | null>(null);
  const [menuState, setMenuState] = useState<MenuState | null>(null);

  const [editorState, setEditorState] = useState<EditorState>({
    open: false,
    mode: "create",
  });
  const [formState, setFormState] = useState<SceneFormState>(emptyFormState);
  const [initialFormState, setInitialFormState] = useState<SceneFormState>(emptyFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<EditorSection, boolean>>({
    basics: false,
    dimensions: false,
    parameters: false,
  });

  useEffect(() => {
    setList(scenes);
  }, [scenes]);

  useEffect(() => {
    const handle = window.setTimeout(() => setSearchQuery(searchValue), 300);
    return () => window.clearTimeout(handle);
  }, [searchValue]);

  const syncScenes = useCallback(async () => {
    await Promise.resolve(onScenesUpdated());
  }, [onScenesUpdated]);

  const filteredScenes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return list;

    return list.filter((scene) => {
      const haystack = [scene.name, ...(scene.tags ?? [])].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [list, searchQuery]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    list.forEach((scene) => scene.tags?.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, "ru"));
  }, [list]);

  const backgroundPreview = formState.backgroundData || formState.backgroundUrl;

  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchValue(event.target.value);
  }, []);

  const handleOpenCreate = useCallback(() => {
    setEditorState({ open: true, mode: "create" });
    setFormState(emptyFormState);
    setInitialFormState(emptyFormState);
    setFormError(null);
    setCollapsedSections({ basics: false, dimensions: false, parameters: false });
  }, []);

  const handleCloseEditor = useCallback(() => {
    setEditorState({ open: false, mode: "create" });
    setFormState(emptyFormState);
    setInitialFormState(emptyFormState);
    setFormError(null);
  }, []);

  useEffect(() => {
    if (!list.length && !editorState.open) {
      handleOpenCreate();
    }
  }, [editorState.open, handleOpenCreate, list.length]);

  const handleOpenEdit = useCallback(async (sceneId: string) => {
    try {
      setBusy(true);
      const existing = await fetchScene(sceneId);
      const nextForm: SceneFormState = {
        id: existing.id,
        name: existing.name,
        backgroundUrl: existing.background ?? "",
        width: String(existing.width ?? 40),
        height: String(existing.height ?? 40),
        gridSize: String(existing.gridSize ?? 5),
        mode: existing.mode,
        status: existing.status,
        tags: existing.tags ?? [],
      };
      setEditorState({ open: true, mode: "edit" });
      setFormState(nextForm);
      setInitialFormState(nextForm);
      setFormError(null);
      setCollapsedSections({ basics: false, dimensions: false, parameters: false });
      setGlobalError(null);
    } catch (error) {
      console.error(error);
      setGlobalError("Не удалось загрузить сцену");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleFormChange = useCallback(<K extends keyof SceneFormState>(key: K, value: SceneFormState[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleTagsChange = useCallback((tags: string[]) => {
    setFormState((prev) => ({ ...prev, tags }));
  }, []);

  const handleToggleSection = useCallback((section: EditorSection) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const handleResetForm = useCallback(() => {
    setFormState(initialFormState);
    setFormError(null);
  }, [initialFormState]);

  const handleBackgroundFileChange = useCallback(async (file: File | null) => {
    if (!file) {
      setFormState((prev) => ({ ...prev, backgroundData: undefined }));
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setFormState((prev) => ({ ...prev, backgroundData: dataUrl }));
    } catch (error) {
      console.error(error);
      setFormError("Не удалось прочитать файл изображения");
    }
  }, []);

  const handleFormSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFormError(null);

      if (!formState.name.trim()) {
        setFormError("Введите название сцены");
        return;
      }

      const width = Number.parseInt(formState.width, 10) || 0;
      const height = Number.parseInt(formState.height, 10) || 0;
      const gridSize = Number.parseInt(formState.gridSize, 10) || 0;

      if (width <= 0 || height <= 0 || gridSize <= 0) {
        setFormError("Проверьте размеры карты и размер сетки");
        return;
      }

      const imageValue = formState.backgroundData || formState.backgroundUrl.trim() || undefined;

      const payload: SceneCreatePayload = {
        name: formState.name.trim(),
        background: imageValue,
        thumbnail: imageValue,
        width,
        height,
        gridSize,
        mode: formState.mode,
        status: formState.status,
        tags: formState.tags,
      };

      try {
        setBusy(true);
        if (editorState.mode === "create") {
          await createScene(payload);
        } else if (formState.id) {
          await updateScene(formState.id, payload);
        }
        setGlobalError(null);
        await syncScenes();
        handleCloseEditor();
      } catch (error) {
        console.error(error);
        setFormError("Не удалось сохранить сцену");
      } finally {
        setBusy(false);
      }
    },
    [editorState.mode, formState, handleCloseEditor, syncScenes]
  );

  const handleActivate = useCallback(
    async (sceneId: string) => {
      try {
        setBusy(true);
        await activateScene(sceneId);
        onActivateLocally(sceneId);
        setGlobalError(null);
        await syncScenes();
      } catch (error) {
        console.error(error);
        setGlobalError("Не удалось активировать сцену");
      } finally {
        setBusy(false);
      }
    },
    [onActivateLocally, syncScenes]
  );

  const handleDuplicate = useCallback(
    async (sceneId: string) => {
      try {
        setBusy(true);
        await duplicateScene(sceneId);
        setGlobalError(null);
        await syncScenes();
      } catch (error) {
        console.error(error);
        setGlobalError("Не удалось создать копию сцены");
      } finally {
        setBusy(false);
      }
    },
    [syncScenes]
  );

  const handleDelete = useCallback(
    async (sceneId: string) => {
      if (!window.confirm("Удалить эту сцену?")) return;
      try {
        setBusy(true);
        await deleteScene(sceneId);
        setGlobalError(null);
        await syncScenes();
      } catch (error) {
        console.error(error);
        setGlobalError("Не удалось удалить сцену");
      } finally {
        setBusy(false);
      }
    },
    [syncScenes]
  );

  const handlePreview = useCallback((scene: Scene) => {
    setPreviewScene(scene);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewScene(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewScene(null);
        setMenuState(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleOpenMenu = useCallback(
    (scene: Scene, event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      setMenuState({
        scene,
        anchor: { x: rect.left, y: rect.bottom + 6 },
      });
    },
    []
  );

  const handleCloseMenu = useCallback(() => {
    setMenuState(null);
  }, []);

  useEffect(() => {
    if (!menuState) return;

    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      if (event.target.closest(`.${styles.menuPortal}`)) return;
      handleCloseMenu();
    };

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [handleCloseMenu, menuState]);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return;
      if (result.source.index === result.destination.index) return;

      const next = reorder(list, result.source.index, result.destination.index);
      setList(next);

      try {
        setBusy(true);
        await reorderScenes(next.map((scene) => scene.id));
        setGlobalError(null);
        await syncScenes();
      } catch (error) {
        console.error(error);
        setGlobalError("Не удалось изменить порядок сцен");
      } finally {
        setBusy(false);
      }
    },
    [list, syncScenes]
  );

  const totalCount = list.length;
  const filteredCount = filteredScenes.length;

  return (
    <div className={styles.scenesTab}>
      <header className={styles.tabHeader}>
        <h2 className={styles.tabTitle}>Сцены</h2>
        <button
          type="button"
          className={styles.createButton}
          onClick={handleOpenCreate}
        >
          <IconPlus size={16} stroke={1.8} /> Создать новую сцену
        </button>
      </header>

      <div className={styles.searchRow}>
        <label className={styles.searchLabel}>
          <span className="sr-only">Поиск сцен</span>
          <input
            type="search"
            value={searchValue}
            onChange={handleSearchChange}
            className={styles.searchInput}
            placeholder="Поиск сцен"
            aria-label="Поиск сцен"
          />
        </label>
        <span className={styles.counter} aria-live="polite">
          {filteredCount} из {totalCount}
        </span>
      </div>

      {globalError ? (
        <p className={styles.globalError} role="alert">
          {globalError}
        </p>
      ) : null}

      <div className={clsx(styles.layout, { [styles.singleColumn]: !editorState.open })}>
        {editorState.open ? (
          <SceneEditor
            mode={editorState.mode}
            state={formState}
            error={formError}
            collapsed={collapsedSections}
            backgroundPreview={backgroundPreview}
            allTags={allTags}
            isBusy={isBusy}
            onClose={handleCloseEditor}
            onChange={handleFormChange}
            onSubmit={handleFormSubmit}
            onReset={handleResetForm}
            onToggleSection={handleToggleSection}
            onBackgroundFileChange={handleBackgroundFileChange}
            onTagsChange={handleTagsChange}
          />
        ) : null}

        <DragDropContext onDragEnd={handleDragEnd}>
          <SceneList
            scenes={filteredScenes}
            activeSceneId={activeSceneId}
            isBusy={isBusy}
            statusLabels={STATUS_LABELS}
            statusClassNames={STATUS_CLASSNAMES}
            modeLabels={MODE_LABELS}
            onActivate={handleActivate}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
            onPreview={handlePreview}
            onOpenMenu={handleOpenMenu}
          />
        </DragDropContext>
      </div>

      {menuState &&
        createPortal(
          <div
            className={styles.menuPortal}
            style={{ left: menuState.anchor.x, top: menuState.anchor.y }}
            role="menu"
          >
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => {
                handleCloseMenu();
                handleDuplicate(menuState.scene.id);
              }}
            >
              <IconCopy size={16} stroke={1.6} /> Создать копию
            </button>
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => {
                handleCloseMenu();
                handlePreview(menuState.scene);
              }}
            >
              <IconInfoCircle size={16} stroke={1.6} /> Предпросмотр
            </button>
            <button
              type="button"
              className={clsx(styles.menuItem, styles.menuItemDanger)}
              onClick={() => {
                handleCloseMenu();
                handleDelete(menuState.scene.id);
              }}
            >
              <IconTrash size={16} stroke={1.6} /> Удалить сцену
            </button>
          </div>,
          document.body
        )}

      {previewScene ? (
        <ScenePreview
          scene={previewScene}
          statusLabels={STATUS_LABELS}
          statusClassNames={STATUS_CLASSNAMES}
          modeLabels={MODE_LABELS}
          onActivate={async () => {
            await handleActivate(previewScene.id);
            setPreviewScene(null);
          }}
          onClose={handleClosePreview}
          isBusy={isBusy}
        />
      ) : null}
    </div>
  );
}

function reorder(items: Scene[], startIndex: number, endIndex: number) {
  const result = [...items];
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
