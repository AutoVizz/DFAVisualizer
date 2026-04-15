import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CanvasPage from './pages/CanvasPage';
import ViewOnly from './pages/ViewOnly';
import { useStore } from './store/useStore';
import { onAuthChange } from './lib/auth';

const App: React.FC = () => {
  const setUser = useStore((s) => s.setUser);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setUser(user);
    });
    return unsubscribe;
  }, [setUser]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/canvas/:id" element={<CanvasPage />} />
        <Route path="/view" element={<ViewOnly />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
