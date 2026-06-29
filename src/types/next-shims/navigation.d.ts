export interface NavigateOptions { scroll?: boolean; }
export interface AppRouterInstance {
  back(): void;
  forward(): void;
  refresh(): void;
  push(href: string, options?: NavigateOptions): void;
  replace(href: string, options?: NavigateOptions): void;
  prefetch(href: string): void;
}
export type ReadonlyURLSearchParams = Omit<URLSearchParams, 'append' | 'delete' | 'set' | 'sort'>;
export function useRouter(): AppRouterInstance;
export function usePathname(): string;
export function useSearchParams(): ReadonlyURLSearchParams;
export function useParams<T extends Record<string, string | string[]> = Record<string, string>>(): T;
export function redirect(url: string, type?: 'replace' | 'push'): never;
export function permanentRedirect(url: string): never;
export function notFound(): never;
