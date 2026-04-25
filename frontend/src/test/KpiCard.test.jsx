import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KpiCard from '@/shared/components/ui/KpiCard';
import { Users } from '@phosphor-icons/react';

describe('KpiCard', () => {
  it('renderiza label y value', () => {
    render(<KpiCard icon={Users} label="Total leads" value="42" />);
    expect(screen.getByText('Total leads')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renderiza badge cuando se proporciona', () => {
    render(<KpiCard icon={Users} label="X" value="1" badge="+5%" />);
    expect(screen.getByText('+5%')).toBeInTheDocument();
  });

  it('no renderiza badge si es "--"', () => {
    render(<KpiCard icon={Users} label="X" value="1" badge="--" />);
    expect(screen.queryByText('--')).toBeNull();
  });

  it('aplica iconBg custom', () => {
    const { container } = render(<KpiCard icon={Users} label="X" value="1" iconBg="bg-emerald-100 text-emerald-700" />);
    const iconWrapper = container.querySelector('.bg-emerald-100');
    expect(iconWrapper).toBeTruthy();
  });

  it('valor tiene tabular-nums (alinea numeros)', () => {
    const { container } = render(<KpiCard icon={Users} label="X" value="123" />);
    const value = container.querySelector('.tabular-nums');
    expect(value?.textContent).toBe('123');
  });
});
