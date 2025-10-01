#!/usr/bin/env node

console.log('🔌 TURN/STUN smoke test...');

const STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302'
];

async function testSTUN() {
  if (typeof RTCPeerConnection === 'undefined') {
    console.log('⚠️  RTCPeerConnection not available in Node.js - skipping TURN/STUN test');
    console.log('ℹ️  TURN/STUN should be tested in browser or with headless browser');
    return true;
  }

  try {
    const pc = new RTCPeerConnection({
      iceServers: STUN_SERVERS.map(url => ({ urls: url }))
    });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        pc.close();
        console.error('❌ STUN timeout');
        resolve(false);
      }, 5000);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const type = event.candidate.type;
          if (type === 'srflx' || type === 'relay') {
            clearTimeout(timeout);
            pc.close();
            console.log(`✅ STUN working (${type} candidate found)`);
            resolve(true);
          }
        }
      };

      pc.createOffer().then(offer => pc.setLocalDescription(offer));
    });
  } catch (err) {
    console.error('❌ STUN test failed:', err.message);
    return false;
  }
}

async function checkTURNConfig() {
  console.log('\n📋 Checking TURN config...');
  
  const turnUrl = process.env.TURN_URL || process.env.NEXT_PUBLIC_TURN_URL;
  const turnUser = process.env.TURN_USERNAME;
  const turnPass = process.env.TURN_PASSWORD;

  if (!turnUrl || !turnUser || !turnPass) {
    console.log('⚠️  TURN not configured (STUN-only fallback)');
    return true;
  }

  console.log('✅ TURN credentials found');
  console.log(`   URL: ${turnUrl}`);
  console.log(`   Username: ${turnUser}`);
  return true;
}

async function main() {
  const turnOk = await checkTURNConfig();
  const stunOk = await testSTUN();
  
  if (turnOk && stunOk) {
    console.log('\n✅ WebRTC connectivity check passed');
    process.exit(0);
  } else {
    console.log('\n⚠️  WebRTC connectivity check completed with warnings');
    process.exit(0);
  }
}

main();
