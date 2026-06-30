import { useState } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ModulesPage from './pages/ModulesPage';

type View = 'login' | 'register' | 'app';

function App() {
  // Điều hướng tạm bằng state (chưa cài router) — UI-only.
  const [view, setView] = useState<View>('login');

  if (view === 'login') {
    return (
      <LoginPage
        onRegister={() => setView('register')}
        onLoggedIn={() => setView('app')}
      />
    );
  }
  if (view === 'register') {
    return <RegisterPage onLogin={() => setView('login')} />;
  }
  return <ModulesPage />;
}

export default App;
