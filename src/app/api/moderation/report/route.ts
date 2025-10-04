export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import { withReqId } from "@/lib/http/withReqId";
import { allow, ipFrom } from "@/lib/ratelimit";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export async function POST(req: NextRequest) {
  try {
    // Simple CSRF protection - require custom header in production
    const isDev = process.env.NODE_ENV === "development";
    if (!isDev && !req.headers.get("x-csrf-token")) {
      return withReqId(NextResponse.json({ error: "CSRF token required" }, { status: 403 }));
    }

    // Rate limiting - 10 reports per minute per IP (as specified)
    const clientIP = ipFrom(req);
    const rateLimitResult = allow(`report:${clientIP}`, 10, 60 * 1000);
    
    if (!rateLimitResult.ok) {
      return withReqId(NextResponse.json({ error: "Rate limited" }, { status: 429 }));
    }

    // Parse request body
    const body = await req.json();
    const { reason, peerId, ts } = body;

    if (!reason || !peerId) {
      return withReqId(NextResponse.json({ error: "Missing required fields" }, { status: 400 }));
    }

    // Create report record
    const report = {
      timestamp: new Date().toISOString(),
      ip: clientIP,
      reason,
      peerId,
      ts: ts || Date.now()
    };

    // Write to logs (local file or Vercel Blob if available)
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      // TODO: Use Vercel Blob when available
      console.log("[REPORT_BLOB_TODO]", report);
    } else {
      // Write to local NDJSON file
      const logDir = join(process.cwd(), "_ops", "logs", "reports");
      const logFile = join(logDir, `${today}.jsonl`);
      
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
      
      const reportLine = JSON.stringify(report) + "\n";
      writeFileSync(logFile, reportLine, { flag: "a" });
    }

    console.log("[MODERATION_REPORT]", report);

    return withReqId(NextResponse.json({ 
      ok: true, 
      reportId: `rpt_${Date.now()}`,
      message: "Report submitted successfully"
    }));
    
  } catch (error) {
    console.error("[REPORT_ERROR]", error);
    return withReqId(NextResponse.json({ error: "Internal server error" }, { status: 500 }));
  }
}
export const runtime="nodejs";
export const dynamic="force-dynamic";
