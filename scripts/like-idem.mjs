#!/usr/bin/env node

import { readFileSync } from 'fs';

console.log('🔍 Checking like system idempotency...\n');

function checkLikeIdempotency() {
  try {
    const likeRoute = readFileSync('src/app/api/like/route.ts', 'utf-8');
    
    const checks = [
      {
        pattern: /await\s+(?:exists|get|sismember)\s*\([^)]*like[^)]*\)/i,
        name: 'Existence check before insert',
        found: false
      },
      {
        pattern: /(?:setNx|setnx|sadd|zadd)\s*\([^)]*like/i,
        name: 'Atomic set operation',
        found: false
      },
      {
        pattern: /if\s*\([^)]*(?:exists|already|duplicate)/i,
        name: 'Duplicate prevention logic',
        found: false
      }
    ];

    for (const check of checks) {
      if (check.pattern.test(likeRoute)) {
        check.found = true;
        console.log(`✅ ${check.name}`);
      } else {
        console.log(`❌ ${check.name}`);
      }
    }

    const allPassed = checks.every(c => c.found);
    
    if (allPassed) {
      console.log('\n✅ Like system appears to be idempotent');
      process.exit(0);
    } else {
      console.log('\n⚠️  Like system may have idempotency issues');
      process.exit(1);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('⚠️  Like route not found - skipping check');
      process.exit(0);
    }
    throw err;
  }
}

checkLikeIdempotency();
