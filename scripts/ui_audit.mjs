#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'https://www.ditonachat.com';
const ART = process.env.ART || '_ops/reports/ui_audit_default';

async function setAgeCookie(context) {
  await context.addCookies([
    {
      name: 'ageok',
      value: '1',
      domain: '.ditonachat.com',
      path: '/'
    }
  ]);
}

async function getDOMMap(page, scenario) {
  console.log(`📋 Capturing DOM map for ${scenario}...`);
  
  const domElements = [];
  
  // Toolbar buttons with aria-label
  const toolbarButtons = ['Video', 'Mic', 'Report', 'Settings', 'Prev', 'Next', 'Like'];
  for (const label of toolbarButtons) {
    try {
      const element = await page.locator(`[aria-label*="${label}"], [title*="${label}"], button:has-text("${label}")`).first();
      if (await element.isVisible().catch(() => false)) {
        const box = await element.boundingBox();
        const computedStyle = await element.evaluate(el => {
          const style = window.getComputedStyle(el);
          return {
            zIndex: style.zIndex,
            visibility: style.visibility,
            display: style.display
          };
        });
        const disabled = await element.isDisabled().catch(() => false);
        
        domElements.push({
          role: 'toolbar-button',
          label: label,
          selector: `[aria-label*="${label}"]`,
          box: box || {x: 0, y: 0, width: 0, height: 0},
          zIndex: computedStyle.zIndex,
          visibility: computedStyle.visibility,
          disabled: disabled
        });
      }
    } catch (e) {
      console.log(`⚠️  Could not find ${label} button`);
    }
  }
  
  // Filter buttons (Countries, Gender)
  const filterButtons = ['Countries', 'Gender'];
  for (const filter of filterButtons) {
    try {
      const element = await page.locator(`[title*="${filter}"], button:has-text("${filter}")`).first();
      if (await element.isVisible().catch(() => false)) {
        const box = await element.boundingBox();
        const computedStyle = await element.evaluate(el => {
          const style = window.getComputedStyle(el);
          return {
            zIndex: style.zIndex,
            visibility: style.visibility
          };
        });
        
        domElements.push({
          role: 'filter-button',
          label: filter,
          selector: `[title*="${filter}"]`,
          box: box || {x: 0, y: 0, width: 0, height: 0},
          zIndex: computedStyle.zIndex,
          visibility: computedStyle.visibility,
          disabled: false
        });
      }
    } catch (e) {
      console.log(`⚠️  Could not find ${filter} filter`);
    }
  }
  
  // Video elements
  const videos = await page.locator('video').all();
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    if (await video.isVisible().catch(() => false)) {
      const box = await video.boundingBox();
      const id = await video.getAttribute('id').catch(() => `video-${i}`);
      
      domElements.push({
        role: 'video',
        label: id || `video-${i}`,
        selector: id ? `#${id}` : `video:nth-child(${i+1})`,
        box: box || {x: 0, y: 0, width: 0, height: 0},
        zIndex: 'auto',
        visibility: 'visible',
        disabled: false
      });
    }
  }
  
  return domElements;
}

async function captureNetworkFlow(page, scenario) {
  console.log(`🌐 Capturing network flow for ${scenario}...`);
  
  const networkCalls = [];
  const startTime = Date.now();
  
  // Listen to network requests
  page.on('request', request => {
    if (request.url().includes('/api/rtc/')) {
      networkCalls.push({
        timestamp: Date.now() - startTime,
        method: request.method(),
        url: request.url(),
        postData: request.postData() ? request.postData().substring(0, 200) : null
      });
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/api/rtc/')) {
      const call = networkCalls.find(c => c.url === response.url() && !c.status);
      if (call) {
        call.status = response.status();
        call.response_time = Date.now() - startTime;
      }
    }
  });
  
  // Clear network monitoring
  await page.evaluate(() => {
    if (window.performance && window.performance.clearResourceTimings) {
      window.performance.clearResourceTimings();
    }
  });
  
  // Find and click Next button
  try {
    const nextButton = page.locator('[aria-label*="Next"], [title*="Next"], button:has-text("Next")').first();
    await nextButton.waitFor({ timeout: 5000 });
    await nextButton.click();
    console.log('✅ Clicked Next button');
    
    // Wait for network activity to complete (up to 20 seconds)
    await page.waitForTimeout(20000);
    
  } catch (error) {
    console.log('⚠️  Could not find or click Next button:', error.message);
  }
  
  return networkCalls;
}

