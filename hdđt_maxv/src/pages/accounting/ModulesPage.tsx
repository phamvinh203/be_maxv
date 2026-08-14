import { type JSX } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import AppSidebar from "../../features/accounting/_shared/AppSidebar";
import ModulePage from "../../features/accounting/_shared/ModulePage";
import { MODULES, defaultModulePath } from "../../features/accounting/_shared/config";
import { useKeToanNav } from "../../routes/useKeToanNav";

/** Khung module Kế toán: sidebar (7 module) + lưới chứng từ/danh mục/báo cáo — giống fe_maxv. */
export default function ModulesPage(): JSX.Element {
  const navigate = useNavigate();
  const { goTo } = useKeToanNav();
  const { moduleSlug } = useParams<{ moduleSlug: string }>();
  const config = moduleSlug ? MODULES[moduleSlug] : undefined;

  // Path trong config có sẵn dạng "/ton_kho/danh_muc/..." -> ghép /accounting ở trước.
  const openPath = (path: string) => navigate(`/accounting${path}`);

  if (!config) {
    return <Navigate to={defaultModulePath()} replace />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <AppHeader />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <AppSidebar active={moduleSlug!} onSelect={goTo} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <ModulePage config={config} onNavigate={openPath} />
        </div>
      </div>
    </div>
  );
}
