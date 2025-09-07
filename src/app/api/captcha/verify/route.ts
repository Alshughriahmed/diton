import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    
    if (!token) {
      return NextResponse.json({ 
        ok: false, 
        error: "Captcha token required" 
      }, { status: 400 });
    }

    // In development, accept dev-ok token
    if (process.env.NODE_ENV === "development" && token === "dev-ok") {
      return NextResponse.json({ 
        ok: true, 
        message: "Development captcha verified" 
      });
    }

    // TODO: Implement real hCaptcha verification when keys are available
    const hCaptchaSecret = process.env.HCAPTCHA_SECRET_KEY;
    if (!hCaptchaSecret) {
      // No captcha configured, allow in stub mode
      return NextResponse.json({ 
        ok: true, 
        message: "Captcha verification skipped (no keys configured)" 
      });
    }

    // Real hCaptcha verification
    try {
      const response = await fetch("https://hcaptcha.com/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: hCaptchaSecret,
          response: token
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        return NextResponse.json({ 
          ok: true, 
          message: "Captcha verified successfully" 
        });
      } else {
        return NextResponse.json({ 
          ok: false, 
          error: "Captcha verification failed" 
        }, { status: 400 });
      }
    } catch (error) {
      console.error("[CAPTCHA_VERIFY_ERROR]", error);
      return NextResponse.json({ 
        ok: false, 
        error: "Captcha verification service unavailable" 
      }, { status: 503 });
    }

  } catch (error) {
    console.error("[CAPTCHA_ENDPOINT_ERROR]", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}