/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        // Security headers for chat page (after age verification)
        source: "/chat",
        headers: [
          { 
            key: "Permissions-Policy", 
            value: "camera=(self), microphone=(self)" 
          },
          { 
            key: "Content-Security-Policy", 
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires these
              "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
              "img-src 'self' data: blob:",
              "media-src 'self' blob:",
              "connect-src 'self' wss: stun: turn: turns: https://js.stripe.com https://api.stripe.com https://hcaptcha.com", // WebRTC signaling + Stripe + hCaptcha
              "frame-src 'self' https://js.stripe.com https://hcaptcha.com",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'"
            ].join("; ")
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" }
        ]
      },
      {
        // General security headers for other pages
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "no-referrer" }
        ]
      }
    ];
  },
};

/* __HSTS_INJECT__ */
{
  const _old = nextConfig.headers;
  nextConfig.headers = async () => {
    const arr = _old ? await _old() : [];
    arr.push({
      source: "/(.*)",
      headers: [
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }
      ],
    });
    return arr;
  };
}

export default nextConfig;