import { ShieldCheck } from '@phosphor-icons/react';

const ITEMS = [
  { label: 'Encriptacion de credenciales API', value: 'AES-256-GCM' },
  { label: 'Hash de contraseñas', value: 'bcrypt (cost factor 12)' },
  { label: 'JWT Access Token TTL', value: '15 minutos' },
  { label: 'Refresh Token TTL', value: '30 dias (httpOnly cookie)' },
  { label: 'CORS', value: 'Por dominio de proyecto' },
  { label: 'PostgreSQL', value: 'Solo acceso local (no expuesto)' },
  { label: 'Certificado SSL', value: "Let's Encrypt (auto-renewal)" },
  { label: 'Pre-signed URLs', value: '15 min expiracion' },
];

export default function SecurityTab() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Seguridad</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">Configuración de seguridad del sistema</p>
      </div>
      <div className="space-y-3">
        {ITEMS.map((s) => (
          <div key={s.label} className="bg-card p-4 rounded-lg border border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/30">
                <ShieldCheck size={16} className="text-emerald-600" weight="regular" />
              </div>
              <div>
                <p className="text-[13px] font-semibold">{s.label}</p>
                <p className="text-[11px] text-muted-foreground">{s.value}</p>
              </div>
            </div>
            <span className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-medium">OK</span>
          </div>
        ))}
      </div>
    </div>
  );
}
