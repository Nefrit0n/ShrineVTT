import { CSSProperties, memo, useMemo } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  IconDotsVertical,
  IconGripVertical,
  IconPencil,
  IconPlayerPlay,
  IconTrash,
} from "@tabler/icons-react";
import {
  Draggable,
  DraggableProvided,
  DraggableStateSnapshot,
  Droppable,
  DroppableProvided,
  DraggableRubric,
  DraggableProvidedDragHandleProps,
} from "@hello-pangea/dnd";
import { FixedSizeList, ListChildComponentProps } from "react-window";
import clsx from "clsx";

import type { Scene, SceneMode, SceneStatus } from "../../types";

import styles from "./ScenesTab.module.css";
import useContainerSize from "./useContainerSize";

type SceneListProps = {
  scenes: Scene[];
  activeSceneId: string | null;
  isBusy: boolean;
  statusLabels: Record<SceneStatus, string>;
  statusClassNames: Record<SceneStatus, string>;
  modeLabels: Record<SceneMode, string>;
  onActivate: (sceneId: string) => void;
  onEdit: (sceneId: string) => void;
  onDelete: (sceneId: string) => void;
  onPreview: (scene: Scene) => void;
  onOpenMenu: (scene: Scene, event: ReactMouseEvent<HTMLButtonElement>) => void;
};

type RowData = {
  scenes: Scene[];
  activeSceneId: string | null;
  isBusy: boolean;
  statusLabels: Record<SceneStatus, string>;
  statusClassNames: Record<SceneStatus, string>;
  modeLabels: Record<SceneMode, string>;
  onActivate: (sceneId: string) => void;
  onEdit: (sceneId: string) => void;
  onDelete: (sceneId: string) => void;
  onPreview: (scene: Scene) => void;
  onOpenMenu: (scene: Scene, event: ReactMouseEvent<HTMLButtonElement>) => void;
};

const ITEM_HEIGHT = 92;

const SceneRow = memo(({ index, style, data }: ListChildComponentProps<RowData>) => {
  const scene = data.scenes[index];
  if (!scene) return null;

  return (
    <Draggable draggableId={scene.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          style={combineItemStyles(style, provided.draggableProps.style)}
        >
          <SceneCard
            scene={scene}
            isActive={scene.id === data.activeSceneId}
            isBusy={data.isBusy}
            statusLabel={data.statusLabels[scene.status]}
            statusClassName={data.statusClassNames[scene.status]}
            modeLabel={data.modeLabels[scene.mode]}
            onActivate={data.onActivate}
            onEdit={data.onEdit}
            onDelete={data.onDelete}
            onPreview={data.onPreview}
            onOpenMenu={data.onOpenMenu}
            dragHandleProps={provided.dragHandleProps}
            isDragging={snapshot.isDragging}
          />
        </div>
      )}
    </Draggable>
  );
});

SceneRow.displayName = "SceneRow";

export default function SceneList({
  scenes,
  activeSceneId,
  isBusy,
  statusLabels,
  statusClassNames,
  modeLabels,
  onActivate,
  onEdit,
  onDelete,
  onPreview,
  onOpenMenu,
}: SceneListProps) {
  const { ref, size } = useContainerSize<HTMLDivElement>();

  const height = useMemo(() => {
    if (!scenes.length) return ITEM_HEIGHT;
    const estimated = scenes.length * ITEM_HEIGHT;
    const available = size.height || estimated;
    const minVisible = ITEM_HEIGHT * Math.min(scenes.length, 6);
    return Math.max(Math.min(estimated, available), minVisible);
  }, [scenes.length, size.height]);

  const width = Math.max(1, size.width || 1);

  const itemData = useMemo<RowData>(
    () => ({
      scenes,
      activeSceneId,
      isBusy,
      statusLabels,
      statusClassNames,
      modeLabels,
      onActivate,
      onEdit,
      onDelete,
      onPreview,
      onOpenMenu,
    }),
    [
      scenes,
      activeSceneId,
      isBusy,
      statusLabels,
      statusClassNames,
      modeLabels,
      onActivate,
      onEdit,
      onDelete,
      onPreview,
      onOpenMenu,
    ]
  );

  return (
    <section className={styles.listPanel} aria-label="Список сцен">
      <div className={styles.listBody} ref={ref}>
        {scenes.length ? (
          <Droppable droppableId="scenes" mode="virtual" renderClone={renderClone(itemData)}>
            {(provided: DroppableProvided) => (
              <FixedSizeList
                className={styles.virtualList}
                outerRef={provided.innerRef}
                itemCount={scenes.length}
                height={height}
                width={width}
                itemSize={ITEM_HEIGHT}
                itemData={itemData}
                overscanCount={6}
              >
                {SceneRow}
              </FixedSizeList>
            )}
          </Droppable>
        ) : (
          <p className={styles.emptyMessage}>Сцены не найдены</p>
        )}
      </div>
    </section>
  );
}

