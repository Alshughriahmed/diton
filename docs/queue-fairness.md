# Queue Fairness & Ghost Cleanup (Scaffold)
- ZSET rtc:wait بالـscore = timeMs − VIP_BOOST (للـVIP).
- META لكل عنصر في key: rtc:meta:<id>.
- lockPair(pairId) يمنع ازدواج الشريك (SETNX مع EX).
- ghostCleanup() يزيل الانتظارات الأقدم من 30s.
- جميعها سقالة تحت FLAGS (لا سلوك جديد حتى ربط الـAPI).
