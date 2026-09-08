import { Phone, ChatCircleText, EnvelopeSimple, Users, Question } from '@phosphor-icons/react';

/*
  Los canales de un paso, con su icono y su nombre.

  Van SIEMPRE en el orden en que llegan del servidor: ese orden significa «por
  dónde se intenta primero». Pintarlos ordenados alfabéticamente, o como
  etiquetas sueltas, pierde media instrucción.
*/

const CANALES: Record<string, { nombre: string; icono: any }> = {
  llamada: { nombre: 'Llamada', icono: Phone },
  whatsapp: { nombre: 'WhatsApp', icono: ChatCircleText },
  wasapi: { nombre: 'Wasapi', icono: ChatCircleText },
  email: { nombre: 'Correo', icono: EnvelopeSimple },
  presencial: { nombre: 'Presencial', icono: Users },
};

export function nombreDeCanal(clave: string) {
  return CANALES[clave]?.nombre || clave;
}

export function iconoDeCanal(clave: string) {
  return CANALES[clave]?.icono || Question;
}
