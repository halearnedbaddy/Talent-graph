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

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: ['recharts'],
  allowedDevOrigins,
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
