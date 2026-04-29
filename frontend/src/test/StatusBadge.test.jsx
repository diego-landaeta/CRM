import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge, { STATUS_KEYS, STATUS_LABELS, STATUS_STYLES } from '@/shared/components/ui/StatusBadge';

describe('StatusBadge', () => {
  it('renderiza el label correcto para cada status', () => {
    for (const key of STATUS_KEYS) {
      const { unmount } = render(<StatusBadge status={key} />);
      expect(screen.getByText(STATUS_LABELS[key])).toBeInTheDocument();
      unmount();
    }
  });

  it('aplica las clases de color del mapping STATUS_STYLES', () => {
    for (const key of STATUS_KEYS) {
      const { container, unmount } = render(<StatusBadge status={key} />);
      const span = container.querySelector('span');
      // Algunas clases del mapping deben aparecer en el className
      const expectedTokens = STATUS_STYLES[key].split(' ');
      for (const tok of expectedTokens) {
        expect(span.className).toContain(tok);
      }
      unmount();
    }
  });

  it('muestra un icono cuando showIcon=true', () => {
    const { container } = render(<StatusBadge status="convertido" showIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('no muestra icono por defecto', () => {
    const { container } = render(<StatusBadge status="convertido" />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renderiza el status crudo cuando es desconocido', () => {
    render(<StatusBadge status="status_inexistente" />);
    expect(screen.getByText('status_inexistente')).toBeInTheDocument();
  });
});
