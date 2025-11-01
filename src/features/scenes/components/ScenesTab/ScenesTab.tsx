import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import {
  IconCheck,
  IconCopy,
  IconDotsVertical,
  IconInfoCircle,
  IconPencil,
  IconPhoto,
  IconPlayerPlay,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { FixedSizeList, ListChildComponentProps } from "react-window";

import {
  activateScene,
  createScene,
  deleteScene,
  duplicateScene,
  fetchScene,
  updateScene,
} from "../../api/scenesApi";
import type { Scene, SceneCreatePayload, SceneStatus } from "../../types";

import styles from "./ScenesTab.module.css";

const STATUS_LABELS: Record<SceneStatus, string> = {
  active: "Активна",
  hidden: "Скрыта",
  draft: "Черновик",
};

const MODE_LABELS = {
  theatre: "Театр воображения",
  tactical: "Тактическая карта",
} as const;

const STATUS_STYLE_CLASS: Record<SceneStatus, string> = {
  active: styles.statusActive,
  draft: styles.statusDraft,
  hidden: styles.statusHidden,
};

const ITEM_HEIGHT = 196;
const SEARCH_DEBOUNCE = 300;

type SceneFormState = {
  id?: string;
  name: string;
  backgroundUrl: string;
  backgroundData?: string;
  width: string;
  height: string;
  gridSize: string;
  mode: SceneCreatePayload["mode"];
  status: SceneCreatePayload["status"];
  tags: string[];
};

type ScenesTabProps = {
  scenes: Scene[];
  activeSceneId: string | null;
  onScenesUpdated: () => Promise<void> | void;
  onActivateLocally: (sceneId: string) => void;
};

type MenuState = {
  sceneId: string;
  x: number;
  y: number;
};

type TagInputProps = {
  value: string[];
  suggestions: string[];
  onChange: (next: string[]) => void;
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

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;
    const rect = element.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, size } as const;
}

