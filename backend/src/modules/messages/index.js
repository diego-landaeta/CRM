import router from './message.routes.js';

/**
 * El chat interno del equipo.
 *
 * La direccion va en castellano, como el resto del CRM desde que se tradujeron
 * las rutas, y el nombre viejo se queda de `alias` para no romper a nadie que
 * siga pidiendo por el.
 *
 * Es la convencion que fijo Diego el 24/08 despues de arreglar este mismo fallo
 * cuatro veces —Informes, Ventas, Secuencias y este—: al traducir las rutas se
 * renombraron las llamadas del frontal y no los prefijos del servidor, y quedaron
 * pantallas enteras pidiendo a una direccion que no contestaba. Aqui nunca llego
 * el arreglo: el frontal pedia `/api/mensajes` y esto servia `/api/messages`, asi
 * que el apartado entero daba 404 desde que existe.
 */
export default {
  prefix: '/api/mensajes',
  alias: ['/api/messages'],
  router,
};
