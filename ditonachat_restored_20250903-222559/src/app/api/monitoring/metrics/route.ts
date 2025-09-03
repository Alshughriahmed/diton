
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// متغيرات عامة لتتبع الحالة
let startTime = Date.now();
let requestCount = 0;
let errorCount = 0;
let activeConnections = 0;

// Extended metrics for ICE and error tracking (in-memory)
const extendedMetrics = {
  webrtc: {
    ice_failed: 0,
    ice_disconnected: 0,
    ice_connected: 0,
    ice_gathering_complete: 0,
    turn_used: 0,
    stun_used: 0,
    connection_attempts: 0,
    connection_successes: 0
  },
  errors: {
    auth_failures: 0,
    stripe_errors: 0,
    api_errors: 0,
    websocket_errors: 0
  }
};

// Helper function to increment counters (exported for use in other modules)
export function incrementMetric(category: 'webrtc' | 'errors', metric: string) {
  if (extendedMetrics[category] && typeof (extendedMetrics[category] as any)[metric] === 'number') {
    ((extendedMetrics[category] as any)[metric])++;
  }
}

export async function GET() {
  requestCount++;
  
  try {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;
    
    const metrics = {
      // Original metrics
      activeUsers: activeConnections,
      serverLoad: Math.round(Math.random() * 30 + 10), // محاكاة الحمولة
      responseTime: Math.round(Math.random() * 100 + 50),
      errorRate: requestCount > 0 ? Math.round((errorCount / requestCount) * 100) : 0,
      uptime: uptimeFormatted,
      
      // Extended ICE and error metrics
      webrtc_metrics: {
        ice_states: {
          failed: extendedMetrics.webrtc.ice_failed,
          disconnected: extendedMetrics.webrtc.ice_disconnected,
          connected: extendedMetrics.webrtc.ice_connected,
          gathering_complete: extendedMetrics.webrtc.ice_gathering_complete
        },
        server_usage: {
          turn_used: extendedMetrics.webrtc.turn_used,
          stun_used: extendedMetrics.webrtc.stun_used
        },
        connection_stats: {
          attempts: extendedMetrics.webrtc.connection_attempts,
          successes: extendedMetrics.webrtc.connection_successes,
          success_rate: extendedMetrics.webrtc.connection_attempts > 0 
            ? Math.round((extendedMetrics.webrtc.connection_successes / extendedMetrics.webrtc.connection_attempts) * 100)
            : 0
        }
      },
      
      // Error counters by category
      error_counters: {
        auth_failures: extendedMetrics.errors.auth_failures,
        stripe_errors: extendedMetrics.errors.stripe_errors,
        api_errors: extendedMetrics.errors.api_errors,
        websocket_errors: extendedMetrics.errors.websocket_errors,
        total_errors: Object.values(extendedMetrics.errors).reduce((sum, count) => sum + count, 0)
      },
      
      // System info
      system: {
        timestamp: new Date().toISOString(),
        memory_usage_mb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
        request_count: requestCount,
        error_count: errorCount
      }
    };

    return NextResponse.json(metrics);
  } catch (error) {
    errorCount++;
    extendedMetrics.errors.api_errors++;
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
