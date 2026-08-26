import { describe, it, expect, vi, beforeEach } from 'vitest';

// «No aparecen los números de los seguimientos de tiempo atrás a pesar de buscar
// con nombre y número. Una vez se envía el mensaje desde la app, aparece el
// chat.» — reportado por una gestora.
//
// No era la busqueda: era el tope. La lista traia las 50 mas recientes y el
// filtro se aplicaba en el NAVEGADOR sobre esas 50. Un seguimiento de hace
// semanas es la numero 80, asi que no estaba cargado. Al mandarle un mensaje su
// `ultimo_at` sube al presente, entra en las 50 y aparece.
//
// Comprobado ademas contra la base con 60 conversaciones de mentira: sin buscar
// salian 50 y la vieja no estaba; buscandola, sale.

const capturado = [];
vi.mock('../src/shared/config/db.js', () => ({
  query: vi.fn(async (sql, params) => { capturado.push({ sql, params }); return { rows: [] }; }),
}));

const { listar } = await import('../src/modules/whatsapp/chat.model.js');
const ultima = () => capturado[capturado.length - 1];

beforeEach(() => { capturado.length = 0; });

describe('sin buscar, como estaba', () => {
  it('trae las mas recientes y no filtra nada', async () => {
    await listar({ instancia: 'x' });
    expect(ultima().sql).not.toMatch(/ILIKE/);
    expect(ultima().sql).toMatch(/ORDER BY c\.ultimo_at DESC/);
  });

  it('el tope sigue existiendo, y con techo', async () => {
    // El tope no es el problema; el problema era filtrar DESPUES de aplicarlo.
    await listar({ instancia: 'x', limite: 99999 });
    expect(ultima().params).toContain(200);
  });
});

describe('buscando, filtra Postgres y no el navegador', () => {
  it('mira el nombre de WhatsApp y el del prospecto', async () => {
    await listar({ instancia: 'x', busca: 'carmen' });
    expect(ultima().sql).toMatch(/c\.nombre_push ILIKE/);
    expect(ultima().sql).toMatch(/l\.nombre\s+ILIKE/);
    expect(ultima().params).toContain('%carmen%');
  });

  it('y el correo, que es por donde se busca a alguien que no tiene nombre puesto', async () => {
    await listar({ instancia: 'x', busca: 'ana@' });
    expect(ultima().sql).toMatch(/l\.email\s+ILIKE/);
  });

  it('el telefono se compara solo con cifras', async () => {
    // Buscar «+34 612 34 56 78» contra un «34612345678» guardado no casaba por
    // el mas y los espacios. Mismo fallo que los duplicados por telefono de #65.
    await listar({ instancia: 'x', busca: '+34 612 34 56 78' });
    expect(ultima().sql).toMatch(/regexp_replace\(COALESCE\(c\.telefono/);
    expect(ultima().params).toContain('%34612345678%');
  });

  it('busca tambien por el telefono del prospecto, no solo por el del chat', async () => {
    // Pueden no coincidir: el chat guarda el JID y la ficha lo que escribio quien
    // creo el prospecto.
    await listar({ instancia: 'x', busca: '612345678' });
    expect(ultima().sql).toMatch(/regexp_replace\(COALESCE\(l\.telefono/);
  });
});

describe('la trampa de las cifras vacias', () => {
  it('buscar una palabra NO mete un LIKE de telefono', async () => {
    // «psiko» sin cifras daria LIKE '%%', que casa con TODAS. Una busqueda que
    // devuelve la lista entera parece que funciona y es justo lo contrario.
    await listar({ instancia: 'x', busca: 'psiko' });
    expect(ultima().sql).not.toMatch(/regexp_replace/);
    expect(ultima().params).not.toContain('%%');
  });

  it('ni con simbolos sueltos', async () => {
    await listar({ instancia: 'x', busca: '+++' });
    expect(ultima().params).not.toContain('%%');
  });

  it('una busqueda en blanco se trata como no buscar', async () => {
    await listar({ instancia: 'x', busca: '   ' });
    expect(ultima().sql).not.toMatch(/ILIKE/);
  });

  it('y null tambien', async () => {
    await listar({ instancia: 'x', busca: null });
    expect(ultima().sql).not.toMatch(/ILIKE/);
  });
});

describe('sin romper lo que ya hacia', () => {
  it('el filtro por proyecto convive con la busqueda', async () => {
    await listar({ instancia: 'x', projectId: 7, busca: 'carmen' });
    expect(ultima().sql).toMatch(/c\.project_id = \$2/);
    expect(ultima().sql).toMatch(/ILIKE/);
    expect(ultima().params[0]).toBe('x');
    expect(ultima().params[1]).toBe(7);
  });

  it('los grupos entran en la busqueda como todo lo demas', async () => {
    // El grupo de Psiko no salia por lo mismo: llevaba tiempo callado y caia
    // fuera de las 50. No habia ningun filtro que los quitara.
    await listar({ instancia: 'x', busca: 'psiko' });
    expect(ultima().sql).not.toMatch(/NOT.*@g\.us/);
    expect(ultima().sql).toMatch(/es_grupo/);
  });

  it('todo va parametrizado: nada de pegar el texto en el SQL', async () => {
    await listar({ instancia: 'x', busca: "'; DROP TABLE wa_conversaciones; --" });
    expect(ultima().sql).not.toMatch(/DROP TABLE/);
    expect(ultima().params.some((p) => String(p).includes('DROP TABLE'))).toBe(true);
  });
});
