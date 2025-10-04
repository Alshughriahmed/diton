export const FLAGS = {
  RTC_IDEM: process.env.RTC_IDEM === "1",
  ICE_GRACE: process.env.ICE_GRACE === "1",
  UI_GLASS: process.env.NEXT_PUBLIC_UI_GLASS === "1",
  LIKE_API_FIRST: process.env.LIKE_API_FIRST === "1",
  QUEUE_FAIR: process.env.QUEUE_FAIR === "1",
  QUEUE_GHOST_CLEAN: process.env.QUEUE_GHOST_CLEAN === "1",
};
