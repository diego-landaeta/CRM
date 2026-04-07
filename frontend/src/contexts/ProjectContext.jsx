import { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const { activeProject, projects, switchProject } = useAuth();

  return (
    <ProjectContext.Provider value={{
      activeProject: activeProject || { id: null, nombre: 'Sin proyecto' },
      projects: projects || [],
      switchProject,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjectContext must be used within ProjectProvider');
  return ctx;
}
