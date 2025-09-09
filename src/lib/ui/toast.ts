export function toast(msg:string, ms=2500){
  const el=document.createElement('div');
  el.textContent=msg;
  el.style.cssText='position:fixed;left:12px;bottom:12px;z-index:9999;background:#111a;border:1px solid #333;padding:8px 12px;border-radius:10px;color:#fff;font:500 13px system-ui;backdrop-filter:blur(6px)';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),ms);
}