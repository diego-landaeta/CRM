import js from '@eslint/js';
import globals from 'globals';

// La configuracion de ESLint del backend.
//
// No existia. `npm run lint` ejecuta `eslint src/` desde que se anadio el paso a
// CI, y ESLint 9 exige `eslint.config.js` — sin el aborta con codigo 2 antes de
// mirar una sola linea. O sea que el paso de lint del backend **nunca ha
// pasado**: la CI de cada PR sale en rojo por esto y no por el codigo.
//
// El frontal si tiene la suya, y por eso su trabajo si se revisa.
//
// Lo que se enciende aqui es deliberadamente corto. No es el sitio para imponer
// un estilo nuevo sobre un backend que ya existe —eso serian cientos de avisos
// que nadie va a leer— sino para cazar lo que rompe en ejecucion.
export default [
  {
    ignores: ['node_modules/**', 'coverage/**', 'migrations/**', 'seeds/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // La que justifica todo lo demas.
      //
      // Es JavaScript sin tipos: una variable mal escrita o un import que falta
      // no lo caza nadie mas. En el frontal, un `moduloApagado(...)` sin su
      // import paso lint, typecheck y build, y tumbo el CRM entero al abrirlo.
      // Aqui el equivalente es un endpoint que revienta con 500 en produccion.
      'no-undef': 'error',

      // Aviso y no error: hay parametros que estan por la firma —`next` en los
      // manejadores de Express— y quitarlos cambiaria la aridad. Los que
      // empiezan por guion bajo se ignoran, que es como se dice «ya lo se».
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],

      // Un `catch {}` vacio es una decision legitima y frecuente aqui: que no se
      // pueda apuntar algo accesorio no puede tumbar un webhook.
      'no-empty': ['warn', { allowEmptyCatch: true }],

      'no-prototype-builtins': 'warn',
      'no-useless-escape': 'warn',
      'no-irregular-whitespace': 'warn',
    },
  },
];
