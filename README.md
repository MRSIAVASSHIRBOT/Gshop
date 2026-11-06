# G_SHOP

فروشگاه آنلاین فارسی پوشاک اسپرت؛ رابط کاربری RTL، پنل مدیریت و API مبتنی بر Cloudflare Workers و D1.

## ساختار مخزن

- index.html — پوسته و ساختار صفحات فروشگاه
- styles.css — طراحی واکنش‌گرا و تم‌ها
- app.js — منطق سمت کاربر، سبد خرید و فرایند سفارش
- admin.js — پنل مدیریت
- content.js — دریافت محتوای قابل مدیریت
- keys.js — کلیدهای ذخیره‌سازی سمت مرورگر
- worker.js — API، احراز هویت مدیر، سفارش‌ها و اتصال سرویس‌ها
- _routes.json — محدودسازی مسیرهای Worker در Pages

## پیش‌نیازها

- Node.js 20 یا جدیدتر برای بررسی ایستا و تست‌ها
- Cloudflare Pages / Workers
- یک binding از نوع D1 با نام DB
- متغیرهای محیطی و Secrets متناسب با قابلیت‌های فعال‌شده

## تنظیمات Worker

حداقل تنظیمات موردنیاز برای پنل مدیریت:

- ADMIN_USERNAME
- ADMIN_PASSWORD
- DB (D1 binding)

تنظیمات اختیاری بر اساس قابلیت‌های مورد استفاده:

- SITE_URL — نشانی اصلی فروشگاه
- ALLOWED_ORIGINS — فهرست originهای مجاز با جداکننده کاما؛ در حالت پیش‌فرض فقط same-origin مجاز است. از wildcard فقط در صورت نیاز واقعی و آگاهی از پیامدهای CORS استفاده کنید.
- ZIBAL_MERCHANT — شناسه پذیرنده زیبال
- DIGIPAY_CLIENT_ID, DIGIPAY_CLIENT_SECRET, DIGIPAY_USERNAME, DIGIPAY_PASSWORD — configure every DIGIPAY_* credential as a Cloudflare Worker secret binding, never as plain-text variables.
- ALLOWED_ORIGINS — use an explicit comma-separated list of exact HTTPS origins when cross-origin access is required. Wildcard `*` is not accepted; same-origin requests remain the fallback when no exact origin is configured.
- TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
- SESSION_HOURS

هیچ Secret واقعی را در Git، فایل‌های Frontend یا گزارش Issue قرار ندهید. مقادیر واقعی را فقط در تنظیمات امن Cloudflare ذخیره کنید.

## توسعه و بررسی

- npm test
- npm run check

این دستورات تست‌های قرارداد امنیتی و بررسی نحوی فایل‌های JavaScript را اجرا می‌کنند. آن‌ها جایگزین تست انتها‌به‌انتها با D1 آزمایشی و درگاه پرداخت sandbox نیستند.

## استقرار

1. مخزن را به Cloudflare Pages متصل کنید.
2. Worker را با binding پایگاه داده D1 با نام دقیق DB پیکربندی کنید.
3. متغیرها و Secrets لازم را در محیط Production و Preview جداگانه تنظیم کنید.
4. ابتدا در محیط Preview، ثبت سفارش، مسیرهای پرداخت آزمایشی، مدیریت موجودی و پنل مدیر را بررسی کنید.
5. پس از موفقیت تست‌ها، انتشار Production را انجام دهید.

## ملاحظات عملیاتی

- محدودکننده درخواست داخل Worker یک محافظ best-effort و وابسته به isolate است؛ برای کنترل توزیع‌شده باید از سرویس پایدار مانند Durable Objects یا ارائه‌دهنده Rate Limit استفاده شود.
- برای جلوگیری کامل از فروش هم‌زمان بیش از موجودی، رزرو اتمیک موجودی و انقضای رزرو باید به‌عنوان یک گردش‌کار تراکنشی D1 پیاده‌سازی و با داده آزمایشی رقابتی تست شود.
- Callbackهای پرداخت باید فقط پس از تأیید سمت سرور و تطبیق مبلغ به سفارش معتبر متصل شوند.
- پیش از مهاجرت Schema یا حذف داده‌ها، از D1 نسخه پشتیبان تهیه کنید.

## وضعیت کیفیت

هر تغییر باید از بررسی نحوی، تست خودکار و بازبینی امنیتی عبور کند. امتیاز کامل تنها پس از اجرای تست‌های عملیاتی، آزمون بار، بررسی دسترس‌پذیری و تأیید محیط واقعی قابل ادعاست.
