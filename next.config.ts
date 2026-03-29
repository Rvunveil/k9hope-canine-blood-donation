
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
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://ucarecdn.com https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://ucarecdn.com https://firebasestorage.googleapis.com https://*.googleusercontent.com",
              "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firestore.googleapis.com https://ucarecdn.com https://upload.uploadcare.com",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
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
