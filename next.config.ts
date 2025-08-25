/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable optimizations for better performance
    optimizeCss: true,
  },
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
}

export default nextConfig
