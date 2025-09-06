/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{
      source: "/chat",
      headers: [
        { key: "Permissions-Policy", value: "camera=(self), microphone=(self)" },
      ],
    }];
  },
};

export default nextConfig;