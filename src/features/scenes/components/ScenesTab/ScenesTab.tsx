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

const ScenesTabRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
`;

const ActionsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(102, 124, 198, 0.55);
  background: rgba(16, 20, 38, 0.78);
  color: rgba(230, 236, 255, 0.92);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;

  &::placeholder {
    color: rgba(176, 188, 228, 0.65);
  }

  &:focus-visible {
    outline: none;
    border-color: rgba(138, 162, 255, 0.8);
    box-shadow: 0 0 0 2px rgba(138, 162, 255, 0.28);
    background: rgba(20, 26, 48, 0.88);
  }
`;

const CreateButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 12px;
  border: 1px solid rgba(118, 146, 224, 0.45);
  background: linear-gradient(135deg, rgba(118, 146, 224, 0.48), rgba(78, 104, 186, 0.54));
  color: rgba(236, 241, 255, 0.95);
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, transform 0.18s ease;

  &:hover,
  &:focus-visible {
    outline: none;
    border-color: rgba(148, 174, 252, 0.68);
    background: linear-gradient(135deg, rgba(132, 162, 238, 0.55), rgba(88, 116, 198, 0.6));
    box-shadow: 0 0 0 2px rgba(138, 162, 255, 0.2);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const InlineError = styled.p`
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(110, 38, 58, 0.35);
  border: 1px solid rgba(208, 94, 122, 0.55);
  color: rgba(255, 214, 226, 0.92);
  font-size: 0.86rem;
`;

const ListWrapper = styled.div`
  flex: 1;
  min-height: 0;
  position: relative;
`;

const ListEmpty = styled.p`
  margin: 0;
  padding: 28px 12px;
  text-align: center;
  color: rgba(180, 192, 230, 0.7);
`;

const SceneRow = styled.div`
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding-bottom: 12px;
`;

const SceneCard = styled.article<{ $active: boolean }>`
  position: relative;
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 16px;
  height: calc(100% - 12px);
  padding: 16px;
  border-radius: 16px;
  background: rgba(18, 22, 40, 0.88);
  border: 1px solid rgba(82, 104, 184, 0.48);
  box-shadow: inset 0 0 0 1px rgba(132, 152, 226, 0.08);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, transform 0.18s ease;

  &:hover {
    background: rgba(24, 30, 54, 0.94);
    box-shadow: 0 16px 36px rgba(8, 12, 26, 0.35);
  }

  ${(props) =>
    props.$active &&
    css`
      border-color: rgba(138, 172, 255, 0.82);
      box-shadow: 0 0 0 2px rgba(138, 172, 255, 0.32), 0 18px 32px rgba(18, 28, 54, 0.55);
      background: rgba(22, 30, 58, 0.95);
    `};

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
    height: auto;
  }
`;

const PreviewButton = styled.button`
  position: relative;
  display: block;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(88, 112, 194, 0.48);
  background: rgba(26, 32, 58, 0.76);
  cursor: pointer;
  min-height: 96px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;

  &:focus-visible {
    outline: none;
    border-color: rgba(138, 162, 255, 0.82);
    box-shadow: 0 0 0 2px rgba(138, 162, 255, 0.28);
  }
`;

const PreviewImage = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const PreviewPlaceholder = styled.div`
  display: grid;
  place-items: center;
  gap: 6px;
  padding: 18px;
  color: rgba(188, 198, 236, 0.7);
  font-size: 0.85rem;
`;

const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
`;

const SceneHeading = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const SceneName = styled.h4`
  margin: 0;
  color: rgba(236, 240, 255, 0.96);
  font-size: 1.02rem;
  font-weight: 600;
  word-break: break-word;
`;

const ActionsGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PrimaryActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const IconButton = styled.button`
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(92, 118, 205, 0.5);
  background: rgba(24, 30, 58, 0.88);
  color: rgba(218, 226, 255, 0.92);
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, transform 0.18s ease;

  &:hover,
  &:focus-visible {
    outline: none;
    border-color: rgba(138, 162, 255, 0.68);
    background: rgba(32, 40, 70, 0.92);
    box-shadow: 0 0 0 2px rgba(138, 162, 255, 0.18);
  }

  &:active {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const DeleteIconButton = styled(IconButton)`
  border-color: rgba(224, 124, 148, 0.5);
  background: rgba(68, 26, 40, 0.82);
  color: rgba(255, 210, 222, 0.92);

  &:hover,
  &:focus-visible {
    border-color: rgba(240, 160, 182, 0.72);
    background: rgba(84, 34, 48, 0.88);
    box-shadow: 0 0 0 2px rgba(240, 160, 182, 0.2);
  }
`;

const MoreButton = styled(IconButton)`
  width: 32px;
  height: 32px;
`;

const SceneMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.85rem;
  color: rgba(188, 198, 236, 0.78);
`;

const SceneTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const SceneTag = styled.span`
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(72, 110, 210, 0.22);
  border: 1px solid rgba(96, 130, 220, 0.32);
  font-size: 0.78rem;
  color: rgba(206, 216, 250, 0.9);
`;

const StatusBadge = styled.span<{ $status: SceneStatus }>`
  position: absolute;
  top: 12px;
  left: 16px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: ${(props) => STATUS_COLORS[props.$status]};
  color: ${(props) => STATUS_TEXT_COLORS[props.$status]};
`;

const MenuContainerBase = styled.div`
  position: fixed;
  z-index: 1500;
  min-width: 200px;
  padding: 8px 0;
  border-radius: 12px;
  border: 1px solid rgba(92, 118, 205, 0.55);
  background: rgba(16, 20, 36, 0.98);
  box-shadow: 0 20px 40px rgba(6, 8, 20, 0.55);
`;

const MenuItemButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: none;
  border: none;
  color: rgba(214, 222, 255, 0.92);
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;

  &:hover,
  &:focus-visible {
    outline: none;
    background: rgba(34, 42, 72, 0.78);
    color: rgba(234, 240, 255, 0.96);
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(6, 8, 16, 0.72);
  backdrop-filter: blur(4px);
  padding: 24px;
  z-index: 1400;
`;

const ModalCard = styled.div`
  width: min(560px, 100%);
  max-height: min(88vh, 720px);
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  border: 1px solid rgba(102, 132, 210, 0.38);
  background: linear-gradient(160deg, rgba(16, 20, 36, 0.96), rgba(10, 12, 26, 0.92));
  box-shadow: 0 28px 60px rgba(6, 8, 20, 0.6);
  overflow: hidden;
`;

const ModalHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid rgba(88, 110, 198, 0.32);
  color: rgba(230, 236, 255, 0.96);
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.05rem;
`;

const CloseModalButton = styled.button`
  border: none;
  background: none;
  color: rgba(208, 214, 240, 0.8);
  font-size: 1.6rem;
  cursor: pointer;
  padding: 4px;
  border-radius: 8px;
  transition: background 0.18s ease, color 0.18s ease;

  &:hover,
  &:focus-visible {
    outline: none;
    background: rgba(42, 52, 86, 0.6);
    color: rgba(240, 244, 255, 0.95);
  }
`;

const FormLayout = styled.form`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;

const FormBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FormSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const SectionTitle = styled.h4`
  margin: 0;
  font-size: 0.95rem;
  color: rgba(230, 236, 255, 0.94);
  font-weight: 600;
`;

const SectionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const DimensionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: rgba(194, 204, 238, 0.88);
`;

const FieldTitle = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
`;

const TooltipIconWrapper = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  color: rgba(168, 186, 242, 0.82);
  cursor: help;
`;

const InputBase = styled.input`
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(96, 122, 200, 0.48);
  background: rgba(18, 22, 40, 0.85);
  color: rgba(230, 236, 255, 0.92);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;

  &::placeholder {
    color: rgba(170, 184, 224, 0.65);
  }

  &:focus-visible {
    outline: none;
    border-color: rgba(138, 162, 255, 0.82);
    box-shadow: 0 0 0 2px rgba(138, 162, 255, 0.26);
    background: rgba(22, 28, 48, 0.92);
  }
`;

const SelectBase = styled.select`
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(96, 122, 200, 0.48);
  background: rgba(18, 22, 40, 0.85);
  color: rgba(230, 236, 255, 0.92);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;

  &:focus-visible {
    outline: none;
    border-color: rgba(138, 162, 255, 0.82);
    box-shadow: 0 0 0 2px rgba(138, 162, 255, 0.26);
    background: rgba(22, 28, 48, 0.92);
  }
`;

const TagFieldWrapper = styled.div`
  position: relative;
`;

const TagArea = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px;
  border-radius: 12px;
  border: 1px dashed rgba(108, 132, 210, 0.48);
  background: rgba(18, 22, 40, 0.78);
  min-height: 48px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;

  &:focus-within {
    border-color: rgba(138, 162, 255, 0.82);
    box-shadow: 0 0 0 2px rgba(138, 162, 255, 0.22);
  }
`;

const TagChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(76, 112, 208, 0.24);
  border: 1px solid rgba(96, 132, 220, 0.32);
  color: rgba(210, 220, 252, 0.94);
  font-size: 0.8rem;
`;

const RemoveTagButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background: rgba(32, 40, 70, 0.85);
  color: rgba(228, 234, 255, 0.9);
  cursor: pointer;

  &:hover,
  &:focus-visible {
    outline: none;
    background: rgba(52, 64, 96, 0.95);
  }
`;

const TagInput = styled.input`
  flex: 1;
  min-width: 120px;
  border: none;
  background: transparent;
  color: rgba(230, 236, 255, 0.92);
  padding: 6px;

  &:focus-visible {
    outline: none;
  }
`;

const TagSuggestions = styled.ul`
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  max-height: 180px;
  overflow-y: auto;
  margin: 0;
  padding: 6px 0;
  list-style: none;
  border-radius: 12px;
  border: 1px solid rgba(98, 128, 210, 0.45);
  background: rgba(16, 20, 36, 0.98);
  box-shadow: 0 16px 32px rgba(8, 12, 26, 0.55);
  z-index: 10;
`;

const TagSuggestionButton = styled.button`
  width: 100%;
  padding: 8px 16px;
  background: none;
  border: none;
  text-align: left;
  color: rgba(214, 222, 255, 0.92);
  cursor: pointer;

  &:hover,
  &:focus-visible {
    outline: none;
    background: rgba(34, 42, 72, 0.78);
    color: rgba(236, 240, 255, 0.96);
  }
`;

const BackgroundPreview = styled.div`
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(92, 118, 205, 0.45);
  background: rgba(26, 32, 58, 0.78);
  max-height: 220px;
`;

const BackgroundPreviewImage = styled.img`
  display: block;
  width: 100%;
  height: auto;
`;

const FormError = styled.p`
  margin: 0;
  color: #ff9aa2;
  font-weight: 600;
  text-align: center;
`;

const StickyFooter = styled.div`
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 24px 20px;
  background: linear-gradient(180deg, rgba(16, 20, 36, 0.94), rgba(10, 12, 24, 0.95));
  box-shadow: 0 -12px 28px rgba(6, 8, 20, 0.55);
`;

const SecondaryButton = styled.button`
  padding: 10px 18px;
  border-radius: 12px;
  border: 1px solid rgba(92, 118, 205, 0.45);
  background: rgba(22, 28, 48, 0.85);
  color: rgba(226, 232, 255, 0.9);
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;

  &:hover,
  &:focus-visible {
    outline: none;
    border-color: rgba(138, 162, 255, 0.72);
    background: rgba(32, 40, 70, 0.9);
    box-shadow: 0 0 0 2px rgba(138, 162, 255, 0.18);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const PrimaryButton = styled(SecondaryButton)`
  background: linear-gradient(135deg, rgba(126, 156, 236, 0.6), rgba(92, 124, 210, 0.66));
  border-color: rgba(134, 166, 244, 0.62);
  color: rgba(240, 244, 255, 0.96);

  &:hover,
  &:focus-visible {
    background: linear-gradient(135deg, rgba(136, 168, 248, 0.68), rgba(102, 134, 220, 0.72));
  }
`;

const PreviewModalCard = styled(ModalCard)`
  width: min(720px, 100%);
`;

const PreviewBody = styled.div`
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(12, 16, 32, 0.92);
`;

const PreviewImageLarge = styled.img`
  max-width: 100%;
  height: auto;
  border-radius: 12px;
  border: 1px solid rgba(92, 118, 205, 0.45);
`;

const MenuContainer = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => <MenuContainerBase {...props} ref={ref} data-scene-menu />
);

MenuContainer.displayName = "MenuContainer";

const ListOuterElementBase = styled.div`
  height: 100% !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  padding-right: 6px;
`;

const ListOuterElement = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, ...rest }, ref) => (
    <ListOuterElementBase {...rest} ref={ref} role="list">
      {children}
    </ListOuterElementBase>
  )
);

ListOuterElement.displayName = "ListOuterElement";

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
  const [previewScene, setPreviewScene] = useState<Scene | null>(null);
  const [menuState, setMenuState] = useState<MenuState | null>(null);

  const { ref: listContainerRef, size: listSize } = useElementSize<HTMLDivElement>();

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

  const resetForm = useCallback(() => {
    setFormState(emptyFormState);
    setFormMode("create");
    setFormError(null);
  }, []);

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
      resetForm();
      setGlobalError(null);
      await syncScenes();
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
          onClick={resetForm}
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

      <div className={styles.content}>
        <section className={styles.formPanel} aria-labelledby="scene-form-title">
          <div className={styles.formHeader}>
            <h3 id="scene-form-title" className={styles.formTitle}>
              {formMode === "create" ? "Создать сцену" : "Редактировать сцену"}
            </h3>
            {formMode === "edit" && (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={resetForm}
              >
                Отменить редактирование
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
                <div className={styles.previewBox}>
                  {backgroundPreview ? (
                    <img src={backgroundPreview} alt="Предпросмотр фона" />
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

            <div className={styles.formFooter}>
              {formMode === "edit" && (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={resetForm}
                  disabled={isSubmitting}
                >
                  Сбросить
                </button>
              )}
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

        <section className={styles.listPanel} aria-labelledby="scenes-list-title">
          <div className={styles.listHeader}>
            <h3 id="scenes-list-title" className={styles.listTitle}>
              Сцены
            </h3>
            <span className={styles.listCounter}>{filteredScenes.length} из {scenes.length}</span>
          </div>
          <div className={styles.listBody} ref={listContainerRef}>
            {filteredScenes.length ? (
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
