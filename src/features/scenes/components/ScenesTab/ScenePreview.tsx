import { useState } from "react";
import { IconArrowsMaximize, IconX } from "@tabler/icons-react";
import clsx from "clsx";

import type { Scene, SceneMode, SceneStatus } from "../../types";

import styles from "./ScenesTab.module.css";

type ScenePreviewProps = {
  scene: Scene;
  statusLabels: Record<SceneStatus, string>;
  statusClassNames: Record<SceneStatus, string>;
  modeLabels: Record<SceneMode, string>;
  onActivate: () => void;
  onClose: () => void;
  isBusy: boolean;
};

export default function ScenePreview({
  scene,
  statusLabels,
  statusClassNames,
  modeLabels,
  onActivate,
  onClose,
  isBusy,
}: ScenePreviewProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.previewOverlay} role="dialog" aria-modal="true" aria-labelledby="scene-preview-title">
      <div className={clsx(styles.previewCard, expanded && styles.previewCardExpanded)}>
        <header className={styles.previewHeader}>
          <div>
            <h3 id="scene-preview-title">{scene.name}</h3>
            <span className={clsx(styles.statusBadge, statusClassNames[scene.status])}>
              {statusLabels[scene.status]}
            </span>
          </div>
          <button
            type="button"
            className={styles.previewClose}
            onClick={onClose}
            aria-label="Закрыть предпросмотр"
          >
            <IconX size={18} stroke={1.6} />
          </button>
        </header>

        <div className={styles.previewMedia}>
          {scene.background ? (
            <img src={scene.background} alt={scene.name} />
          ) : (
            <span className={styles.previewPlaceholder}>Нет изображения</span>
          )}
          <button
            type="button"
            className={styles.expandButton}
            onClick={() => setExpanded((prev) => !prev)}
            aria-pressed={expanded}
          >
            <IconArrowsMaximize size={16} stroke={1.6} /> {expanded ? "Свернуть" : "Развернуть"}
          </button>
        </div>

        <div className={styles.previewContent}>
          <dl className={styles.previewDetails}>
            <div>
              <dt>Режим</dt>
              <dd>{modeLabels[scene.mode]}</dd>
            </div>
            <div>
              <dt>Размер карты</dt>
              <dd>
                {scene.width}×{scene.height} м
              </dd>
            </div>
            <div>
              <dt>Размер сетки</dt>
              <dd>{scene.gridSize} м</dd>
            </div>
          </dl>
          {scene.tags?.length ? (
            <div className={styles.previewTags}>
              <span>Теги:</span>
              <div>
                {scene.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <footer className={styles.previewFooter}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            Закрыть
          </button>
          <button type="button" className={styles.activateButton} onClick={onActivate} disabled={isBusy}>
            Активировать сцену
          </button>
        </footer>
      </div>
    </div>
  );
}
