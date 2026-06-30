import { useState, type JSX } from 'react';
import AppHeader from '../components/AppHeader';
import AppSidebar from '../components/AppSidebar';
import ModulePage from '../components/ModulePage';
import { MODULES, MODULE_ORDER } from '../config/modules';

export default function ModulesPage(): JSX.Element {
  const [active, setActive] = useState<string>(MODULE_ORDER[0].slug);
  const config = MODULES[active];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <AppSidebar active={active} onSelect={setActive} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* onNavigate để trống: chỉ hiển thị giao diện, chưa nối điều hướng */}
          <ModulePage config={config} />
        </div>
      </div>
    </div>
  );
}
