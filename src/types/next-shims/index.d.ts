// Main 'next' package shim — covers Metadata, NextConfig, and other top-level types

export interface Viewport {
  width?: string | number;
  height?: string | number;
  initialScale?: number;
  minimumScale?: number;
  maximumScale?: number;
  userScalable?: boolean;
  viewportFit?: 'auto' | 'contain' | 'cover';
  themeColor?: string | { color: string; media?: string }[];
}

export interface Metadata {
  title?: string | { default?: string; template?: string; absolute?: string } | null;
  description?: string | null;
  keywords?: string | string[] | null;
  authors?: { name?: string; url?: string }[] | null;
  creator?: string | null;
  publisher?: string | null;
  generator?: string | null;
  applicationName?: string | null;
  referrer?: string | null;
  robots?: string | { index?: boolean; follow?: boolean; googleBot?: string | { index?: boolean; follow?: boolean } } | null;
  alternates?: { canonical?: string; languages?: Record<string, string> } | null;
  icons?: string | { icon?: string | string[]; apple?: string | string[]; other?: { rel: string; url: string }[] } | null;
  openGraph?: {
    title?: string;
    description?: string;
    url?: string;
    siteName?: string;
    images?: string | string[] | { url: string; width?: number; height?: number; alt?: string }[];
    type?: string;
    locale?: string;
  } | null;
  twitter?: {
    card?: string;
    title?: string;
    description?: string;
    images?: string | string[];
    creator?: string;
    site?: string;
  } | null;
  viewport?: string | Viewport | null;
  themeColor?: string | { color: string; media?: string }[] | null;
  colorScheme?: string | null;
  manifest?: string | null;
  other?: Record<string, string | number | (string | number)[]> | null;
  [key: string]: unknown;
}

export interface NextConfig {
  reactStrictMode?: boolean;
  swcMinify?: boolean;
  output?: 'standalone' | 'export' | 'server';
  distDir?: string;
  basePath?: string;
  trailingSlash?: boolean;
  images?: {
    domains?: string[];
    remotePatterns?: { protocol?: string; hostname: string; port?: string; pathname?: string }[];
    formats?: ('image/avif' | 'image/webp')[];
    dangerouslyAllowSVG?: boolean;
    unoptimized?: boolean;
    deviceSizes?: number[];
    imageSizes?: number[];
  };
  env?: Record<string, string>;
  headers?: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]>;
  redirects?: () => Promise<{ source: string; destination: string; permanent: boolean }[]>;
  rewrites?: () => Promise<{ source: string; destination: string }[] | { beforeFiles?: unknown[]; afterFiles?: unknown[]; fallback?: unknown[] }>;
  webpack?: (config: Record<string, unknown>, context: Record<string, unknown>) => Record<string, unknown>;
  experimental?: Record<string, unknown>;
  serverExternalPackages?: string[];
  transpilePackages?: string[];
  [key: string]: unknown;
}

export function unstable_noStore(): void;
export function unstable_cache<T extends (...args: unknown[]) => unknown>(fn: T, keyParts?: string[], options?: { revalidate?: number | false; tags?: string[] }): T;

export type ResolvingMetadata = Promise<Metadata>;
export type ResolvedMetadata = Metadata;
