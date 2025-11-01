import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styled, { css } from "styled-components";
import {
  IconCopy,
  IconDotsVertical,
  IconInfoCircle,
  IconPencil,
  IconPhoto,
  IconPlayerPlay,
  IconTrash,
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

const STATUS_LABELS: Record<SceneStatus, string> = {
  active: "Активна",
  hidden: "Скрыта",
  draft: "Черновик",
};

const MODE_LABELS = {
  theatre: "Театр воображения",
  tactical: "Тактическая карта",
} as const;

const ITEM_HEIGHT = 208;
const SEARCH_DEBOUNCE = 300;

const STATUS_COLORS: Record<SceneStatus, string> = {
  active: "rgba(82, 185, 138, 0.82)",
  hidden: "rgba(240, 176, 98, 0.84)",
  draft: "rgba(148, 156, 186, 0.78)",
};

const STATUS_TEXT_COLORS: Record<SceneStatus, string> = {
  active: "rgba(14, 28, 24, 0.92)",
  hidden: "rgba(48, 28, 8, 0.92)",
  draft: "rgba(20, 24, 38, 0.92)",
};

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

type MenuAnchor = {
  id: string;
  rect: DOMRect;
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

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const [formState, setFormState] = useState<SceneFormState>(emptyFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [previewScene, setPreviewScene] = useState<Scene | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [isTagFocused, setTagFocused] = useState(false);
  const listWrapperRef = useRef<HTMLDivElement | null>(null);
  const [listHeight, setListHeight] = useState(0);

  const syncScenes = useCallback(async () => {
    await Promise.resolve(onScenesUpdated());
  }, [onScenesUpdated]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), SEARCH_DEBOUNCE);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const allSceneTags = useMemo(() => {
    const tags = new Set<string>();
    scenes.forEach((scene) => {
      scene.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b, "ru"));
  }, [scenes]);

  const filteredScenes = useMemo(() => {
    const query = debouncedSearch.toLowerCase();
    if (!query) return scenes;
    return scenes.filter((scene) =>
      [scene.name, ...(scene.tags ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [debouncedSearch, scenes]);

  useEffect(() => {
    const element = listWrapperRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setListHeight(entry.contentRect.height);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuAnchor) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-scene-menu]")) return;
      if (target.closest("[data-menu-anchor]") && menuAnchor) return;
      setMenuAnchor(null);
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuAnchor(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuAnchor]);

  useEffect(() => {
    if (!menuAnchor) return;
    const scroller = listWrapperRef.current?.firstElementChild as HTMLElement | null;
    if (!scroller) return;

    const handleScroll = () => setMenuAnchor(null);
    scroller.addEventListener("scroll", handleScroll, { passive: true });

    return () => scroller.removeEventListener("scroll", handleScroll);
  }, [menuAnchor]);

  useEffect(() => {
    if (!menuAnchor) return;
    const handleResize = () => setMenuAnchor(null);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [menuAnchor]);

  useEffect(() => {
    setMenuAnchor(null);
  }, [debouncedSearch, filteredScenes.length]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleOpenCreate = () => {
    setFormState(emptyFormState);
    setFormMode("create");
    setFormError(null);
    setGlobalError(null);
    setTagInput("");
    setFormOpen(true);
    setMenuAnchor(null);
  };

  const handleOpenEdit = useCallback(
    async (sceneId: string) => {
      try {
        const existing = await fetchScene(sceneId);
        setFormState({
          id: existing.id,
          name: existing.name,
          backgroundUrl: existing.background ?? existing.thumbnail ?? "",
          backgroundData: undefined,
          width: String(existing.width),
          height: String(existing.height),
          gridSize: String(existing.gridSize),
          mode: existing.mode,
          status: existing.status,
          tags: existing.tags ?? [],
        });
        setFormMode("edit");
        setFormError(null);
        setGlobalError(null);
        setTagInput("");
        setFormOpen(true);
        setMenuAnchor(null);
      } catch (error) {
        console.error(error);
        setGlobalError("Не удалось загрузить данные сцены");
      }
    },
    []
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
        setGlobalError("Не удалось дублировать сцену");
      } finally {
        setSubmitting(false);
        setMenuAnchor(null);
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
        setMenuAnchor(null);
      }
    },
    [syncScenes]
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

  const handlePreview = (scene: Scene) => {
    setPreviewScene(scene);
    setMenuAnchor(null);
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
      tags: formState.tags,
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
      setTagInput("");
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
    setTagInput("");
  };

  const handleBackgroundUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFormState((prev) => ({
      ...prev,
      backgroundUrl: value,
      backgroundData: undefined,
    }));
  };

  const handleBackgroundFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
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

  const addTag = useCallback(
    (tag: string) => {
      const normalized = tag.trim();
      if (!normalized) return;
      setFormState((prev) => {
        if (prev.tags.includes(normalized)) {
          return prev;
        }
        return { ...prev, tags: [...prev.tags, normalized] };
      });
      setTagInput("");
    },
    []
  );

  const removeTag = (tag: string) => {
    setFormState((prev) => ({
      ...prev,
      tags: prev.tags.filter((existing) => existing !== tag),
    }));
  };

  const handleTagInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTagInput(event.target.value);
  };

  const handleTagInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "," || event.key === "Tab") {
      if (tagInput.trim()) {
        event.preventDefault();
        addTag(tagInput);
      }
    } else if (event.key === "Backspace" && !tagInput && formState.tags.length) {
      removeTag(formState.tags[formState.tags.length - 1]);
    }
  };

  const tagSuggestions = useMemo(() => {
    const query = tagInput.trim().toLowerCase();
    if (!query) {
      return allSceneTags.filter((tag) => !formState.tags.includes(tag));
    }
    return allSceneTags.filter(
      (tag) =>
        !formState.tags.includes(tag) && tag.toLowerCase().includes(query)
    );
  }, [allSceneTags, formState.tags, tagInput]);

  const showTagSuggestions = isTagFocused && tagSuggestions.length > 0;

  const handleToggleMenu = useCallback(
    (sceneId: string, event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      setMenuAnchor((current) => {
        if (current?.id === sceneId) {
          return null;
        }
        return { id: sceneId, rect };
      });
    },
    []
  );

  const backgroundPreview =
    formState.backgroundData || formState.backgroundUrl.trim() || null;

  const computedListHeight = useMemo(() => {
    if (listHeight > 0) return listHeight;
    const estimatedItems = Math.min(filteredScenes.length || scenes.length || 1, 4);
    return Math.max(estimatedItems, 1) * ITEM_HEIGHT;
  }, [filteredScenes.length, listHeight, scenes.length]);

  const renderSceneRow = useCallback(
    ({ index, style, data }: ListChildComponentProps<Scene[]>) => {
      const scene = data[index];
      if (!scene) return null;

      const isActive = scene.id === activeSceneId;
      const isMenuOpen = menuAnchor?.id === scene.id;
      const thumbnail = scene.thumbnail ?? scene.background ?? "";

      return (
        <SceneRow style={style}>
          <SceneCard $active={isActive} role="listitem">
            <StatusBadge $status={scene.status}>{STATUS_LABELS[scene.status]}</StatusBadge>
            <PreviewButton
              type="button"
              onClick={() => handlePreview(scene)}
              aria-label={`Предпросмотр сцены «${scene.name}»`}
            >
              {thumbnail ? (
                <PreviewImage src={thumbnail} alt={`Миниатюра сцены «${scene.name}»`} />
              ) : (
                <PreviewPlaceholder>
                  <IconPhoto size={20} />
                  <span>Нет изображения</span>
                </PreviewPlaceholder>
              )}
            </PreviewButton>
            <CardContent>
              <SceneHeading>
                <SceneName>{scene.name}</SceneName>
                <ActionsGroup>
                  <PrimaryActions>
                    <IconButton
                      type="button"
                      onClick={() => handleActivate(scene.id)}
                      disabled={isSubmitting}
                      aria-label={`Открыть сцену «${scene.name}»`}
                    >
                      <IconPlayerPlay size={18} />
                    </IconButton>
                    <IconButton
                      type="button"
                      onClick={() => handleOpenEdit(scene.id)}
                      disabled={isSubmitting}
                      aria-label={`Редактировать сцену «${scene.name}»`}
                    >
                      <IconPencil size={18} />
                    </IconButton>
                    <DeleteIconButton
                      type="button"
                      onClick={() => handleDelete(scene.id)}
                      disabled={isSubmitting || isActive}
                      aria-label={`Удалить сцену «${scene.name}»`}
                    >
                      <IconTrash size={18} />
                    </DeleteIconButton>
                  </PrimaryActions>
                  <MoreButton
                    type="button"
                    data-menu-anchor
                    aria-label={`Дополнительные действия для сцены «${scene.name}»`}
                    aria-expanded={isMenuOpen}
                    onClick={(event: ReactMouseEvent<HTMLButtonElement>) =>
                      handleToggleMenu(scene.id, event)
                    }
                    disabled={isSubmitting}
                  >
                    <IconDotsVertical size={18} />
                  </MoreButton>
                </ActionsGroup>
              </SceneHeading>
              <SceneMeta>
                <span>{MODE_LABELS[scene.mode]}</span>
                <span>{`${scene.width}×${scene.height}`} м</span>
                <span>{`Сетка ${scene.gridSize} м`}</span>
              </SceneMeta>
              {scene.tags?.length ? (
                <SceneTags>
                  {scene.tags.map((tag: string) => (
                    <SceneTag key={tag}>{tag}</SceneTag>
                  ))}
                </SceneTags>
              ) : null}
            </CardContent>
          </SceneCard>
        </SceneRow>
      );
    },
    [activeSceneId, handleActivate, handleDelete, handleOpenEdit, handlePreview, handleToggleMenu, isSubmitting, menuAnchor]
  );

  return (
    <ScenesTabRoot>
      <ActionsRow>
        <SearchInput
          type="search"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Поиск сцен..."
          aria-label="Поиск по списку сцен"
        />
        <CreateButton type="button" onClick={handleOpenCreate}>
          Создать сцену
        </CreateButton>
      </ActionsRow>

      {globalError && <InlineError role="alert">{globalError}</InlineError>}

      <ListWrapper ref={listWrapperRef}>
        {filteredScenes.length > 0 ? (
          <FixedSizeList
            outerElementType={ListOuterElement}
            height={computedListHeight}
            width="100%"
            itemCount={filteredScenes.length}
            itemSize={ITEM_HEIGHT}
            itemData={filteredScenes}
          >
            {renderSceneRow}
          </FixedSizeList>
        ) : (
          <ListEmpty>Сцены не найдены</ListEmpty>
        )}
      </ListWrapper>

      {isFormOpen && (
        <ModalOverlay role="dialog" aria-modal="true">
          <ModalCard>
            <ModalHeader>
              <ModalTitle>
                {formMode === "create" ? "Создать сцену" : "Редактировать сцену"}
              </ModalTitle>
              <CloseModalButton
                type="button"
                aria-label="Закрыть"
                onClick={handleFormCancel}
              >
                ×
              </CloseModalButton>
            </ModalHeader>
            <FormLayout onSubmit={handleFormSubmit}>
              <FormBody>
                <FormSection>
                  <SectionTitle>Основное</SectionTitle>
                  <SectionGrid>
                    <Field>
                      <FieldTitle>Название</FieldTitle>
                      <InputBase
                        type="text"
                        value={formState.name}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setFormState((prev) => ({ ...prev, name: event.target.value }))
                        }
                        placeholder="Введите название"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldTitle>Фон (ссылка)</FieldTitle>
                      <InputBase
                        type="url"
                        value={formState.backgroundUrl}
                        onChange={handleBackgroundUrlChange}
                        placeholder="https://..."
                      />
                    </Field>
                    <Field>
                      <FieldTitle>Фон (загрузка)</FieldTitle>
                      <InputBase
                        as="input"
                        type="file"
                        accept="image/*"
                        onChange={handleBackgroundFileChange}
                      />
                    </Field>
                    {backgroundPreview && (
                      <Field as="div">
                        <FieldTitle>Предпросмотр фона</FieldTitle>
                        <BackgroundPreview>
                          <BackgroundPreviewImage
                            src={backgroundPreview}
                            alt="Предпросмотр фонового изображения"
                          />
                        </BackgroundPreview>
                      </Field>
                    )}
                  </SectionGrid>
                </FormSection>

                <FormSection>
                  <SectionTitle>Размеры</SectionTitle>
                  <DimensionsGrid>
                    <Field>
                      <FieldTitle>Ширина (м)</FieldTitle>
                      <InputBase
                        type="number"
                        min={1}
                        value={formState.width}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setFormState((prev) => ({ ...prev, width: event.target.value }))
                        }
                        required
                      />
                    </Field>
                    <Field>
                      <FieldTitle>Высота (м)</FieldTitle>
                      <InputBase
                        type="number"
                        min={1}
                        value={formState.height}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setFormState((prev) => ({ ...prev, height: event.target.value }))
                        }
                        required
                      />
                    </Field>
                    <Field>
                      <FieldTitle>Сетка (м)</FieldTitle>
                      <InputBase
                        type="number"
                        min={1}
                        value={formState.gridSize}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setFormState((prev) => ({ ...prev, gridSize: event.target.value }))
                        }
                        required
                      />
                    </Field>
                  </DimensionsGrid>
                </FormSection>

                <FormSection>
                  <SectionTitle>Параметры</SectionTitle>
                  <SectionGrid>
                    <Field>
                      <FieldTitle>
                        Режим
                        <TooltipIconWrapper title="Театр воображения скрывает сетку, а тактическая карта отображает точные клетки">
                          <IconInfoCircle size={16} aria-hidden="true" />
                        </TooltipIconWrapper>
                      </FieldTitle>
                      <SelectBase
                        value={formState.mode}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                          setFormState((prev) => ({
                            ...prev,
                            mode: event.target.value as SceneCreatePayload["mode"],
                          }))
                        }
                      >
                        <option value="theatre">Театр воображения</option>
                        <option value="tactical">Тактическая карта</option>
                      </SelectBase>
                    </Field>
                    <Field>
                      <FieldTitle>
                        Статус
                        <TooltipIconWrapper title="Статус определяет видимость сцены для игроков и её готовность">
                          <IconInfoCircle size={16} aria-hidden="true" />
                        </TooltipIconWrapper>
                      </FieldTitle>
                      <SelectBase
                        value={formState.status}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                          setFormState((prev) => ({
                            ...prev,
                            status: event.target.value as SceneCreatePayload["status"],
                          }))
                        }
                      >
                        <option value="draft">Черновик</option>
                        <option value="hidden">Скрыта</option>
                        <option value="active">Активна</option>
                      </SelectBase>
                    </Field>
                    <Field as="div">
                      <FieldTitle>Теги</FieldTitle>
                      <TagFieldWrapper>
                        <TagArea>
                          {formState.tags.map((tag: string) => (
                            <TagChip key={tag}>
                              {tag}
                              <RemoveTagButton
                                type="button"
                                aria-label={`Удалить тег ${tag}`}
                                onClick={() => removeTag(tag)}
                              >
                                ×
                              </RemoveTagButton>
                            </TagChip>
                          ))}
                          <TagInput
                            value={tagInput}
                            onChange={handleTagInputChange}
                            onKeyDown={handleTagInputKeyDown}
                            onFocus={() => setTagFocused(true)}
                            onBlur={() => setTimeout(() => setTagFocused(false), 100)}
                            placeholder="Добавьте тег"
                          />
                        </TagArea>
                        {showTagSuggestions && (
                          <TagSuggestions>
                            {tagSuggestions.map((tag: string) => (
                              <li key={tag}>
                                <TagSuggestionButton
                                  type="button"
                                  onMouseDown={(event: ReactMouseEvent<HTMLButtonElement>) =>
                                    event.preventDefault()
                                  }
                                  onClick={() => addTag(tag)}
                                >
                                  {tag}
                                </TagSuggestionButton>
                              </li>
                            ))}
                          </TagSuggestions>
                        )}
                      </TagFieldWrapper>
                    </Field>
                  </SectionGrid>
                </FormSection>

                {formError && <FormError>{formError}</FormError>}
              </FormBody>
              <StickyFooter>
                <SecondaryButton
                  type="button"
                  onClick={handleFormCancel}
                  disabled={isSubmitting}
                >
                  Отмена
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={isSubmitting}>
                  Сохранить
                </PrimaryButton>
              </StickyFooter>
            </FormLayout>
          </ModalCard>
        </ModalOverlay>
      )}

      {previewScene && (
        <ModalOverlay role="dialog" aria-modal="true">
          <PreviewModalCard>
            <ModalHeader>
              <ModalTitle>{previewScene.name}</ModalTitle>
              <CloseModalButton
                type="button"
                aria-label="Закрыть"
                onClick={handleClosePreview}
              >
                ×
              </CloseModalButton>
            </ModalHeader>
            <PreviewBody>
              {previewScene.background ? (
                <PreviewImageLarge src={previewScene.background} alt={previewScene.name} />
              ) : (
                <ListEmpty>Нет изображения</ListEmpty>
              )}
            </PreviewBody>
          </PreviewModalCard>
        </ModalOverlay>
      )}

      {menuAnchor && typeof document !== "undefined" &&
        createPortal(
          <MenuContainer
            style={{
              top: Math.min(menuAnchor.rect.bottom + 8, window.innerHeight - 140),
              left: Math.min(menuAnchor.rect.left, window.innerWidth - 220),
            }}
          >
            <MenuItemButton type="button" onClick={() => handleDuplicate(menuAnchor.id)}>
              <IconCopy size={16} /> Дублировать
            </MenuItemButton>
          </MenuContainer>,
          document.body
        )}
    </ScenesTabRoot>
  );
}
