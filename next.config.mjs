/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for Replit compatibility  
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Keep existing config
  poweredByHeader: false,
  reactStrictMode: false,
  swcMinify: true,
  experimental: {
    serverComponentsExternalPackages: ["jose"]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate, max-age=0"
          },
          {
            key: "Permissions-Policy", 
            value: "camera=(self), microphone=(self)"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
