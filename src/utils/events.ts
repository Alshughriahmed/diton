export type UIEvent = "ui:next"|"ui:prev"|"ui:toggleMic"|"ui:toggleCam"|"ui:switchCamera"|"ui:openSettings"|"ui:like"|"ui:report"|"ui:toggleBeauty"|"ui:updateBeauty"|"ui:changeMask"|"ui:likeUpdate";
type H=(p?:any)=>void; const ls=new Map<UIEvent,Set<H>>();
export const on=(e:UIEvent,f:H)=>{if(!ls.has(e))ls.set(e,new Set()); ls.get(e)!.add(f); return()=>ls.get(e)!.delete(f);};
export const emit=(e:UIEvent,p?:any)=>{ls.get(e)?.forEach(fn=>fn(p));};