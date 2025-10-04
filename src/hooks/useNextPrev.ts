export function useNextPrev(){
  function tryPrevOrRandom(){
    // افتراضيًا نعيد تشغيل البحث
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ui:next"));
    }
  }
  return { tryPrevOrRandom };
}
export default useNextPrev;
