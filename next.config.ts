import type {NextConfig} from 'next';
import path from 'path';

const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;

const allowedDevOrigins = [
  '*.replit.dev',
  '*.repl.co',
  '*.replit.app',
  '*.replit.com',
];

if (replitDevDomain) {
  allowedDevOrigins.push(replitDevDomain);
}

const isDev = process.env.NODE_ENV !== 'production';

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com https://*.googleapis.com https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https: http:",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebase.com https://*.firebasestorage.googleapis.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.google-analytics.com https://region1.google-analytics.com",
      "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['recharts'],
  allowedDevOrigins,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  turbopack: {
    root: path.resolve(__dirname),
    resolveAlias: {
      '@firebase/firestore': './node_modules/@firebase/firestore/dist/index.esm2017.js',
      '@firebase/auth': './node_modules/@firebase/auth/dist/esm2017/index.js',
      '@firebase/storage': './node_modules/@firebase/storage/dist/index.esm2017.js',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
