import { FormEvent, useCallback, useMemo, useState } from "react";
import {
  activateScene,
  createScene,
  deleteScene,
  duplicateScene,
  fetchScene,
  updateScene,
} from "../../api/scenesApi";
import type { Scene, SceneCreatePayload, SceneStatus } from "../../types";

const STATUS_LABELS: Record<SceneStatus, string> = {
  active: "Активна",
  hidden: "Скрыта",
  draft: "Черновик",
};

const MODE_LABELS = {
  theatre: "Театр воображения",
  tactical: "Тактическая карта",
} as const;

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
  tags: string;
};

type ScenesTabProps = {
  scenes: Scene[];
  activeSceneId: string | null;
  onScenesUpdated: () => Promise<void> | void;
  onActivateLocally: (sceneId: string) => void;
};

// Подготовка начального состояния формы для создания новой сцены
const emptyFormState: SceneFormState = {
  name: "",
  backgroundUrl: "",
  width: "40",
  height: "40",
  gridSize: "5",
  mode: "theatre",
  status: "draft",
  tags: "",
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ScenesTab({
  scenes,
  activeSceneId,
  onScenesUpdated,
  onActivateLocally,
}: ScenesTabProps) {
  const [search, setSearch] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const [formState, setFormState] = useState<SceneFormState>(emptyFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [previewScene, setPreviewScene] = useState<Scene | null>(null);

  const syncScenes = useCallback(async () => {
    await Promise.resolve(onScenesUpdated());
  }, [onScenesUpdated]);

  // Фильтрация сцен по строке поиска
  const filteredScenes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return scenes;
    return scenes.filter((scene) =>
      [scene.name, ...(scene.tags ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [scenes, search]);

  const handleOpenCreate = () => {
    setFormState(emptyFormState);
    setFormMode("create");
    setFormError(null);
    setGlobalError(null);
    setFormOpen(true);
  };

  const handleOpenEdit = async (sceneId: string) => {
    try {
      const existing = await fetchScene(sceneId);
      setFormState({
        id: existing.id,
        name: existing.name,
        backgroundUrl: existing.background ?? "",
        width: String(existing.width),
        height: String(existing.height),
        gridSize: String(existing.gridSize),
        mode: existing.mode,
        status: existing.status,
        tags: existing.tags?.join(", ") ?? "",
      });
      setFormMode("edit");
      setFormError(null);
      setGlobalError(null);
      setFormOpen(true);
    } catch (error) {
      console.error(error);
      setGlobalError("Не удалось загрузить данные сцены");
    }
  };

  const handleDuplicate = async (sceneId: string) => {
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
  };

  const handleDelete = async (sceneId: string) => {
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
  };

  const handleActivate = async (sceneId: string) => {
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
  };

  const handlePreview = (scene: Scene) => {
    setPreviewScene(scene);
  };

  const handleClosePreview = () => {
    setPreviewScene(null);
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
      tags: formState.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    try {
      setSubmitting(true);
      if (formMode === "create") {
        await createScene(payload);
      } else if (formState.id) {
        await updateScene(formState.id, payload);
      }
      setFormOpen(false);
      setFormState(emptyFormState);
      setGlobalError(null);
      await syncScenes();
    } catch (error) {
      console.error(error);
      setFormError("Не удалось сохранить сцену");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormCancel = () => {
    setFormOpen(false);
    setFormState(emptyFormState);
    setFormError(null);
  };

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

  return (
    <div className="scenes-tab">
      {/* Панель действий: поиск и создание новой сцены */}
      <div className="scenes-tab__actions">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск сцен..."
          className="scenes-tab__search"
          aria-label="Поиск по списку сцен"
        />
      <button
        type="button"
        className="scenes-tab__create"
        onClick={handleOpenCreate}
      >
        Создать новую сцену
      </button>
    </div>

      {globalError && (
        <p className="scenes-tab__error" role="alert">
          {globalError}
        </p>
      )}

      {/* Список сцен со скроллом */}
      <div className="scenes-list" role="list">
        {filteredScenes.map((scene) => {
          const isActive = scene.id === activeSceneId;
          return (
            <article
              key={scene.id}
              className={`scenes-list__item${isActive ? " scenes-list__item--active" : ""}`}
              role="listitem"
            >
              <button
                type="button"
                className="scenes-list__preview"
                onClick={() => handlePreview(scene)}
                aria-label={`Предпросмотр сцены ${scene.name}`}
              >
                {scene.thumbnail ? (
                  <img src={scene.thumbnail} alt="Миниатюра сцены" />
                ) : (
                  <span className="scenes-list__placeholder">Нет изображения</span>
                )}
              </button>
              <div className="scenes-list__details">
                <div className="scenes-list__heading">
                  <h4>{scene.name}</h4>
                  <span className={`scenes-status scenes-status--${scene.status}`}>
                    {STATUS_LABELS[scene.status]}
                  </span>
                </div>
                <div className="scenes-list__meta">
                  <span>{MODE_LABELS[scene.mode]}</span>
                  <span>{`${scene.width}×${scene.height}`} м</span>
                  <span>{`Сетка ${scene.gridSize} м`}</span>
                </div>
                {scene.tags?.length ? (
                  <div className="scenes-list__tags">
                    {scene.tags.map((tag) => (
                      <span key={tag} className="scenes-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="scenes-list__buttons">
                  <button
                    type="button"
                    onClick={() => handleActivate(scene.id)}
                    disabled={isSubmitting}
                  >
                    Открыть
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(scene.id)}
                    disabled={isSubmitting}
                  >
                    Редактировать
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(scene.id)}
                    disabled={isSubmitting}
                  >
                    Дублировать
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(scene.id)}
                    disabled={scene.id === activeSceneId || isSubmitting}
                    className="scenes-list__delete"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        {filteredScenes.length === 0 && (
          <p className="scenes-list__empty">Сцены не найдены</p>
        )}
      </div>

      {/* Диалог редактирования и создания сцен */}
      {isFormOpen && (
        <div className="scenes-modal" role="dialog" aria-modal="true">
          <div className="scenes-modal__card">
            <header className="scenes-modal__header">
              <h3>{formMode === "create" ? "Создать сцену" : "Редактировать сцену"}</h3>
            </header>
            <form className="scenes-form" onSubmit={handleFormSubmit}>
              <label className="scenes-form__field">
                <span>Название</span>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, name: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="scenes-form__field">
                <span>Фон (URL)</span>
                <input
                  type="url"
                  value={formState.backgroundUrl}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      backgroundUrl: event.target.value,
                      backgroundData: undefined,
                    }))
                  }
                  placeholder="https://..."
                />
              </label>

              <label className="scenes-form__field">
                <span>Фон (изображение)</span>
                <input type="file" accept="image/*" onChange={handleBackgroundFileChange} />
              </label>

              <div className="scenes-form__grid">
                <label className="scenes-form__field">
                  <span>Ширина (м)</span>
                  <input
                    type="number"
                    min={1}
                    value={formState.width}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, width: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="scenes-form__field">
                  <span>Высота (м)</span>
                  <input
                    type="number"
                    min={1}
                    value={formState.height}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, height: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="scenes-form__field">
                  <span>Размер сетки (м)</span>
                  <input
                    type="number"
                    min={1}
                    value={formState.gridSize}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, gridSize: event.target.value }))
                    }
                    required
                  />
                </label>
              </div>

              <label className="scenes-form__field">
                <span>Режим</span>
                <select
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

              <label className="scenes-form__field">
                <span>Статус</span>
                <select
                  value={formState.status}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      status: event.target.value as SceneCreatePayload["status"],
                    }))
                  }
                >
                  <option value="draft">Черновик</option>
                  <option value="hidden">Скрыта</option>
                  <option value="active">Активна</option>
                </select>
              </label>

              <label className="scenes-form__field">
                <span>Теги (через запятую)</span>
                <input
                  type="text"
                  value={formState.tags}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, tags: event.target.value }))
                  }
                  placeholder="лес, ночь, подземелье"
                />
              </label>

              {formError && <p className="scenes-form__error">{formError}</p>}

              <div className="scenes-form__controls">
                <button type="button" onClick={handleFormCancel} disabled={isSubmitting}>
                  Отмена
                </button>
                <button type="submit" disabled={isSubmitting}>
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Просмотр миниатюры сцены */}
      {previewScene && (
        <div className="scenes-modal" role="dialog" aria-modal="true">
          <div className="scenes-modal__card scenes-modal__card--preview">
            <header className="scenes-modal__header">
              <h3>{previewScene.name}</h3>
              <button type="button" onClick={handleClosePreview} aria-label="Закрыть">
                ×
              </button>
            </header>
            {previewScene.background ? (
              <img src={previewScene.background} alt={previewScene.name} />
            ) : (
              <p className="scenes-list__empty">Нет изображения</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