// Чипы тегов с автодополнением и быстрым удалением
function TagInput({ value, suggestions, onChange }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setFocused] = useState(false);

  const availableSuggestions = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    return suggestions
      .filter((tag) => !value.includes(tag))
      .filter((tag) => (query ? tag.toLowerCase().includes(query) : true))
      .slice(0, 6);
  }, [inputValue, suggestions, value]);

  const addTag = useCallback(
    (next: string) => {
      const normalized = next.trim();
      if (!normalized || value.includes(normalized)) return;
      onChange([...value, normalized]);
      setInputValue("");
    },
    [onChange, value]
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(value.filter((item) => item !== tag));
    },
    [onChange, value]
  );

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(inputValue);
    } else if (event.key === "Backspace" && !inputValue && value.length) {
      event.preventDefault();
      removeTag(value[value.length - 1]);
    }
  };

  const handleSuggestionClick = (tag: string) => {
    addTag(tag);
  };

  return (
    <div className={styles.tagInput}>
      {value.map((tag) => (
        <span key={tag} className={styles.tagChip}>
          {tag}
          <button
            type="button"
            className={styles.tagRemove}
            aria-label={`Удалить тег ${tag}`}
            onClick={() => removeTag(tag)}
          >
            <IconX size={14} stroke={1.5} />
          </button>
        </span>
      ))}
      <div className={styles.suggestions}>
        <input
          className={styles.tagInputField}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setFocused(false), 120);
          }}
          placeholder={value.length ? "Добавить тег" : "Введите тег"}
          aria-label="Теги"
        />
        {isFocused && availableSuggestions.length > 0 && (
          <ul className={styles.suggestionsList} role="listbox">
            {availableSuggestions.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  className={styles.suggestionButton}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSuggestionClick(tag)}
                >
                  {tag}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Обёртка для тултипов, чтобы подсказать режим и статус
function TooltipLabel({
  children,
  description,
}: {
  children: string;
  description: string;
}) {
  return (
    <span className={styles.tooltip}>
      {children}
      <IconInfoCircle size={16} stroke={1.6} aria-hidden />
      <span className={styles.tooltipText}>{description}</span>
    </span>
  );
}

export default function ScenesTab({
  scenes,
  activeSceneId,
  onScenesUpdated,
  onActivateLocally,
}: ScenesTabProps) {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const [formState, setFormState] = useState<SceneFormState>(emptyFormState);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formError, setFormError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [previewScene, setPreviewScene] = useState<Scene | null>(null);
  const [menuState, setMenuState] = useState<MenuState | null>(null);

  const { ref: listContainerRef, size: listSize } = useElementSize<HTMLDivElement>();

  // Debounce поиска, чтобы не дёргать фильтрацию на каждый ввод
  useEffect(() => {
    const handle = window.setTimeout(() => setSearchQuery(searchInput), SEARCH_DEBOUNCE);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const syncScenes = useCallback(async () => {
    await Promise.resolve(onScenesUpdated());
  }, [onScenesUpdated]);

  const filteredScenes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return scenes;

    return scenes.filter((scene) => {
      const haystack = [scene.name, ...(scene.tags ?? [])].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [scenes, searchQuery]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    scenes.forEach((scene) => scene.tags?.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, "ru"));
  }, [scenes]);

  const backgroundPreview = formState.backgroundData || formState.backgroundUrl;

  const resetFormState = useCallback(() => {
    setFormState(emptyFormState);
    setFormMode("create");
    setFormError(null);
  }, []);

  const openCreateForm = useCallback(() => {
    resetFormState();
    setFormOpen(true);
  }, [resetFormState]);

  const closeForm = useCallback(() => {
    resetFormState();
    setFormOpen(false);
  }, [resetFormState]);

  useEffect(() => {
    if (!scenes.length) {
      resetFormState();
      setFormOpen(true);
    }
  }, [resetFormState, scenes.length]);

  const handleOpenEdit = useCallback(
    async (sceneId: string) => {
      try {
        setSubmitting(true);
        const existing = await fetchScene(sceneId);
        setFormState({
          id: existing.id,
          name: existing.name,
          backgroundUrl: existing.background ?? "",
          width: String(existing.width ?? 40),
          height: String(existing.height ?? 40),
          gridSize: String(existing.gridSize ?? 5),
          mode: existing.mode,
          status: existing.status,
          tags: existing.tags ?? [],
        });
        setFormMode("edit");
        setFormError(null);
        setGlobalError(null);
        setFormOpen(true);
      } catch (error) {
        console.error(error);
        setGlobalError("Не удалось загрузить данные сцены");
      } finally {
        setSubmitting(false);
      }
    },
    []
  );

  const handleActivate = useCallback(
    async (sceneId: string) => {
      try {
        setSubmitting(true);
        await activateScene(sceneId);
        onActivateLocally(sceneId);
        setGlobalError(null);
        await syncScenes();
      } catch (error) {
        console.error(error);
        setGlobalError("Не удалось активировать сцену");
      } finally {
        setSubmitting(false);
      }
    },
    [onActivateLocally, syncScenes]
  );

  const handleDuplicate = useCallback(
    async (sceneId: string) => {
      try {
        setSubmitting(true);
        await duplicateScene(sceneId);
        setGlobalError(null);
        await syncScenes();
      } catch (error) {
        console.error(error);
        setGlobalError("Не удалось создать копию сцены");
      } finally {
        setSubmitting(false);
      }
    },
    [syncScenes]
  );

  const handleDelete = useCallback(
    async (sceneId: string) => {
      if (!window.confirm("Удалить эту сцену?")) return;
      try {
        setSubmitting(true);
        await deleteScene(sceneId);
        setGlobalError(null);
        await syncScenes();
      } catch (error) {
        console.error(error);
        setGlobalError("Не удалось удалить сцену");
      } finally {
        setSubmitting(false);
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

  const handleBackgroundFileChange = async (
    event: FormEvent<HTMLInputElement>
  ) => {
    const file = event.currentTarget.files?.[0];
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
  };

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
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

    const payload: SceneCreatePayload = {
      name: formState.name.trim(),
      background: formState.backgroundData || formState.backgroundUrl.trim() || undefined,
      thumbnail: formState.backgroundData || formState.backgroundUrl.trim() || undefined,
      width,
      height,
      gridSize,
      mode: formState.mode,
      status: formState.status,
      tags: formState.tags,
    };

    try {
      setSubmitting(true);
      if (formMode === "create") {
        await createScene(payload);
      } else if (formState.id) {
        await updateScene(formState.id, payload);
      }
      setGlobalError(null);
      await syncScenes();
      closeForm();
    } catch (error) {
      console.error(error);
      setFormError("Не удалось сохранить сцену");
    } finally {
      setSubmitting(false);
    }
  };

  const listHeight = useMemo(() => {
    if (!filteredScenes.length) {
      return Math.max(Math.min(listSize.height || ITEM_HEIGHT, ITEM_HEIGHT), ITEM_HEIGHT);
    }

    const estimated = filteredScenes.length * ITEM_HEIGHT;
    const available = listSize.height || estimated;
    const minVisible = Math.min(estimated, ITEM_HEIGHT * Math.min(filteredScenes.length, 3));
    return Math.max(Math.min(estimated, available), minVisible);
  }, [filteredScenes.length, listSize.height]);

  const closeMenu = () => setMenuState(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      if (event.target.closest(`.${styles.menuPortal}`)) return;
      closeMenu();
    };

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const handleOpenMenu = (
    sceneId: string,
    event: ReactMouseEvent<HTMLButtonElement>
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuState({
      sceneId,
      x: rect.left,
      y: rect.bottom + 6,
    });
  };

  const SceneRow = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      const scene = filteredScenes[index];
      const isActive = scene.id === activeSceneId;

      return (
        <div style={style} className={styles.row}>
          <article
            className={clsx(styles.sceneCard, isActive && styles.sceneCardActive)}
            role="listitem"
          >
            <span
              className={clsx(styles.statusBadge, STATUS_STYLE_CLASS[scene.status])}
            >
              {STATUS_LABELS[scene.status]}
            </span>
            <button
              type="button"
              className={styles.cardPreview}
              onClick={() => handlePreview(scene)}
              aria-label={`Предпросмотр сцены ${scene.name}`}
            >
              {scene.thumbnail ? (
                <img src={scene.thumbnail} alt="Миниатюра сцены" />
              ) : (
                <span className={styles.cardPlaceholder}>Нет изображения</span>
              )}
            </button>
            <div className={styles.cardContent}>
              <div className={styles.cardHeader}>
                <h4 className={styles.sceneName}>{scene.name}</h4>
                <div className={styles.actionsRow}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => handleActivate(scene.id)}
                    disabled={isSubmitting}
                    aria-label="Открыть сцену"
                  >
                    <IconPlayerPlay size={18} stroke={1.8} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => handleOpenEdit(scene.id)}
                    disabled={isSubmitting}
                    aria-label="Редактировать сцену"
                  >
                    <IconPencil size={18} stroke={1.8} />
                  </button>
                  <button
                    type="button"
                    className={clsx(styles.iconButton, styles.deleteButton)}
                    onClick={() => handleDelete(scene.id)}
                    disabled={scene.id === activeSceneId || isSubmitting}
                    aria-label="Удалить сцену"
                  >
                    <IconTrash size={18} stroke={1.8} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={(event) => handleOpenMenu(scene.id, event)}
                    aria-label="Другие действия"
                  >
                    <IconDotsVertical size={18} stroke={1.8} />
                  </button>
                </div>
              </div>
              <div className={styles.meta}>
                <span>{MODE_LABELS[scene.mode]}</span>
                <span>{`${scene.width}×${scene.height}`} м</span>
                <span>{`Сетка ${scene.gridSize} м`}</span>
              </div>
              {scene.tags?.length ? (
                <div className={styles.tagsRow}>
                  {scene.tags.map((tag) => (
                    <span key={tag} className={styles.cardTag}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        </div>
      );
    },
    [activeSceneId, filteredScenes, handleActivate, handleDelete, handleOpenEdit, handlePreview, isSubmitting]
  );

  return (
    <div className={styles.scenesTab}>
      <div className={styles.actions}>
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className={styles.search}
          placeholder="Поиск сцен..."
          aria-label="Поиск по сценам"
        />
        <button
          type="button"
          className={styles.createButton}
          onClick={openCreateForm}
        >
          <IconCheck size={18} stroke={1.8} />
          Новая сцена
        </button>
      </div>

      {globalError ? (
        <p className={styles.globalError} role="alert">
          {globalError}
        </p>
      ) : null}

      <div
        className={clsx(
          styles.content,
          !(isFormOpen || formMode === "edit") && styles.contentSingleColumn
        )}
      >
        {(isFormOpen || formMode === "edit") && (
          <section className={styles.formPanel} aria-labelledby="scene-form-title">
          <div className={styles.formHeader}>
            <h3 id="scene-form-title" className={styles.formTitle}>
              {formMode === "create" ? "Создать сцену" : "Редактировать сцену"}
            </h3>
            {(isFormOpen || formMode === "edit") && (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={closeForm}
              >
                {formMode === "edit" ? "Отменить редактирование" : "Закрыть"}
              </button>
            )}
          </div>
          <form className={styles.formBody} onSubmit={handleFormSubmit}>
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Основное</h4>
              <label className={styles.field}>
                <span className={styles.labelRow}>Название</span>
                <input
                  type="text"
                  className={styles.input}
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, name: event.target.value }))
                  }
                  required
                  placeholder="Например, Лесная поляна"
                />
              </label>
              <div className={styles.field}>
                <span className={styles.labelRow}>Фон (загрузка или URL)</span>
                <div className={styles.fileRow}>
                  <label className={styles.fileButton}>
                    <IconPhoto size={18} stroke={1.8} /> Загрузить
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBackgroundFileChange}
                    />
                  </label>
                  <input
                    type="url"
                    className={styles.urlInput}
                    placeholder="https://..."
                    value={formState.backgroundUrl}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setFormState((prev) => ({
                        ...prev,
                        backgroundUrl: event.target.value,
                        backgroundData: undefined,
                      }))
                    }
                  />
                </div>
                {/* Превью выбранного фона, чтобы видеть итог сразу */}
                <div className={styles.previewBox}>
                  {backgroundPreview ? (
                    <div className={styles.previewImageWrapper}>
                      <img src={backgroundPreview} alt="Предпросмотр фона" />
                    </div>
                  ) : (
                    <span className={styles.previewPlaceholder}>
                      Выберите изображение или вставьте ссылку, чтобы увидеть превью
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Размеры</h4>
              <div className={styles.fieldsGrid}>
                <label className={styles.field}>
                  <span className={styles.labelRow}>Ширина (м)</span>
                  <input
                    type="number"
                    min={1}
                    className={styles.input}
                    value={formState.width}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, width: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.labelRow}>Высота (м)</span>
                  <input
                    type="number"
                    min={1}
                    className={styles.input}
                    value={formState.height}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, height: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.labelRow}>Сетка (м)</span>
                  <input
                    type="number"
                    min={1}
                    className={styles.input}
                    value={formState.gridSize}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        gridSize: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
              </div>
            </div>

            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Параметры</h4>
              <label className={styles.field}>
                <span className={styles.labelRow}>
                  <TooltipLabel description="Театр воображения скрывает сетку и размеры, оставляя только описание сцены.">
                    Режим
                  </TooltipLabel>
                </span>
                <select
                  className={styles.select}
                  value={formState.mode}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      mode: event.target.value as SceneCreatePayload["mode"],
                    }))
                  }
                >
                  <option value="theatre">Театр воображения</option>
                  <option value="tactical">Тактическая карта</option>
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.labelRow}>
                  <TooltipLabel description="Статус определяет видимость сцены для игроков и доступность в интерфейсе мастера.">
                    Статус
                  </TooltipLabel>
                </span>
                <select
                  className={styles.select}
                  value={formState.status}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      status: event.target.value as SceneCreatePayload["status"],
                    }))
                  }
                >
                  <option value="draft">Черновик</option>
                  <option value="active">Активна</option>
                  <option value="hidden">Скрыта</option>
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.labelRow}>Теги</span>
                <TagInput
                  value={formState.tags}
                  suggestions={allTags}
                  onChange={(tags) => setFormState((prev) => ({ ...prev, tags }))}
                />
              </label>
            </div>

            {formError ? <p className={styles.formError}>{formError}</p> : null}

            {/* Прикреплённый футер с действиями формы */}
            <div className={styles.formFooter}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={resetFormState}
                disabled={isSubmitting}
              >
                Сбросить
              </button>
              <button
                type="submit"
                className={styles.saveButton}
                disabled={isSubmitting}
              >
                <IconCheck size={18} stroke={1.8} /> Сохранить
              </button>
            </div>
          </form>
          </section>
        )}

        <section className={styles.listPanel} aria-labelledby="scenes-list-title">
          <div className={styles.listHeader}>
            <h3 id="scenes-list-title" className={styles.listTitle}>
              Сцены
            </h3>
            <span className={styles.listCounter}>{filteredScenes.length} из {scenes.length}</span>
          </div>
          <div className={styles.listBody} ref={listContainerRef}>
            {filteredScenes.length ? (
              // Виртуализируем список сцен для плавной прокрутки
              <FixedSizeList
                height={listHeight}
                width={Math.max(1, listSize.width)}
                itemCount={filteredScenes.length}
                itemSize={ITEM_HEIGHT}
                overscanCount={4}
              >
                {SceneRow}
              </FixedSizeList>
            ) : (
              <p className={styles.empty}>Сцены не найдены</p>
            )}
          </div>
        </section>
      </div>

      {menuState &&
        createPortal(
          <div
            className={styles.menuPortal}
            style={{ left: menuState.x, top: menuState.y }}
            role="menu"
          >
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => {
                closeMenu();
                handleDuplicate(menuState.sceneId);
              }}
            >
              <IconCopy size={18} stroke={1.8} /> Создать копию
            </button>
            <div className={styles.menuSeparator} aria-hidden />
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => {
                closeMenu();
                const target = filteredScenes.find((scene) => scene.id === menuState.sceneId);
                if (target) {
                  handlePreview(target);
                }
              }}
            >
              <IconInfoCircle size={18} stroke={1.8} /> Предпросмотр
            </button>
          </div>,
          document.body
        )}

      {previewScene ? (
        <div className={styles.previewModal} role="dialog" aria-modal="true">
          <div className={styles.previewCard}>
            <div className={styles.previewHeader}>
              <h3>{previewScene.name}</h3>
              <button
                type="button"
                className={styles.previewClose}
                onClick={handleClosePreview}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            {previewScene.background ? (
              <img
                src={previewScene.background}
                alt={previewScene.name}
                className={styles.previewImage}
              />
            ) : (
              <p className={styles.empty}>Нет изображения</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
