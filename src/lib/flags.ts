export const FLAGS = {
  RTC_IDEM: process.env.RTC_IDEM === "1",        // server-side
  ICE_GRACE: process.env.ICE_GRACE === "1",
  UI_GLASS: process.env.NEXT_PUBLIC_UI_GLASS === "1", // client-side
  LIKE_API_FIRST: process.env.LIKE_API_FIRST === "1",
};
