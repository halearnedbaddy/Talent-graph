import type React from 'react';

// ── next/link ─────────────────────────────────────────────────────────────────
declare module 'next/link' {
  interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string | { pathname?: string; query?: Record<string, string | number | boolean>; hash?: string };
    as?: string;
    replace?: boolean;
    scroll?: boolean;
    shallow?: boolean;
    prefetch?: boolean | null;
    locale?: string | false;
    passHref?: boolean;
    legacyBehavior?: boolean;
    children?: React.ReactNode;
  }
  const Link: React.ForwardRefExoticComponent<LinkProps & React.RefAttributes<HTMLAnchorElement>>;
  export default Link;
}

// ── next/image ────────────────────────────────────────────────────────────────
declare module 'next/image' {
  interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string | { src: string; height: number; width: number; blurDataURL?: string };
    alt: string;
    width?: number;
    height?: number;
    fill?: boolean;
    loader?: (resolverProps: { src: string; width: number; quality?: number }) => string;
    quality?: number;
    priority?: boolean;
    loading?: 'eager' | 'lazy';
    placeholder?: 'blur' | 'empty';
    blurDataURL?: string;
    unoptimized?: boolean;
    onLoadingComplete?: (img: HTMLImageElement) => void;
    sizes?: string;
    style?: React.CSSProperties;
    className?: string;
    onLoad?: React.ReactEventHandler<HTMLImageElement>;
    onError?: React.ReactEventHandler<HTMLImageElement>;
  }
  const Image: React.ForwardRefExoticComponent<ImageProps & React.RefAttributes<HTMLImageElement>>;
  export default Image;
}

// ── next/navigation ───────────────────────────────────────────────────────────
declare module 'next/navigation' {
  export interface NavigateOptions {
    scroll?: boolean;
  }
  export interface AppRouterInstance {
    back(): void;
    forward(): void;
    refresh(): void;
    push(href: string, options?: NavigateOptions): void;
    replace(href: string, options?: NavigateOptions): void;
    prefetch(href: string): void;
  }
  export function useRouter(): AppRouterInstance;
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams & {
    get(name: string): string | null;
    getAll(name: string): string[];
    has(name: string): boolean;
    forEach(callbackfn: (value: string, key: string) => void): void;
    entries(): IterableIterator<[string, string]>;
    keys(): IterableIterator<string>;
    values(): IterableIterator<string>;
    toString(): string;
    size: number;
  };
  export function useParams<T extends Record<string, string | string[]> = Record<string, string>>(): T;
  export function redirect(url: string, type?: 'replace' | 'push'): never;
  export function permanentRedirect(url: string): never;
  export function notFound(): never;
}

// ── next/server ───────────────────────────────────────────────────────────────
declare module 'next/server' {
  export class NextRequest extends Request {
    constructor(input: Request | string | URL, init?: RequestInit);
    readonly cookies: {
      get(name: string): { name: string; value: string } | undefined;
      getAll(): { name: string; value: string }[];
      set(name: string, value: string): void;
      delete(name: string): void;
      has(name: string): boolean;
    };
    readonly nextUrl: URL & {
      pathname: string;
      search: string;
      searchParams: URLSearchParams;
      basePath: string;
      buildId?: string;
      defaultLocale?: string;
      domainLocale?: { defaultLocale: string; domain: string; http?: boolean; locales?: string[] };
      locale?: string;
      url: string;
    };
    readonly ip?: string;
    readonly geo?: {
      city?: string;
      country?: string;
      region?: string;
      latitude?: string;
      longitude?: string;
    };
    readonly url: string;
    readonly page?: { name?: string; params?: Record<string, string | string[]> };
  }

  export class NextResponse<Body = unknown> extends Response {
    constructor(body?: BodyInit | null, init?: ResponseInit);
    readonly cookies: {
      get(name: string): { name: string; value: string } | undefined;
      getAll(): { name: string; value: string }[];
      set(name: string, value: string, options?: Record<string, unknown>): NextResponse<Body>;
      delete(name: string): NextResponse<Body>;
      has(name: string): boolean;
    };
    static json<JsonBody>(body: JsonBody, init?: ResponseInit): NextResponse<JsonBody>;
    static redirect(url: string | URL, init?: number | ResponseInit): NextResponse<unknown>;
    static rewrite(destination: string | URL, init?: ResponseInit): NextResponse<unknown>;
    static next(init?: ResponseInit): NextResponse<unknown>;
  }

  export type NextMiddleware = (
    request: NextRequest,
    event: { waitUntil(promise: Promise<unknown>): void }
  ) => Response | NextResponse | void | undefined | null | Promise<Response | NextResponse | void | undefined | null>;

  export type NextFetchEvent = {
    waitUntil(promise: Promise<unknown>): void;
    sourcePage: string;
  };
}

// ── next/script ───────────────────────────────────────────────────────────────
declare module 'next/script' {
  interface ScriptProps extends React.HTMLAttributes<HTMLScriptElement> {
    src?: string;
    strategy?: 'beforeInteractive' | 'afterInteractive' | 'lazyOnload' | 'worker';
    onLoad?: () => void;
    onReady?: () => void;
    onError?: () => void;
    id?: string;
    children?: React.ReactNode;
    dangerouslySetInnerHTML?: { __html: string };
    nonce?: string;
  }
  const Script: React.FC<ScriptProps>;
  export default Script;
}

// ── next/dynamic ──────────────────────────────────────────────────────────────
declare module 'next/dynamic' {
  import type { ComponentType, ReactElement } from 'react';

  interface DynamicOptions<P = {}> {
    loading?: ComponentType | (() => ReactElement | null);
    ssr?: boolean;
    suspense?: boolean;
  }

  function dynamic<P = {}>(
    dynamicOptions: (() => Promise<ComponentType<P> | { default: ComponentType<P> }>) | DynamicOptions<P>,
    options?: DynamicOptions<P>
  ): ComponentType<P>;

  export default dynamic;
}

// ── next/font/google ──────────────────────────────────────────────────────────
declare module 'next/font/google' {
  interface FontOptions {
    weight?: string | string[];
    style?: string | string[];
    subsets?: string[];
    display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
    variable?: string;
    preload?: boolean;
    fallback?: string[];
    adjustFontFallback?: boolean | string;
  }

  interface NextFont {
    className: string;
    style: { fontFamily: string; fontWeight?: number; fontStyle?: string };
    variable: string;
  }

  export function Inter(options: FontOptions): NextFont;
  export function Roboto(options: FontOptions): NextFont;
  export function Open_Sans(options: FontOptions): NextFont;
  export function Lato(options: FontOptions): NextFont;
  export function Montserrat(options: FontOptions): NextFont;
  export function Poppins(options: FontOptions): NextFont;
  export function Raleway(options: FontOptions): NextFont;
  export function Source_Sans_3(options: FontOptions): NextFont;
  export function Nunito(options: FontOptions): NextFont;
  export function Playfair_Display(options: FontOptions): NextFont;
  export function Merriweather(options: FontOptions): NextFont;
  export function DM_Sans(options: FontOptions): NextFont;
  export function Plus_Jakarta_Sans(options: FontOptions): NextFont;
  export function Space_Grotesk(options: FontOptions): NextFont;
  export function Geist(options: FontOptions): NextFont;
  export function Geist_Mono(options: FontOptions): NextFont;
}
