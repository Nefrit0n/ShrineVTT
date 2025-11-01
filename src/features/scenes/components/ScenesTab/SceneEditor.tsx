import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  IconChevronDown,
  IconInfoCircle,
  IconPhoto,
  IconX,
} from "@tabler/icons-react";
import clsx from "clsx";

import type { SceneCreatePayload } from "../../types";

import styles from "./ScenesTab.module.css";
import type { EditorSection, SceneFormState } from "./ScenesTab.shared";

type SceneEditorProps = {
  mode: "create" | "edit";
  state: SceneFormState;
  error: string | null;
  collapsed: Record<EditorSection, boolean>;
  backgroundPreview?: string;
  allTags: string[];
  isBusy: boolean;
  onClose: () => void;
  onChange: <K extends keyof SceneFormState>(key: K, value: SceneFormState[K]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  onToggleSection: (section: EditorSection) => void;
  onBackgroundFileChange: (file: File | null) => void;
  onTagsChange: (tags: string[]) => void;
};

type TagInputProps = {
  value: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
};

const SECTION_TITLES: Record<EditorSection, string> = {
  basics: "Основное",
  dimensions: "Размеры",
  parameters: "Параметры",
};

export default function SceneEditor({
  mode,
  state,
  error,
  collapsed,
  backgroundPreview,
  allTags,
  isBusy,
  onClose,
  onChange,
  onSubmit,
  onReset,
  onToggleSection,
  onBackgroundFileChange,
  onTagsChange,
}: SceneEditorProps) {
  const heading = mode === "create" ? "Создание сцены" : "Редактирование сцены";

  const handleUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange("backgroundUrl", event.target.value);
    onChange("backgroundData", undefined);
  };

  return (
    <section className={styles.editorPanel} aria-labelledby="scene-editor-heading">
      <header className={styles.editorHeader}>
        <div>
          <h3 id="scene-editor-heading" className={styles.editorTitle}>
            {heading}
          </h3>
          <p className={styles.editorSubtitle}>
            Укажите основные параметры карты, чтобы быстро подготовить сцену для игроков.
          </p>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={onClose}>
          Закрыть
        </button>
      </header>

      <form className={styles.editorForm} onSubmit={onSubmit}>
        <div className={styles.editorSections}>
          <CollapsibleSection
            id="scene-section-basics"
            title={SECTION_TITLES.basics}
            collapsed={collapsed.basics}
            onToggle={() => onToggleSection("basics")}
          >
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Название</span>
              <input
                type="text"
                className={styles.input}
                value={state.name}
                onChange={(event) => onChange("name", event.target.value)}
                placeholder="Например, Лесная тропа"
                required
              />
            </label>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Фон</span>
              <div className={styles.fileRow}>
                <label className={styles.fileButton}>
                  <IconPhoto size={16} stroke={1.6} /> Загрузить
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => onBackgroundFileChange(event.target.files?.[0] ?? null)}
                  />
                </label>
                <input
                  type="url"
                  className={styles.input}
                  placeholder="https://..."
                  value={state.backgroundUrl}
                  onChange={handleUrlChange}
                />
              </div>
              <div className={styles.previewBox}>
                {backgroundPreview ? (
                  <img src={backgroundPreview} alt="Предпросмотр фона" />
                ) : (
                  <span className={styles.previewPlaceholder}>
                    Загрузите изображение или вставьте ссылку, чтобы увидеть превью.
                  </span>
                )}
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="scene-section-dimensions"
            title={SECTION_TITLES.dimensions}
            collapsed={collapsed.dimensions}
            onToggle={() => onToggleSection("dimensions")}
          >
            <div className={styles.inlineFields}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Ширина (м)</span>
                <input
                  type="number"
                  min={1}
                  className={styles.input}
                  value={state.width}
                  onChange={(event) => onChange("width", event.target.value)}
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Высота (м)</span>
                <input
                  type="number"
                  min={1}
                  className={styles.input}
                  value={state.height}
                  onChange={(event) => onChange("height", event.target.value)}
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Размер сетки (м)</span>
                <input
                  type="number"
                  min={1}
                  className={styles.input}
                  value={state.gridSize}
                  onChange={(event) => onChange("gridSize", event.target.value)}
                  required
                />
              </label>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="scene-section-parameters"
            title={SECTION_TITLES.parameters}
            collapsed={collapsed.parameters}
            onToggle={() => onToggleSection("parameters")}
          >
            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                <TooltipLabel description="Определяет отображение и взаимодействие с картой." label="Режим" />
              </span>
              <select
                className={styles.input}
                value={state.mode}
                onChange={(event) =>
                  onChange("mode", event.target.value as SceneCreatePayload["mode"])
                }
              >
                <option value="theatre">Театр воображения</option>
                <option value="tactical">Тактическая карта</option>
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                <TooltipLabel description="Статус влияет на видимость сцены для игроков." label="Статус" />
              </span>
              <select
                className={styles.input}
                value={state.status}
                onChange={(event) =>
                  onChange("status", event.target.value as SceneCreatePayload["status"])
                }
              >
                <option value="draft">Черновик</option>
                <option value="active">Активна</option>
                <option value="hidden">Скрыта</option>
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Теги</span>
              <TagInput value={state.tags} suggestions={allTags} onChange={onTagsChange} />
            </label>
          </CollapsibleSection>
        </div>

        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.editorFooter}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onReset}
            disabled={isBusy}
          >
            Сбросить
          </button>
          <button type="submit" className={styles.saveButton} disabled={isBusy}>
            Сохранить
          </button>
        </div>
      </form>
    </section>
  );
}

