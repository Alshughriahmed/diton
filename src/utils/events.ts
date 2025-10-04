type Handler = (data?: any)=>void;
const bus = new EventTarget();

export function on(type: string, handler: Handler){
  const h = ((e: Event)=>handler((e as CustomEvent).detail)) as EventListener;
  bus.addEventListener(type, h);
  return ()=> bus.removeEventListener(type, h);
}

export function emit(type: string, detail?: any){
  bus.dispatchEvent(new CustomEvent(type, { detail }));
}
