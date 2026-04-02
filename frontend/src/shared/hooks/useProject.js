// Wrapper de compatibilidad — delega al ProjectContext
// ProductsPage y ProductDetailPage usan este hook
import { useProjectContext } from '@/contexts/ProjectContext';

export function useProject() {
  const { activeProject, switchProject } = useProjectContext();
  return { activeProject, setActiveProject: (p) => switchProject(p.id) };
}
