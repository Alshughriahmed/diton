export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json({ ok:true, url: '/account/billing' }, { headers: { 'Cache-Control': 'no-store' }});
}
