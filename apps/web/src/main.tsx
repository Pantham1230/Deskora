import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { ToastProvider } from './components/Toast';
import { useAuthStore } from './store/auth';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

function Bootstrap() {
  const bootstrap = useAuthStore((state) => state.bootstrap);

  React.useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return <App />;
}

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <Bootstrap />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
