// Desvincula el numero: cierra la sesion en WhatsApp y borra las credenciales.
//
// logout() no es lo mismo que apagar el proceso: le dice a WhatsApp que este
// dispositivo se va, y desaparece de «Dispositivos vinculados» en el movil.
// Apagar sin mas dejaria la vinculacion viva.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SESION = path.join(AQUI, 'sesion');

if (!fs.existsSync(SESION)) {
  console.log('No hay sesion guardada: no habia nada vinculado.');
  process.exit(0);
}

const { state, saveCreds } = await useMultiFileAuthState(SESION);
const sock = makeWASocket({
  auth: state,
  browser: ['CRM MultiProyecto', 'Chrome', '1.0.0'],
  logger: pino({ level: 'silent' }),
  markOnlineOnConnect: false,
});
sock.ev.on('creds.update', saveCreds);

let hecho = false;
const limpiar = (motivo) => {
  if (hecho) return;
  hecho = true;
  fs.rmSync(SESION, { recursive: true, force: true });
  fs.rmSync(path.join(AQUI, 'qr.png'), { force: true });
  console.log(`Credenciales borradas del disco (${motivo}).`);
  process.exit(0);
};

sock.ev.on('connection.update', async ({ connection }) => {
  if (connection === 'open') {
    try {
      await sock.logout();
      console.log('Sesion cerrada en WhatsApp: el dispositivo ya no aparece vinculado.');
    } catch (e) {
      console.log('logout devolvio error:', e.message);
    }
    limpiar('tras cerrar sesion');
  }
  if (connection === 'close') limpiar('la conexion se cerro');
});

// Si en 25 s no ha conectado (movil apagado, sin internet), se borran las
// credenciales igual: sin ellas este equipo no puede volver a entrar.
setTimeout(() => limpiar('sin respuesta en 25 s'), 25000);
