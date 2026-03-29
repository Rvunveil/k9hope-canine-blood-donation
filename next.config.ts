
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if there are ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ⚠️ Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  // ...other configurations
  images: {
    domains: ['i.postimg.cc', 'media-hosting.imagekit.io'],
    unoptimized: true
  },
  reactStrictMode: true,
  experimental: {
    // serverActions is enabled by default // Ensure APIs work properly in App Router
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: false, // false = 307 temporary redirect
      },
    ];
  },
  // Add webpack config to ignore missing modules
  webpack: (config, { isServer }) => {
    // Ignore missing modules during build
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Suppress module not found warnings
    config.ignoreWarnings = [
      { module: /landing-page/ },
      { message: /Can't resolve '@\/components\/landing-page/ },
    ];

    return config;
  },
};

export default nextConfig;
