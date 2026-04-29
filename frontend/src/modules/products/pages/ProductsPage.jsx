import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import { useProject } from '@/shared/hooks/useProject';
import ProductFormDialog from '../components/ProductFormDialog';
import { toast } from '@/shared/hooks/useToast';
import { Plus, PencilSimple, Trash, FileText, Package } from '@phosphor-icons/react';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import { SkeletonCard } from '@/shared/components/ui/SkeletonTable';

const ConfirmDialog = lazy(() => import('@/shared/components/ui/ConfirmDialog'));

export default function ProductsPage() {
  const navigate = useNavigate();
  const { activeProject } = useProject();
  const projectId = activeProject?.id;
  const { products, loading, error, create, update, deactivate } = useProducts(projectId);

  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  function openCreate() {
    setEditingProduct(null);
    setFormOpen(true);
  }

  function openEdit(product) {
    setEditingProduct(product);
    setFormOpen(true);
  }

  async function handleSubmit(data) {
    try {
      if (editingProduct) {
        await update(editingProduct.id, data);
        toast({ title: 'Producto actualizado', description: data.nombre });
      } else {
        await create(data);
        toast({ title: 'Producto creado', description: data.nombre });
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      throw err;
    }
  }

  async function handleDeactivate() {
    if (!deleteTarget) return;
    try {
      await deactivate(deleteTarget.id);
      toast({ title: 'Producto desactivado', description: deleteTarget.nombre, variant: 'destructive' });
      setDeleteTarget(null);
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  if (!projectId) {
    return (
      <EmptyState
        icon={Package}
        title="Selecciona un proyecto"
        description="Elige un proyecto en el sidebar para ver sus productos."
        className="py-32"
      />
    );
  }

  return (
    <div className="space-y-6">
      <ProductFormDialog open={formOpen} onClose={() => setFormOpen(false)} product={editingProduct} onSubmit={handleSubmit} />

      <Suspense fallback={null}>
        <ConfirmDialog
          open={!!deleteTarget}
          title="Desactivar producto"
          message={<>Vas a desactivar <strong>&quot;{deleteTarget?.nombre}&quot;</strong>. El producto dejará de estar visible pero no se eliminará.</>}
          confirmLabel="Desactivar"
          tone="destructive"
          onConfirm={handleDeactivate}
          onCancel={() => setDeleteTarget(null)}
        />
      </Suspense>

      <PageHeader
        title="Productos"
        subtitle={`Catálogo de productos y dossiers — ${activeProject.nombre}`}
        actions={
          <button
            onClick={openCreate}
            aria-label="Nuevo producto"
            className="flex items-center gap-2 h-9 px-3 sm:px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
          >
            <Plus size={16} weight="bold" /> <span className="hidden sm:inline">Nuevo Producto</span>
          </button>
        }
      />

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2 font-medium">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No hay productos en este proyecto"
          description="Crea tu primer producto para empezar a gestionar el catálogo."
          action={
            <button
              onClick={openCreate}
              className="flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} weight="bold" /> Crear primer producto
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((product) => (
            <div key={product.id} className={`bg-card p-5 rounded-lg border border-border  transition-all ${!product.active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                  <Package size={20} weight="regular" />
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${product.active ? 'bg-emerald-50 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                  {product.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <h3 className="font-semibold">{product.nombre}</h3>
              <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-2">{product.descripcion || 'Sin descripción'}</p>

              {product.precio && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <span className="text-xl font-semibold">{product.precio.toLocaleString('es-ES')} &euro;</span>
                </div>
              )}

              <div className="flex items-center gap-2 mt-3 text-[13px]">
                {product.has_dossier ? (
                  <button
                    onClick={() => navigate(`/products/${product.id}`)}
                    className="flex items-center gap-1.5 text-primary font-medium hover:underline"
                  >
                    <FileText size={14} /> Dossier v{product.dossier_version}
                  </button>
                ) : (
                  <span className="text-muted-foreground">Sin dossier</span>
                )}
              </div>

              <div className="flex gap-2 mt-3 pt-3 border-t">
                <button
                  onClick={() => openEdit(product)}
                  aria-label={`Editar ${product.nombre}`}
                  className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-md border border-border bg-card text-[13px] font-medium hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <PencilSimple size={14} /> Editar
                </button>
                <button
                  onClick={() => setDeleteTarget(product)}
                  aria-label={`Desactivar ${product.nombre}`}
                  title="Desactivar producto"
                  className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-md border border-border text-[13px] font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  <Trash size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