type SceneCardProps = {
  scene: Scene;
  isActive: boolean;
  isBusy: boolean;
  statusLabel: string;
  statusClassName: string;
  modeLabel: string;
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
  onActivate: (sceneId: string) => void;
  onEdit: (sceneId: string) => void;
  onDelete: (sceneId: string) => void;
  onPreview: (scene: Scene) => void;
  onOpenMenu: (scene: Scene, event: ReactMouseEvent<HTMLButtonElement>) => void;
  isDragging?: boolean;
};

const SceneCard = ({
  scene,
  isActive,
  isBusy,
  statusLabel,
  statusClassName,
  modeLabel,
  dragHandleProps,
  onActivate,
  onEdit,
  onDelete,
  onPreview,
  onOpenMenu,
  isDragging,
}: SceneCardProps) => {
  return (
    <div
      className={clsx(styles.sceneCard, isActive && styles.sceneCardActive, isDragging && styles.sceneCardDragging)}
      role="button"
      tabIndex={0}
      onClick={() => onPreview(scene)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " " || event.key === "Space") {
          event.preventDefault();
          onPreview(scene);
        }
      }}
    >
      <span className={clsx(styles.statusBadge, statusClassName)}>{statusLabel}</span>
      <div className={styles.cardThumbnail}>
        {scene.thumbnail ? (
          <img src={scene.thumbnail} alt="Миниатюра сцены" />
        ) : (
          <span className={styles.cardPlaceholder}>Нет изображения</span>
        )}
      </div>
      <div className={styles.cardMain}>
        <div className={styles.cardTitleRow}>
          <div className={styles.cardTitleBlock}>
            <h3 className={styles.cardTitle}>{scene.name}</h3>
            <span className={styles.metaTooltip} data-tooltip={`${modeLabel}. Сетка ${scene.gridSize} м.`}>
              {modeLabel}
            </span>
          </div>
          <div className={styles.cardActions}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={(event) => {
                event.stopPropagation();
                onActivate(scene.id);
              }}
              disabled={isBusy}
              aria-label="Активировать сцену"
            >
              <IconPlayerPlay size={16} stroke={1.6} />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={(event) => {
                event.stopPropagation();
                onEdit(scene.id);
              }}
              disabled={isBusy}
              aria-label="Редактировать сцену"
            >
              <IconPencil size={16} stroke={1.6} />
            </button>
            <button
              type="button"
              className={clsx(styles.iconButton, styles.deleteButton)}
              onClick={(event) => {
                event.stopPropagation();
                onDelete(scene.id);
              }}
              disabled={isBusy || isActive}
              aria-label="Удалить сцену"
            >
              <IconTrash size={16} stroke={1.6} />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={(event) => {
                event.stopPropagation();
                onOpenMenu(scene, event);
              }}
              aria-haspopup="menu"
              aria-label="Другие действия"
            >
              <IconDotsVertical size={16} stroke={1.6} />
            </button>
          </div>
        </div>
        <div className={styles.cardMeta}>
          <span className={styles.metaItem}>Размер {scene.width}×{scene.height} м</span>
          <span className={styles.metaItem}>Сетка {scene.gridSize} м</span>
        </div>
        {scene.tags?.length ? (
          <div className={styles.cardTags} aria-label="Теги сцены">
            {scene.tags.map((tag) => (
              <span key={tag} className={styles.cardTag}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className={styles.dragHandle}
        {...dragHandleProps}
        aria-label="Переместить сцену"
        onClick={(event) => event.stopPropagation()}
      >
        <IconGripVertical size={16} stroke={1.6} />
      </button>
    </div>
  );
};

function renderClone(data: RowData) {
  return (
    provided: DraggableProvided,
    snapshot: DraggableStateSnapshot,
    rubric: DraggableRubric
  ) => {
    const scene = data.scenes[rubric.source.index];
    if (!scene) return null;

    return (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        style={{
          ...(provided.draggableProps.style as CSSProperties),
          width: "100%",
        }}
      >
        <SceneCard
          scene={scene}
          isActive={scene.id === data.activeSceneId}
          isBusy={data.isBusy}
          statusLabel={data.statusLabels[scene.status]}
          statusClassName={data.statusClassNames[scene.status]}
          modeLabel={data.modeLabels[scene.mode]}
          onActivate={data.onActivate}
          onEdit={data.onEdit}
          onDelete={data.onDelete}
          onPreview={data.onPreview}
          onOpenMenu={data.onOpenMenu}
          dragHandleProps={provided.dragHandleProps}
          isDragging={snapshot.isDragging}
        />
      </div>
    );
  };
}

function combineItemStyles(
  virtualStyle: CSSProperties,
  draggableStyle: CSSProperties | undefined
): CSSProperties {
  return {
    ...virtualStyle,
    ...draggableStyle,
    width: "100%",
  };
}
