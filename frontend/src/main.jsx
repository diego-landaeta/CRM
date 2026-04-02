import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ProjectProvider } from './contexts/ProjectContext';
import { ThemeProvider } from './contexts/ThemeContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/crm">
      <ThemeProvider>
        <ProjectProvider>
          <App />
        </ProjectProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
