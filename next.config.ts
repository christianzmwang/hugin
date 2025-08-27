/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize for production
  compress: true,
  poweredByHeader: false,
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
  webpack(config: any) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    return config;
  },
}

export default nextConfig