async function captureStorage(page, scenario) {
  console.log(`💾 Capturing storage for ${scenario}...`);
  
  const storage = await page.evaluate(() => {
    const localStorage = {};
    const sessionStorage = {};
    
    // Get all localStorage items
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      localStorage[key] = window.localStorage.getItem(key);
    }
    
    // Get all sessionStorage items  
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      sessionStorage[key] = window.sessionStorage.getItem(key);
    }
    
    return { localStorage, sessionStorage };
  });
  
  return storage;
}

async function openAndTestModal(page, modalType) {
  console.log(`🔧 Testing ${modalType} modal...`);
  
  try {
    // Find and click the modal trigger
    const trigger = page.locator(`[title*="${modalType}"], button:has-text("${modalType}")`).first();
    await trigger.click();
    await page.waitForTimeout(1000);
    
    // Capture modal state
    const modalState = await page.evaluate((type) => {
      const modal = document.querySelector(`[role="dialog"], .modal, [class*="modal"]`);
      if (!modal) return { error: 'Modal not found' };
      
      const options = Array.from(modal.querySelectorAll('button, [role="option"]')).map(el => ({
        text: el.textContent?.trim(),
        disabled: el.disabled || el.getAttribute('disabled') !== null,
        selected: el.classList.contains('selected') || el.getAttribute('selected') !== null
      }));
      
      return { options, visible: modal.offsetParent !== null };
    }, modalType);
    
    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    return modalState;
  } catch (error) {
    console.log(`⚠️  Could not test ${modalType} modal:`, error.message);
    return { error: error.message };
  }
}

async function runAudit() {
  console.log('🚀 Starting UI Audit...');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  let chatPageHTML = null;
  
  // Test scenarios
  const scenarios = [
    { name: 'nonvip', endpoint: '/api/user/vip/dev/revoke' },
    { name: 'vip', endpoint: '/api/user/vip/dev/grant' }
  ];
  
  for (const scenario of scenarios) {
    console.log(`\n=== Testing ${scenario.name.toUpperCase()} scenario ===`);
    
    const context = await browser.newContext();
    await setAgeCookie(context);
    const page = await context.newPage();
    
    try {
      // Set VIP status
      await page.goto(`${BASE}${scenario.endpoint}`);
      console.log(`✅ Set ${scenario.name} status`);
      
      // Navigate to chat
      await page.goto(`${BASE}/chat`);
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Save HTML first time only
      if (!chatPageHTML) {
        chatPageHTML = await page.content();
        fs.writeFileSync(`${ART}/chat_page.html`, chatPageHTML);
        console.log('✅ Saved chat_page.html');
      }
      
      // Test modals
      const countryModal = await openAndTestModal(page, 'Countries');
      const genderModal = await openAndTestModal(page, 'Gender');
      
      // Capture DOM map
      const domMap = await getDOMMap(page, scenario.name);
      fs.writeFileSync(`${ART}/dom_${scenario.name}.json`, JSON.stringify(domMap, null, 2));
      
      // Capture network flow
      const networkFlow = await captureNetworkFlow(page, scenario.name);
      fs.writeFileSync(`${ART}/net_flow_${scenario.name}.json`, JSON.stringify(networkFlow, null, 2));
      
      // Capture storage
      const storage = await captureStorage(page, scenario.name);
      storage.modals = { country: countryModal, gender: genderModal };
      fs.writeFileSync(`${ART}/storage_${scenario.name}.json`, JSON.stringify(storage, null, 2));
      
      console.log(`✅ Completed ${scenario.name} scenario`);
      
    } catch (error) {
      console.error(`❌ Error in ${scenario.name} scenario:`, error);
    }
    
    await context.close();
  }
  
  await browser.close();
  console.log('🎉 UI Audit completed!');
}

// Run the audit
runAudit().catch(console.error);