import CanvasArea from "./components/CanvasArea";
import Sidebar from "./components/Sidebar";
import SidebarRight from "./components/SidebarRight";

export default function App() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0f1113]">
      <CanvasArea />
      <Sidebar />
      <SidebarRight />
    </div>
  );
}
