import { NextRequest, NextResponse } from "next/server";
import { signAgeJWT } from "@/lib/age-jwt";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

export async function POST(req: NextRequest) {
  const ageProvider = process.env.AGE_PROVIDER || "stub";
  
  if (ageProvider === "stub") {
    try {
      // Sign JWT for age verification
      const ageJWT = await signAgeJWT();
      
      // Log compliance (minimal data: timestamp, IP hash prefix, user agent)
      const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      const ipHash = createHash('sha256').update(clientIP).digest('hex');
      const ipPrefix = ipHash.substring(0, 8); // Only first 8 chars for privacy
      
      const logEntry = {
        ts: new Date().toISOString(),
        ip_hash_prefix: ipPrefix,
        ua: req.headers.get("user-agent") || "unknown"
      };
      
      // Write to compliance log
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const logDir = join(process.cwd(), "_ops", "logs", "age");
      const logFile = join(logDir, `${today}.jsonl`);
      
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
      
      writeFileSync(logFile, JSON.stringify(logEntry) + "\n", { flag: "a" });
      
      // Set JWT cookie
      const response = NextResponse.json({ ok: true });
      response.cookies.set({
        name: "age_jwt",
        value: ageJWT,
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365 // 1 year
      });
      
      return response;
    } catch (error) {
      console.error("[AGE_JWT_ERROR]", error);
      return NextResponse.json({ ok: false, error: "JWT signing failed" }, { status: 500 });
    }
  }
  
  // For real providers, would verify webhook signature and extract result
  return NextResponse.json({
    ok: false,
    error: "Provider not configured"
  }, { status: 501 });
}