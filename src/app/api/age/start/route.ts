export const revalidate = 0;
import { NextResponse } from "next/server";
import { withReqId } from "@/lib/http/withReqId";

export async function GET() {
  const ageProvider = process.env.AGE_PROVIDER || "stub";
  
  if (ageProvider === "stub") {
    // Return simple HTML with "I'm 18+" button
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Age Verification - DitonaChat</title>
        <style>
          body { font-family: system-ui; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .container { text-align: center; max-width: 400px; padding: 2rem; }
          button { background: #3b82f6; color: white; border: none; padding: 1rem 2rem; border-radius: 0.5rem; font-size: 1.1rem; cursor: pointer; margin: 1rem; }
          button:hover { background: #2563eb; }
          .warning { color: #fbbf24; margin: 1rem 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Age Verification Required</h1>
          <p class="warning">⚠️ This site contains adult content</p>
          <p>You must be 18 years or older to proceed.</p>
          <button onclick="verifyAge()">I'm 18+ Years Old</button>
          <button onclick="window.location.href='https://google.com'" style="background:#6b7280;">Exit</button>
          <script>
            async function verifyAge() {
              try {
                const response = await fetch('/api/age/webhook', { method: 'POST' });
                if (response.ok) {
                  window.location.href = '/chat';
                } else {
                  alert('Verification failed. Please try again.');
                }
              } catch (error) {
                alert('Network error. Please check your connection.');
              }
            }
          </script>
        </div>
      </body>
      </html>
    `;
    return withReqId(new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' }
    }));
  }
  
  // For real providers (veriff, yoti), would redirect to external verification
  return withReqId(NextResponse.json({
    ok: false,
    error: "Provider not configured"
  }, { status: 501 }));
}
export const runtime="nodejs";
export const dynamic="force-dynamic";
