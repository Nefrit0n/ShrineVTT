import { useMemo, useState } from "react";
import type { TablerIcon } from "@tabler/icons-react";
import {
  IconArchive,
  IconBackpack,
  IconBook2,
  IconCards,
  IconMap2,
  IconMessages,
  IconMusic,
  IconSettings,
  IconSwords,
  IconTableOptions,
  IconUsersGroup
} from "@tabler/icons-react";
import clsx from "clsx";

type SceneToolTab = {
  id: string;
  label: string;
  icon: TablerIcon;
  description: string;
  highlights?: string[];
  note?: string;
  rollModes?: string[];
};

const TABS: SceneToolTab[] = [
  {
    id: "chat",
    label: "Чат",
    icon: IconMessages,
    description:
      "Здесь появляются сообщения, шёпоты, использование предметов и броски, чтобы вы могли реагировать сразу.",
    highlights: [
      "Выберите режим видимости бросков: Публичный, Приватный для Мастера, Слепой для Мастера или Только себе.",
      "Мастер игры видит все броски, кроме сделанных только себе — тайны партии в безопасности."
    ],
    rollModes: [
      "Публичный",
      "Приватный для Мастера",
      "Слепой для Мастера",
      "Только себе"
    ]
  },
  {
    id: "combat",
    label: "Бой",
    icon: IconSwords,
    description:
      "Запускайте столкновения и отслеживайте инициативу, здоровье и ход раунда в одном окне."
  },
  {
    id: "scenes",
    label: "Сцены",
    icon: IconMap2,
    description:
      "Храните театральные сцены и тактические карты. Активируйте и переключайте их по ходу истории."
  },
  {
    id: "actors",
    label: "Персонажи",
    icon: IconUsersGroup,
    description:
      "Персонажи игроков, существа и NPC живут здесь. Настраивайте листы, права и заметки для ролевых сцен."
  },
  {
    id: "items",
    label: "Предметы",
    icon: IconBackpack,
    description:
      "Инвентарь мира: снаряжение, заклинания, способности и уникальные находки готовы к перетаскиванию."
  },
  {
    id: "journal",
    label: "Журнал",
    icon: IconBook2,
    description:
      "Планируйте приключения, ведите заметки и храните лор — всё, что понадобится под рукой."
  },
  {
    id: "roll-tables",
    label: "Таблицы бросков",
    icon: IconTableOptions,
    description:
      "Создавайте таблицы для случайных сокровищ, встреч или вдохновения одним кликом."
  },
  {
    id: "cards",
    label: "Карты",
    icon: IconCards,
    description:
      "Управляйте колодами, стопками и руками игроков для мини-игр и особых механик."
  },
  {
    id: "music",
    label: "Музыка",
    icon: IconMusic,
    description:
      "Подбирайте плейлисты и саундборды. Каждый игрок настраивает громкость сам — атмосфера под контролем."
  },
  {
    id: "compendium",
    label: "Компендии",
    icon: IconArchive,
    description:
      "Долговременное хранилище: складывайте сюда персонажей, предметы, сцены, таблицы, карты и музыку (кроме столкновений).",
    highlights: [
      "Ускоряет загрузку мира, оставляя архивный контент под рукой, но не в памяти."
    ]
  },
  {
    id: "settings",
    label: "Настройки",
    icon: IconSettings,
    description:
      "Управляйте миром: меняйте параметры, модули и поведение системы.",
    highlights: [
      "Редактируйте детали мира, управляйте пользователями и отправляйте приглашения.",
      "Запускайте интерактивные туры, формируйте отчёты поддержки и переходите к документации.",
      "Завершайте сессию, выходите из аккаунта или возвращайтесь в меню настройки."
    ]
  }
];

export default function SceneTools() {
  const [activeId, setActiveId] = useState<string>(TABS[0]?.id ?? "chat");

  const activeTab = useMemo(
    () => TABS.find((tab) => tab.id === activeId) ?? TABS[0],
    [activeId]
  );

  return (
    <aside className={clsx("panel", "scene-tools")} aria-label="Инструменты сцены">
      <header className="scene-tools__header">
        <span className="scene-tools__eyebrow">Мир</span>
        <h2>Инструменты сцены</h2>
        <p>Все данные и ресурсы стола, собранные в одном месте.</p>
      </header>
      <div className="scene-tools__content">
        <nav
          className="scene-tools__tablist"
          role="tablist"
          aria-label="Разделы панели"
        >
          {TABS.map(({ id, icon: Icon, label }) => {
            const active = id === activeId;
            return (
              <button
                key={id}
                id={`scene-tools-tab-${id}`}
                className={clsx("scene-tools__tab", { active })}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`scene-tools-panel-${id}`}
                onClick={() => setActiveId(id)}
              >
                <span className="scene-tools__tab-icon" aria-hidden="true">
                  <Icon size={18} stroke={1.7} />
                </span>
                <span className="scene-tools__tab-label">{label}</span>
              </button>
            );
          })}
        </nav>
        {activeTab && (
          <section
            key={activeTab.id}
            className="scene-tools__panel"
            role="tabpanel"
            id={`scene-tools-panel-${activeTab.id}`}
            aria-labelledby={`scene-tools-tab-${activeTab.id}`}
          >
            <header className="scene-tools__panel-header">
              <h3>{activeTab.label}</h3>
              <p>{activeTab.description}</p>
            </header>
            {activeTab.highlights && (
              <ul>
                {activeTab.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {activeTab.rollModes && (
              <div className="scene-tools__panel-roll-modes">
                <span className="scene-tools__roll-label">Режимы бросков</span>
                <div className="scene-tools__roll-chips">
                  {activeTab.rollModes.map((mode) => (
                    <span className="scene-tools__roll-chip" key={mode}>
                      {mode}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {activeTab.note && <p className="scene-tools__panel-note">{activeTab.note}</p>}
          </section>
        )}
      </div>
    </aside>
  );
}
