import type { ReactNode } from 'react';

export interface MetricLabelProps {
  children: ReactNode;
  hint?: string;
  term?: string;
  className?: string;
  iconSize?: number;
}

declare function MetricLabel(props: MetricLabelProps): JSX.Element;
export default MetricLabel;
