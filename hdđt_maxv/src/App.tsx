import { Outlet } from "react-router-dom";

/** Root layout của toàn bộ route — nơi gắn provider/UI dùng chung cho mọi trang khi cần. */
function App() {
  return <Outlet />;
}

export default App;
