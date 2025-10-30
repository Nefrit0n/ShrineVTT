import CanvasArea from "../components/CanvasArea";
import SceneTools from "../components/SceneTools";
import Sidebar from "../components/Sidebar";

const referenceSections = [
  {
    title: "Как начать",
    items: [
      "Откройте Инструменты сцены, чтобы увидеть слои взаимодействия.",
      "Пригласите игроков из лобби и назначьте им персонажей.",
      "Загрузите карты и перетащите их на канвас, чтобы подготовить сцену."
    ]
  },
  {
    title: "Ключевые моменты",
    items: [
      "Отряд пробуждается в Святилище Эха.",
      "Решите загадку зеркального сигила и откройте внутренний зал.",
      "Победите стража-хранителя, чтобы вернуть Астральный Ключ-камень."
    ]
  }
];

const quickNotes = [
  {
    heading: "Советы по макросам",
    body: "Перетащите способности или формулы кубов на панель макросов, чтобы закрепить их для всей группы."
  },
  {
    heading: "Статус сцены",
    body: "Приостановите игру через оверлей канваса, чтобы заморозить токены и скрыть GM-обновления."
  }
];

const sessionLog = {
  lastUpdated: "Обновлено 5 минут назад",
  description:
    "Зеркальный коридор гудит скрытой энергией, пока отряд приближается к алтарю. Свет сплетается вокруг ключ-камня, ожидая финального заклинания."
};

export default function MainLayout() {
  return (
    <div className="workspace">
      <CanvasArea />
      <div className="workspace-overlay">
        <SceneTools />
        <Sidebar referenceSections={referenceSections} quickNotes={quickNotes} sessionLog={sessionLog} />
      </div>
    </div>
  );
}
