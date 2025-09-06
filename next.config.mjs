/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Permissions-Policy", value: "camera=(self), microphone=(self)" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer" }
      ],
    }];
  },
};

export default nextConfig;