type TooltipLabelProps = {
  label: string;
  description: string;
};

function TooltipLabel({ label, description }: TooltipLabelProps) {
  return (
    <span className={styles.tooltipLabel} data-tooltip={description}>
      {label}
      <IconInfoCircle size={14} stroke={1.6} aria-hidden="true" />
    </span>
  );
}

function TagInput({ value, suggestions, onChange }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [focused, setFocused] = useState(false);

  const availableSuggestions = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    return suggestions
      .filter((tag) => !value.includes(tag))
      .filter((tag) => (query ? tag.toLowerCase().includes(query) : true))
      .slice(0, 6);
  }, [inputValue, suggestions, value]);

  const addTag = (tag: string) => {
    const next = tag.trim();
    if (!next || value.includes(next)) return;
    onChange([...value, next]);
    setInputValue("");
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(inputValue);
    }
    if (event.key === "Backspace" && !inputValue && value.length) {
      event.preventDefault();
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className={styles.tagInput}>
      {value.map((tag) => (
        <span key={tag} className={styles.tagChip}>
          {tag}
          <button
            type="button"
            className={styles.tagRemove}
            onClick={() => onChange(value.filter((item) => item !== tag))}
            aria-label={`Удалить тег ${tag}`}
          >
            <IconX size={14} stroke={1.6} />
          </button>
        </span>
      ))}
      <input
        className={styles.tagInputField}
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        onKeyDown={handleKeyDown}
        placeholder={value.length ? "Добавить тег" : "Введите тег"}
        aria-label="Добавить тег"
      />
      {focused && availableSuggestions.length ? (
        <ul className={styles.suggestions} role="listbox">
          {availableSuggestions.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addTag(tag)}
              >
                {tag}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type CollapsibleSectionProps = {
  id: string;
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
};

function CollapsibleSection({ id, title, collapsed, onToggle, children }: CollapsibleSectionProps) {
  return (
    <section className={styles.section} aria-labelledby={`${id}-title`}>
      <button
        type="button"
        className={styles.sectionToggle}
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls={`${id}-content`}
      >
        <span id={`${id}-title`}>{title}</span>
        <IconChevronDown size={16} stroke={1.6} aria-hidden="true" />
      </button>
      <div
        id={`${id}-content`}
        className={clsx(styles.sectionContent, collapsed && styles.sectionContentCollapsed)}
      >
        {children}
      </div>
    </section>
  );
}
