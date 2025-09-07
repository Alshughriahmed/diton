/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server mode for full Next.js features
  poweredByHeader: false,
  reactStrictMode: false,
  // Updated config for Next.js 15
  serverExternalPackages: ["jose"],
  async headers() {
    return [
      {
        source: "/chat/:path*",
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