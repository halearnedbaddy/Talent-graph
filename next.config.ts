import type {NextConfig} from 'next';

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
  turbopack: {},
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
