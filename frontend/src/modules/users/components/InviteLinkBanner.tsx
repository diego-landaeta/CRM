import { X } from '@phosphor-icons/react';
import { copyToClipboard } from '@/shared/lib/clipboard';
import { toast } from '@/shared/hooks/useToast';

interface Props {
  email: string;
  url: string;
  onClose: () => void;
}

/**
 * El alta manda un correo con el enlace para poner contraseña. Hoy el CRM no
 * tiene clave de Brevo, asi que ese correo no sale: sin este recuadro, el
 * usuario recien creado no puede entrar y nadie se entera. El enlace caduca en
 * 24h — si caduca, hoy no hay forma de regenerarlo sin tocar la base.
 */
export default function InviteLinkBanner({ email, url, onClose }: Props) {
  async function copiar() {
    const ok = await copyToClipboard(url);
    toast(ok ? { title: 'Link copiado' } : { title: 'No se pudo copiar', variant: 'destructive' });
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs">
          <p className="font-semibold text-amber-900 dark:text-amber-200">Invitación pendiente para {email}</p>
          <p className="text-amber-800/80 dark:text-amber-300/80 mt-0.5">
            Si el envío por email no está activo, copia este link y pásaselo. Caduca en 24h.
            Al abrirlo el usuario define su propia contraseña.
          </p>
        </div>
        <button onClick={onClose} aria-label="Cerrar" className="text-amber-900/60 hover:text-amber-900 dark:text-amber-300/60">
          <X size={14} weight="bold" />
        </button>
      </div>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 h-8 px-2 rounded-md border border-amber-300 dark:border-amber-700 bg-white/80 dark:bg-black/30 text-meta font-mono"
        />
        <button onClick={copiar} className="h-8 px-3 rounded-md bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700">
          Copiar
        </button>
      </div>
    </div>
  );
}
