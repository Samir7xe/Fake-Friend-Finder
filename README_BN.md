# Real Friend Finder — Full-stack starter

এই প্যাকেজে anime-inspired responsive frontend, Express backend, PostgreSQL schema, server-side Admin password check, shareable quizzes এবং score storage-এর ভিত্তি আছে।

## অনলাইনে চালাতে যা লাগবে
- Node.js 20+
- PostgreSQL database
- Node.js hosting provider
- hosting environment variables: `DATABASE_URL`, `SESSION_SECRET` (কমপক্ষে ৩২ অক্ষরের random secret), `ADMIN_PASSWORD_HASH`, `NODE_ENV=production`, `PGSSL=true` (provider চাইলে)

## সেটআপ
1. PostgreSQL database-এ `schema.sql` একবার চালান।
2. `npm install` চালান।
3. `.env.example`-এর মানগুলো hosting dashboard-এ যোগ করুন; `.env` public করবেন না।
4. bcrypt hash তৈরি করতে Node.js-এ চালান: `node -e "console.log(require('bcryptjs').hashSync('YOUR_LONG_UNIQUE_PASSWORD',12))"` — নিজের password বসিয়ে output-টি `ADMIN_PASSWORD_HASH`-এ দিন।
5. `npm start` দিয়ে চালান। Hosting-এ repository upload করে deploy করুন।
6. Admin panel: `/creator-room-7f3c` — publish করার আগে server.js ও app.js-এ এই route বদলে দিন। পাসওয়ার্ড server-এ যাচাই হয়; route গোপন রাখা একা security নয়।

## ব্যবহার
- Homepage থেকে ২০–৩০টি প্রশ্ন বানান; প্রতিটিতে ৪–১২টি unique options এবং একটি correct answer দরকার।
- Share URL বন্ধুদের পাঠান। তারা ঠিক ১০টি প্রশ্ন বেছে খেলবে।
- প্রতি প্রশ্নে server correct answer-সহ তিনটি random distractor পাঠায়; correct answer field প্রকাশ করে না। Score database-এ জমা হয়।
- Admin panel থেকে creator name, avatar URL, social/other links এবং recent quiz scores দেখা যায়।

## আগে জেনে নিন
- এটি deployable starter, কিন্তু production launch-এর আগে rate limiting, CSRF hardening, abuse prevention, privacy policy/data deletion, proper localization, image upload এবং security review যোগ করা উচিত।
- Avatar এখন HTTPS image URL দিয়ে সেট হয়, direct upload নয়। ভাষা selector আছে, কিন্তু সম্পূর্ণ অনুবাদ এখনও যুক্ত হয়নি।
- শুধুমাত্র `index.html` ফাইল হিসেবে খুললে backend কাজ করবে না; hosting ও PostgreSQL প্রয়োজন।
