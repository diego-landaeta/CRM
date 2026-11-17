import crypto from 'crypto';

/*
  ZADARMA: LA FIRMA DE LAS PETICIONES Y DE LOS AVISOS (#137).

  Fuentes, las dos oficiales de Zadarma:
    · https://zadarma.com/en/support/api/  («Authorization» y los métodos
      /v1/request/callback/ y /v1/info/balance/)
    · https://github.com/zadarma/user-api-v1 (su librería PHP):
      lib/Client.php (encodeSignature, getAuthHeader, httpBuildQuery),
      lib/Api.php (request, requestCallback, getWebhookEvent) y
      lib/Webhook/NotifyEnd.php, NotifyOutEnd.php (getSignatureString).

  PETICIONES. Cabecera `Authorization: <clave>:<firma>`, donde

      params  = ordenados por nombre (ksort) y en query string RFC 1738
                (http_build_query: el espacio va como «+»);
      firma   = base64( hash_hmac('sha1', metodo . params . md5(params), secreto) )

  y `metodo` es la ruta con su versión y la barra final: «/v1/request/callback/».
  La librería añade siempre `format=json` a los parámetros, y entra en la firma.

  OJO, LO QUE SE EQUIVOCA TODO EL MUNDO: `hash_hmac` de PHP devuelve el HMAC en
  HEXADECIMAL (minúsculas), no en binario, y lo que se pasa a base64 es ese
  texto hexadecimal. base64 del binario da otra firma y Zadarma contesta 401.

  AVISOS (webhooks). Zadarma manda la cabecera `Signature` con
      base64( hash_hmac('sha1', cadena, secreto) )   (otra vez, del hexadecimal)
  y la cadena depende del aviso:
      NOTIFY_END      caller_id . called_did . call_start
      NOTIFY_OUT_END  internal . destination . call_start
  Y al guardar la URL en su panel la comprueba con `?zd_echo=<algo>`: hay que
  devolver ese valor tal cual, sin nada más.
*/

export const ZADARMA_API_URL_POR_DEFECTO = 'https://api.zadarma.com';

/** La base de la API. Se puede cambiar por entorno (su sandbox o un servidor de pruebas). */
export function urlDeZadarma(metodo) {
  const base = (process.env.ZADARMA_API_URL || ZADARMA_API_URL_POR_DEFECTO).replace(/\/+$/, '');
  return `${base}${metodo}`;
}

/** Como `urlencode` de PHP (RFC 1738): todo salvo letras, números y «-_.», y el espacio como «+». */
function codificarComoPhp(v) {
  return encodeURIComponent(String(v))
    .replace(/[!'()*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
}

/** `http_build_query` de PHP sobre los parámetros ya ordenados por nombre (ksort). */
export function cadenaDeParametros(params) {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null)
    .sort()
    .map((k) => `${codificarComoPhp(k)}=${codificarComoPhp(params[k])}`)
    .join('&');
}

/** base64 del HMAC-SHA1 EN HEXADECIMAL, como `base64_encode(hash_hmac('sha1', …))`. */
export function codificarFirma(cadena, secreto) {
  const hex = crypto.createHmac('sha1', String(secreto)).update(String(cadena), 'utf8').digest('hex');
  return Buffer.from(hex, 'utf8').toString('base64');
}

/** La firma de una petición: metodo + params + md5(params). */
export function firmarPeticion(metodo, params, secreto) {
  const cadena = cadenaDeParametros(params);
  const md5 = crypto.createHash('md5').update(cadena, 'utf8').digest('hex');
  return { cadena, firma: codificarFirma(`${metodo}${cadena}${md5}`, secreto) };
}

/** La cadena que firma Zadarma en cada aviso. null si el aviso no es de los que se atienden. */
export function cadenaDelAviso(cuerpo) {
  const v = (k) => (cuerpo?.[k] == null ? '' : String(cuerpo[k]));
  switch (cuerpo?.event) {
    case 'NOTIFY_END': return v('caller_id') + v('called_did') + v('call_start');
    case 'NOTIFY_OUT_END': return v('internal') + v('destination') + v('call_start');
    default: return null;
  }
}

/** ¿Esta firma la ha hecho quien tiene este secreto? Comparación en tiempo constante. */
export function firmaDelAvisoValida(cuerpo, firma, secreto) {
  const cadena = cadenaDelAviso(cuerpo);
  if (cadena === null || !firma || !secreto) return false;
  const esperada = Buffer.from(codificarFirma(cadena, secreto));
  const recibida = Buffer.from(String(firma).trim());
  return esperada.length === recibida.length && crypto.timingSafeEqual(esperada, recibida);
}

/**
 * Una llamada GET firmada a la API. Devuelve el JSON de Zadarma o lanza un
 * error con su mensaje. Con 10 s de tope: si Zadarma no contesta, la gestora
 * tiene que saberlo, no quedarse mirando un botón que da vueltas.
 */
export async function pedirAZadarma({ clave, secreto }, metodo, params = {}) {
  const todos = { ...params, format: 'json' };
  const { cadena, firma } = firmarPeticion(metodo, todos, secreto);
  const r = await fetch(`${urlDeZadarma(metodo)}?${cadena}`, {
    method: 'GET',
    headers: { Authorization: `${clave}:${firma}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  const datos = await r.json().catch(() => null);
  if (!r.ok || !datos || datos.status !== 'success') {
    const motivo = datos?.message || (r.status === 401 ? 'clave o secreto no válidos' : `HTTP ${r.status}`);
    const err = new Error(`Zadarma: ${motivo}`);
    err.status = r.status;
    throw err;
  }
  return datos;
}

/**
 * Click-to-call: Zadarma llama primero a la extensión de la gestora (`from`) y,
 * cuando descuelga, al prospecto (`to`). /v1/request/callback/
 */
export function pedirCallback(credenciales, { desde, hacia }) {
  return pedirAZadarma(credenciales, '/v1/request/callback/', { from: desde, to: hacia });
}

/** Lo más inocuo que hay para probar la clave: el saldo. /v1/info/balance/ */
export function saldo(credenciales) {
  return pedirAZadarma(credenciales, '/v1/info/balance/');
}
