/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Do not fail the production build due to ESLint errors. Use `pnpm lint` in CI/local instead.
    ignoreDuringBuilds: true,
  },
  // Optimize for production
  compress: true,
  poweredByHeader: false,
  // Hide the Next.js dev/build indicator badge (Next.js 15+)
  devIndicators: false,
  // Allow external images if needed
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Configure webpack to handle SVG imports as React components
  webpack(config: any, { dev }: { dev: boolean }) {
    // Disable filesystem cache in development to avoid noisy ENOENT pack.gz warnings
    if (dev) {
      config.cache = false
    }

    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    return config;
  },
}

export default nextConfig
