// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import Toaster from '@/shared/components/layout/Toaster';
import { toast } from '@/shared/hooks/useToast';

/*
  CRM#1230 (gemela CRM-ISEIE#858) · Un aviso de advertencia no se pinta como un
  éxito. «Comisión ya pagada… Regularízala a mano» (y los avisos de «Llevar a
  Moodle») pedían `variant: 'warning'`, pero el Toaster solo conocía
  'destructive' y todo lo demás salía con el check verde.
*/

const cajaDe = (titulo) => screen.getByText(titulo).closest('div.pointer-events-auto');

describe('Toaster · las tres maneras de avisar', () => {
  afterEach(() => cleanup());

  it('una advertencia sale con su color y su icono, no con los del éxito', () => {
    render(<Toaster />);
    act(() => { toast({ title: 'Comisión ya pagada', description: 'Regularízala a mano.', variant: 'warning' }); });
    const caja = cajaDe('Comisión ya pagada');
    expect(caja.className).toContain('bg-warning-soft');
    expect(caja.className).not.toContain('bg-card');
    expect(caja.querySelector('.text-success')).toBeNull();
    expect(caja.querySelector('.text-warning')).not.toBeNull();
  });

  it('un éxito sigue saliendo como siempre', () => {
    render(<Toaster />);
    act(() => { toast({ title: 'Pago eliminado' }); });
    const caja = cajaDe('Pago eliminado');
    expect(caja.className).toContain('bg-card');
    expect(caja.querySelector('.text-success')).not.toBeNull();
  });
});
