import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { useStore } from './store/useStore';
import Dashboard from './pages/Dashboard';
import Canvas from './pages/Canvas';
import ViewOnly from './pages/ViewOnly';
import './index.css';
import 'reactflow/dist/style.css';

function App() {
  const setUser = useStore(s => s.setUser);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, user => setUser(user));
    return unsub;
  }, [setUser]);

  return (
    <BrowserRouter basename="/DFAVisualizer">
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/canvas/:id" element={<Canvas />} />
        <Route path="/view" element={<ViewOnly />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
