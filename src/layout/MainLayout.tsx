import CanvasArea from "../components/CanvasArea";
import SceneTools from "../components/SceneTools";
import Sidebar from "../components/Sidebar";

export default function MainLayout() {
  return (
    <div className="workspace">
      <CanvasArea />
      <div className="workspace-overlay">
        <SceneTools />
        <Sidebar />
      </div>
    </div>
  );
}
