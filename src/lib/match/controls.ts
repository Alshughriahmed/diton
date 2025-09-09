import { toast } from '@/lib/ui/toast';

export async function nextMatch(payload:any={}){
  try{
    await fetch('/api/match/next',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    toast('⏭️ Next…');
  }catch{ toast('تعذّر طلب Next'); }
}

export async function tryPrevOrRandom(payload:any={}){
  // نُطلق حدث داخلي لمن لديه منطق prev، وإن لم يتم خلال 7s نعمل Next
  const evt = new CustomEvent('ditona:prev-wanted');
  window.dispatchEvent(evt);
  toast('⏮️ محاولة الرجوع لآخر متصل…');
  let resolved=false;
  const ok=()=>{resolved=true; toast('تم الرجوع لآخر متصل');};
  window.addEventListener('ditona:prev-ok', ok, {once:true});
  await new Promise(r=>setTimeout(r,7000));
  window.removeEventListener('ditona:prev-ok', ok as any);
  if(!resolved){
    toast('لم نتمكن من استعادة المتصل السابق — جاري مطابقة عشوائية لطيفة');
    await nextMatch(payload);
  }
}