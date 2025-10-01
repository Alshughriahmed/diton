#!/usr/bin/env node

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

console.log('🔍 Checking P4 headers (runtime, dynamic, revalidate)...\n');

function findApiRoutes(dir = 'src/app/api', routes = []) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        findApiRoutes(fullPath, routes);
      } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
        routes.push(fullPath);
      }
    }
  } catch (err) {
    // Skip directories that don't exist
  }
  return routes;
}

function checkP4Headers(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  
  const hasRuntime = /export\s+const\s+runtime\s*=\s*["']nodejs["']/i.test(content);
  const hasDynamic = /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/i.test(content);
  const hasRevalidate = /export\s+const\s+revalidate\s*=\s*0/i.test(content);
  
  return { hasRuntime, hasDynamic, hasRevalidate };
}

const routes = findApiRoutes();
let allPassed = true;

for (const route of routes) {
  const { hasRuntime, hasDynamic, hasRevalidate } = checkP4Headers(route);
  
  if (!hasRuntime || !hasDynamic || !hasRevalidate) {
    console.log(`❌ ${route}`);
    if (!hasRuntime) console.log(`   Missing: export const runtime = "nodejs"`);
    if (!hasDynamic) console.log(`   Missing: export const dynamic = "force-dynamic"`);
    if (!hasRevalidate) console.log(`   Missing: export const revalidate = 0`);
    allPassed = false;
  } else {
    console.log(`✅ ${route}`);
  }
}

if (allPassed) {
  console.log('\n✅ All routes have correct P4 headers');
  process.exit(0);
} else {
  console.log('\n❌ Some routes are missing P4 headers');
  process.exit(1);
}
