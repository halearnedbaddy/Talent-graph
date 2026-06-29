import type { ComponentType, ReactElement } from 'react';
interface DynamicOptions<P = Record<string, unknown>> {
  loading?: ComponentType | (() => ReactElement | null);
  ssr?: boolean;
  suspense?: boolean;
}
declare function dynamic<P = Record<string, unknown>>(
  dynamicOptions: (() => Promise<ComponentType<P> | { default: ComponentType<P> }>),
  options?: DynamicOptions<P>
): ComponentType<P>;
export default dynamic;
