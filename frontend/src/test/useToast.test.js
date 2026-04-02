import { describe, it, expect } from 'vitest';
import { toast } from '@/shared/hooks/useToast';

describe('toast()', () => {
  it('returns an id', () => {
    const id = toast({ title: 'Test' });
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });

  it('with title creates a toast', () => {
    const id = toast({ title: 'Exito', description: 'Operacion completada' });
    expect(id).toBeDefined();
    expect(typeof id).toBe('number');
  });

  it('with variant destructive works', () => {
    const id = toast({ title: 'Error', variant: 'destructive' });
    expect(id).toBeDefined();
    expect(typeof id).toBe('number');
  });
});
