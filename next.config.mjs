/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  // عدم إضافة أي headers هنا لتجنب التعارض
};

export default nextConfig;