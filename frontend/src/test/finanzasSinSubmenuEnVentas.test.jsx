import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import FinanzasLayout from '@/modules/accounting/pages/FinanzasLayout';

/*
  #79 punto 3: «el SubNav que le sale encima del contenido [de Ventas] hay que
  quitarlo de ahí y buscarle otro sitio». En Ventas ya no sale —lo que ofrecía
  está en el menú lateral—; en el resto de Finanzas se queda como estaba.
*/
function abrir(ruta) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/finanzas" element={<FinanzasLayout />}>
          <Route path="*" element={<p>contenido</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('el submenú de Finanzas', () => {
  it('no sale encima de Ventas', () => {
    abrir('/finanzas/ventas');
    expect(screen.getByText('contenido')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Análisis de ventas/ })).toBeNull();
  });

  it('sigue en las demás pantallas de Finanzas', () => {
    abrir('/finanzas/ingresos');
    expect(screen.getByRole('link', { name: /Análisis de ventas/ })).toBeInTheDocument();
  });
});
