import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { WhatsappLogo, QrCode, CheckCircle, WarningCircle, ArrowClockwise } from '@phosphor-icons/react';
import client from '@/shared/api/client';
import { toast } from '@/shared/hooks/useToast';
import { chatApi, type ConexionWhatsapp } from '../api/whatsapp.api';

// Conectar el numero de WhatsApp al CRM.
//
// Se escanea UNA vez y la sesion queda en el servidor: no hay que repetirlo
// cada dia. Si se cae —el movil sin internet, o alguien cierra la sesion desde
// el telefono— esta pantalla lo dice y deja volver a emparejar.

export default function ConexionPage() {
  const [estado, setEstado] = useState<ConexionWhatsapp | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState(false);

  const mirar = useCallback(async () => {
    try {
      const r = await chatApi.conexion();
      if (r.success) {
        setEstado(r.data);
        if (r.data.conectado) setQr(null);
      }
    } catch { /* la pantalla ya dice que no hay conexion */ }
  }, []);

  useEffect(() => {
    mirar();
    // Mientras hay QR en pantalla interesa enterarse en cuanto se escanea; el
    // resto del tiempo basta con mirar de vez en cuando.
    const t = setInterval(mirar, qr ? 3000 : 15000);
    return () => clearInterval(t);
  }, [mirar, qr]);

  async function emparejar() {
    setPidiendo(true);
    try {
      const r = await client.post('/whatsapp/emparejar', {});
      if (!r.success) throw new Error(r.error || 'No se pudo pedir el codigo');
      if (!r.data?.qr) {
        toast({ title: 'Sin codigo', description: 'El servidor no devolvio ningun QR. Puede que ya este conectado.' });
        await mirar();
        return;
      }
      setQr(r.data.qr);
    } catch (e) {
      toast({ title: 'No se pudo emparejar', description: (e as Error).message, variant: 'destructive' });
    } finally { setPidiendo(false); }
  }

  const conectado = estado?.conectado;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-start gap-3">
          <WhatsappLogo size={32} weight="duotone" className="text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold">Conexion de WhatsApp</h1>
            <p className="text-sm text-muted-foreground">
              El numero desde el que el CRM escribe a los prospectos.
            </p>
          </div>
          <button type="button" onClick={mirar} title="Comprobar ahora"
            className="p-2 rounded-md hover:bg-muted text-muted-foreground">
            <ArrowClockwise size={16} />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm">
          {estado === null ? (
            <span className="text-muted-foreground">Comprobando…</span>
          ) : !estado.configurado ? (
            <>
              <WarningCircle size={18} weight="fill" className="text-amber-500 shrink-0" />
              <span className="text-amber-700 dark:text-amber-400">{estado.motivo}</span>
            </>
          ) : conectado ? (
            <>
              <CheckCircle size={18} weight="fill" className="text-emerald-600 shrink-0" />
              <span>
                Conectado como{' '}
                <strong>{estado.nombre || (estado.numero ? `+${estado.numero}` : estado.instancia)}</strong>
              </span>
            </>
          ) : (
            <>
              <WarningCircle size={18} weight="fill" className="text-amber-500 shrink-0" />
              <span className="text-amber-700 dark:text-amber-400">
                Sin sesion ({estado.estado || 'cerrada'}). Hay que emparejar un numero.
              </span>
            </>
          )}
        </div>

        {estado?.configurado && !conectado && (
          <button type="button" onClick={emparejar} disabled={pidiendo}
            className="mt-4 h-9 px-3 rounded-md bg-emerald-600 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-50">
            <QrCode size={16} weight="bold" />
            {pidiendo ? 'Pidiendo codigo…' : 'Conectar un numero'}
          </button>
        )}
      </div>

      {qr && (
        <div className="bg-card border border-border rounded-lg p-5 text-center">
          <h2 className="font-semibold mb-1">Escanea este codigo</h2>
          <ol className="text-sm text-muted-foreground mb-4 inline-block text-left leading-relaxed">
            <li>1. Abre WhatsApp en el movil de ese numero</li>
            <li>2. Ajustes → <strong>Dispositivos vinculados</strong></li>
            <li>3. <strong>Vincular un dispositivo</strong> y apunta a la pantalla</li>
          </ol>
          <div className="grid place-items-center">
            <img src={qr} alt="Codigo QR de WhatsApp" className="w-64 h-64 rounded-lg bg-white p-2" />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            El codigo caduca en menos de un minuto. Si expira, vuelve a pulsar «Conectar un numero».
          </p>
        </div>
      )}

      {conectado && (
        <div className="bg-card border border-border rounded-lg p-5 text-sm space-y-2">
          <p className="font-semibold">Ya puedes usar el chat</p>
          <p className="text-muted-foreground">
            Las conversaciones aparecen solas cuando alguien escribe, y se atan al prospecto
            que tenga ese telefono.
          </p>
          <Link to="/whatsapp/chat" className="text-primary hover:underline font-medium inline-block">
            Ir al chat →
          </Link>
        </div>
      )}

      {/* No es burocracia: el numero es de una persona, y si WhatsApp lo
          suspende se pierden tambien sus conversaciones personales. */}
      <div className="border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 text-sm">
        <p className="font-semibold text-amber-900 dark:text-amber-200 mb-1">Antes de conectar un numero</p>
        <ul className="text-amber-800 dark:text-amber-300/90 space-y-1 leading-relaxed">
          <li>· Usa un numero <strong>dedicado al trabajo</strong>, no el personal de nadie.</li>
          <li>· El CRM se niega a escribir a quien no dejo su telefono en un formulario. Es lo que evita los bloqueos.</li>
          <li>· Si alguien pide que no le escribas, marcalo en el chat y no se le vuelve a escribir.</li>
          <li>· Para desvincular: en el movil, Ajustes → Dispositivos vinculados → cerrar sesion.</li>
        </ul>
      </div>
    </div>
  );
}
