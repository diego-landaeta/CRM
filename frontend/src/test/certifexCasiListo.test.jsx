import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AvisoCasiListo, FIRMA_EN_DIPLOMA } from '@/modules/certifex/components/piezas';

// El aviso de arriba de las dos pantallas que emiten. Diego, 20/10/2026: «las firmas no van
// en los diplomas, solo el DNI» y el DNI «es obligatorio». Vuelve a ser el de antes de la firma
// (la de la institución impresa; sobre «El interesado», solo el nombre), y dice que el DNI es
// obligatorio y dónde se pone.
describe('aviso de lo que lleva el diploma en Certifex', () => {
  it('la firma del alumno va (otra vez desde el 05/11/2026)', () => {
    expect(FIRMA_EN_DIPLOMA).toBe(true);
  });

  it('dice que el DNI es obligatorio y dónde se pone, y de dónde sale la firma del alumno', () => {
    render(<AvisoCasiListo />);
    const aviso = screen.getByRole('note');
    expect(aviso.textContent).toContain('El DNI del alumno es obligatorio en el diploma');
    expect(aviso.textContent).toContain('sin él no se aprueba ni se emite');
    expect(aviso.textContent).toContain('«Sin DNI · Poner»');
    expect(aviso.textContent).toContain('se sube en «Revisar datos antes de aprobar»');
    expect(aviso.textContent).toContain('se imprime sobre su línea («El interesado» o «Alumno»)');
    expect(aviso.textContent).not.toContain('sobre «El interesado» sale solo su nombre');
  });
});
