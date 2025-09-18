export async function GET() {
  return new Response(JSON.stringify({ 
    status: "healthy", 
    timestamp: Date.now(),
    service: "DitonaChat" 
  }), { 
    status: 200, 
    headers: { "content-type": "application/json" } 
  });
}
export const runtime="nodejs";
export const dynamic="force-dynamic";
