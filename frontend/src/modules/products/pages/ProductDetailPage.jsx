import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProject } from '@/shared/hooks/useProject';
import { getProduct } from '../api/products.api';
import DossierPanel from '../components/DossierPanel';
import { Button } from '@/shared/components/ui/button';
import { ArrowLeft } from '@phosphor-icons/react';

export default function ProductDetailPage() {
  const { id } = useParams();
  const { activeProject } = useProject();
  const projectId = activeProject?.id;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !id) return;
    setLoading(true);
    getProduct(id, projectId)
      .then(setProduct)
      .finally(() => setLoading(false));
  }, [id, projectId]);

  if (!projectId) return <div className="p-8 text-center text-muted-foreground">Selecciona un proyecto.</div>;
  if (loading) return <div className="p-8 text-muted-foreground">Cargando producto...</div>;
  if (!product) return <div className="p-8 text-destructive">Producto no encontrado.</div>;

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/products"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{product.nombre}</h1>
          {product.descripcion && <p className="text-muted-foreground">{product.descripcion}</p>}
        </div>
      </div>
      <hr />
      <DossierPanel productId={product.id} projectId={projectId} />
    </div>
  );
}
