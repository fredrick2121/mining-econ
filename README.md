# محاسبات اقتصاد معدن (Mining Economics)

اپ وب پیش‌رونده (PWA)، دوزبانه فارسی/انگلیسی، بدون نیاز به اینترنت پس از اولین باز شدن.

## نصب روی اندروید
1. پوشهٔ پروژه را روی یک هاست HTTPS بگذارید (GitHub Pages، Netlify، Cloudflare Pages، …).
2. لینک را در Chrome اندروید باز کنید → منو ⋮ → **Install app / افزودن به صفحهٔ اصلی**.

## ساخت فایل APK (روش پیشنهادی: گیت‌هاب، بدون نصب چیزی روی کامپیوتر)
1. در github.com یک مخزن (Repository) جدید بسازید و محتوای این پوشه را در آن آپلود کنید (Add file ← Upload files؛ پوشهٔ `.github` را هم حتماً آپلود کنید).
2. تب **Actions** ← workflow به نام **Build APK** ← **Run workflow** (یا با هر push خودکار اجرا می‌شود).
3. پس از ۵–۱۰ دقیقه، در پایین صفحهٔ اجرا بخش **Artifacts** فایل `mining-econ-apk` را دانلود و unzip کنید ← `app-debug.apk`.
4. فایل را به گوشی بفرستید و نصب کنید (اجازهٔ «نصب از منابع ناشناس» را بدهید).

## روش‌های دیگر
- https://www.pwabuilder.com : آدرس هاست HTTPS اپ را بدهید ← Android package.
- Android Studio: `npm install` ← `node scripts/prepare-web.js` ← `npx cap add android` ← `npx cap sync android` ← پوشهٔ `android` را باز کنید و Build APK بزنید.

## ماژول‌ها
ضرایب بهره (F/P, P/F, F/A, A/F, P/A, A/P, A/G, P/G) • تبدیل P/F/A/G و گرادیان هندسی • نرخ اسمی/مؤثر/پیوسته/تورم •
حل i و n • NPV, NFV, EUAW, IRR(ROR), MIRR, PI, B/C, بازگشت سرمایه • مقایسهٔ دو طرح با ΔROR • CR/EAC/هزینهٔ سرمایه‌ای‌شده •
استهلاک (SL, DDB, DB, SYD, UOP) • Depletion • عیار حد و تناژ–عیار • ذخیره/رقیق‌شدگی/قانون تیلور/BESR •
مدل پروژهٔ معدنی با مالیات، انتقال زیان و تحلیل حساسیت.

## اجرای تست فرمول‌ها
`node test/engine.test.js`

## ساختار
- `engine.js` فرمول‌ها (بدون وابستگی به رابط) — برای افزودن فرمول جدید اینجا شروع کنید.
- `app.js` تعریف ماژول‌ها و فرم‌ها؛ هر ماژول یک آبجکت در آرایهٔ `M` است.
