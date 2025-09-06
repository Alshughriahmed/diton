"use client";
type S={stream:MediaStream|null; micOn:boolean; camOn:boolean; facing:"user"|"environment"};
const st:S={stream:null,micOn:true,camOn:true,facing:"user"};
export async function initLocalMedia(){ if(st.stream) return st.stream;
  const s=await navigator.mediaDevices.getUserMedia({audio:true,video:{facingMode:st.facing}});
  st.stream=s; return s; }
export function getLocalStream(){ return st.stream; }
export function toggleMic(){ const s=st.stream; if(!s) return false; st.micOn=!st.micOn; s.getAudioTracks().forEach(t=>t.enabled=st.micOn); return st.micOn; }
export function toggleCam(){ const s=st.stream; if(!s) return false; st.camOn=!st.camOn; s.getVideoTracks().forEach(t=>t.enabled=st.camOn); return st.camOn; }
export async function switchCamera(){ st.facing=st.facing==="user"?"environment":"user";
  const ns=await navigator.mediaDevices.getUserMedia({audio:true,video:{facingMode:st.facing}}); st.stream?.getTracks().forEach(t=>t.stop()); st.stream=ns; return ns; }