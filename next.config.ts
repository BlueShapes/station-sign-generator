import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  i18n: {
    locales: ['en', 'ja'],
    defaultLocale: 'en',
  },
  distDir: "build",
};

export default nextConfig;