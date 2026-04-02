import { createContext, useState, useContext } from 'react';
import { PROJECTS } from '@/shared/data/mock';

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [activeProject, setActiveProject] = useState(() => {
    const saved = localStorage.getItem('crm_active_project');
    if (saved) {
      const parsed = JSON.parse(saved);
      return PROJECTS.find((p) => p.id === parsed.id) || PROJECTS[0];
    }
    return PROJECTS[0];
  });

  function switchProject(projectId) {
    const project = PROJECTS.find((p) => p.id === projectId);
    if (project) {
      setActiveProject(project);
      localStorage.setItem('crm_active_project', JSON.stringify(project));
    }
  }

  return (
    <ProjectContext.Provider value={{ activeProject, switchProject, projects: PROJECTS }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjectContext must be used within ProjectProvider');
  return ctx;
}
