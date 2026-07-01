import { useState, type JSX } from 'react';
import AppHeader from '../components/AppHeader';
import AppSidebar from '../components/AppSidebar';
import ModulePage from '../components/ModulePage';
import EmployeesPage from './EmployeesPage';
import { MODULES, MODULE_ORDER } from '../config/modules';

interface Props {
  onLogout: () => void;
}

const EMPLOYEES_PATH = '/he-thong/nhan-vien';

export default function ModulesPage({ onLogout }: Props): JSX.Element {
  const [active, setActive] = useState<string>(MODULE_ORDER[0].slug);
  const [view, setView] = useState<'tiles' | typeof EMPLOYEES_PATH>('tiles');
  const config = MODULES[active];

  function handleNavigate(path: string): void {
    if (path === EMPLOYEES_PATH) setView(EMPLOYEES_PATH);
  }

  function selectModule(slug: string): void {
    setActive(slug);
    setView('tiles');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppHeader onLogout={onLogout} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <AppSidebar active={active} onSelect={selectModule} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {view === EMPLOYEES_PATH ? (
            <EmployeesPage onBack={() => setView('tiles')} />
          ) : (
            <ModulePage config={config} onNavigate={handleNavigate} />
          )}
        </div>
      </div>
    </div>
  );
}
