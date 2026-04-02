import { describe, it, expect } from 'vitest';
import { cn } from '@/shared/lib/utils';

describe('cn()', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('handles conditional classes', () => {
    expect(cn('px-2', false && 'py-1')).toBe('px-2');
  });

  it('resolves tailwind conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('handles undefined/null', () => {
    expect(cn('px-2', undefined, null)).toBe('px-2');
  });

  it('handles empty string', () => {
    expect(cn('')).toBe('');
  });
});
