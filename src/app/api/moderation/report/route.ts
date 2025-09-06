import { NextRequest, NextResponse } from "next/server";
import { allow, ipFrom } from "@/lib/ratelimit";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export async function POST(req: NextRequest) {
  try {
    // Simple CSRF protection - require custom header in production
    const isDev = process.env.NODE_ENV === "development";
    if (!isDev && !req.headers.get("x-csrf-token")) {
      return NextResponse.json({ error: "CSRF token required" }, { status: 403 });
    }

    // Rate limiting - max 5 reports per 5 minutes per IP
    const clientIP = ipFrom(req);
    const rateLimitResult = allow(`report:${clientIP}`, 5, 5 * 60 * 1000);
    
    if (!rateLimitResult.ok) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    // Parse request body
    const body = await req.json();
    const { reason, peerId, ts, extra } = body;

    if (!reason || !peerId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create report record
    const report = {
      timestamp: new Date().toISOString(),
      ip: clientIP,
      reason,
      peerId,
      ts: ts || Date.now(),
      extra: extra || {},
      userAgent: req.headers.get("user-agent") || "unknown"
    };

    // In development: write to local NDJSON file
    if (isDev) {
      const reportsDir = join(process.cwd(), "_ops", "reports");
      const reportsFile = join(reportsDir, "reports.ndjson");
      
      // Ensure directory exists
      if (!existsSync(reportsDir)) {
        mkdirSync(reportsDir, { recursive: true });
      }
      
      // Append to NDJSON file
      const reportLine = JSON.stringify(report) + "\n";
      writeFileSync(reportsFile, reportLine, { flag: "a" });
      
      // Console log for development
      console.log("[MODERATION_REPORT]", report);
    }

    // TODO: In production, send to proper storage/email/moderation system

    return NextResponse.json({ 
      ok: true, 
      reportId: `rpt_${Date.now()}`,
      message: "Report submitted successfully"
    });
    
  } catch (error) {
    console.error("[REPORT_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}