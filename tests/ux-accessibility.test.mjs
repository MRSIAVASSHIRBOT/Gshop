import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const html=read("../index.html"),app=read("../app.js"),admin=read("../admin.js"),css=read("../styles.css"),experience=read("../experience.css");
test("product detail gallery, variants and live stock are accessible",()=>{assert.match(app,/gallery__thumb[^\n]*aria-pressed/);assert.match(app,/data-color[^\n]*aria-pressed/);assert.match(app,/data-size[^\n]*aria-pressed/);assert.match(app,/id="variantStockStatus" role="status" aria-live="polite"/);});
test("checkout has a clear step indicator and field-specific errors",()=>{assert.match(app,/class="checkout-steps" aria-label="مراحل خرید"/);assert.match(app,/role="alert" aria-live="assertive"/);assert.match(app,/aria-invalid/);assert.match(app,/showErr\('شماره موبایل[^\n]+#ckPhone/);});
test("modal uses dialog semantics and keyboard focus management",()=>{assert.match(html,/role="dialog" aria-modal="true"/);assert.match(app,/function focusModalDialog/);assert.match(app,/e\.key === 'Tab'[\s\S]*?modalEl/);assert.match(app,/function restoreModalFocus/);});
test("admin navigation and search controls are labelled",()=>{assert.match(admin,/role="tablist"/);assert.match(admin,/aria-controls="panel-\$\{t\}"/);assert.match(admin,/aria-labelledby="tab-\$\{t\}"/);assert.match(admin,/aria-label="فیلتر وضعیت سفارش/);assert.match(admin,/aria-label="فیلتر وضعیت محصولات"/);});
test("admin cards and order actions have mobile layouts",()=>{assert.match(admin,/prod-admin__layout/);assert.match(css,/\.prod-admin__layout\{grid-template-columns:76px/);assert.match(css,/\.ocard__actions\{display:grid;grid-template-columns:repeat\(2/);assert.match(css,/#adminTabs\{display:flex;flex-wrap:nowrap;overflow-x:auto/);});
test("reduced motion does not re-enable hero animation",()=>{assert.match(css,/prefers-reduced-motion: reduce\)[\s\S]*?\.hero__title em\{animation:none!important\}/);});

test("frontend API retries only idempotent reads",()=>{
  assert.match(app,/const method = String\(opts\.method \|\| 'GET'\)\.toUpperCase\(\)/);
  assert.match(app,/const retryable = method === 'GET' \|\| method === 'HEAD'/);
  assert.match(app,/if \(retryable && retries > 0 && !e\.status && navigator\.onLine\)/);
});

test("product showcase uses only real rating data and removes fabricated social proof",()=>{
  assert.match(app,/Number\(p\.rating_count\)/);
  assert.match(app,/p\.rating_avg/);
  assert.doesNotMatch(app,/FAKE_NAMES|FAKE_CITIES|function startSocialProof|purchasePopup|pcard__viewers/);
  assert.doesNotMatch(app,/ضمانت اصالت|مرجوعی آسان|۱۰۰٪ اصل و باکیفیت/);
});
test("product detail purchase controls remain visible while scrolling on mobile",()=>{
  assert.match(app,/class="product-purchase-bar"/);
  assert.match(experience,/\.product-purchase-bar\{[\s\S]*?position:sticky/);
  assert.match(experience,/env\(safe-area-inset-bottom\)/);
});
test("product cards show category and only render ratings when review count exists",()=>{
  assert.match(app,/class="pcard__category"/);
  assert.match(app,/ratingCount > 0/);
  assert.match(app,/class="pcard__rating"/);
});

test("checkout shows an escaped order review and authoritative server validation note",()=>{
  assert.match(app,/class="checkout-order-summary"/);
  assert.match(app,/checkout-order-summary__items/);
  assert.match(app,/موجودی و قیمت نهایی هر تنوع هنگام ثبت سفارش در سرور دوباره بررسی می‌شود/);
  assert.match(app,/checkout-shipping-note/);
});
test("checkout validation errors clear when the customer corrects a field",()=>{
  assert.match(app,/checkoutFields\.forEach/);
  assert.match(app,/field\.removeAttribute\('aria-invalid'\)/);
});
test("cart and checkout have dedicated small-screen ergonomics",()=>{
  assert.match(experience,/\.drawer__foot\{padding:15px 16px calc\(14px \+ env\(safe-area-inset-bottom\)\)\}/);
  assert.match(experience,/@media\(max-width:480px\)[\s\S]*?max-height:calc\(100dvh - 8px\)/);
});


test("static imagery reserves layout space and decodes asynchronously",()=>{
  const images=[...html.matchAll(/<img\b[^>]*>/g)].map(match=>match[0]);
  assert.ok(images.length >= 10, "expected editorial, social and trust imagery");
  for (const image of images) {
    assert.match(image, /\bwidth="\d+"/, "image width must reserve layout space");
    assert.match(image, /\bheight="\d+"/, "image height must reserve layout space");
    assert.match(image, /\bdecoding="async"/, "images should decode asynchronously");
  }
  const eager=images.filter(image=>/\bloading="eager"/.test(image));
  assert.equal(eager.length, 1, "only the primary hero image should load eagerly");
  assert.match(eager[0], /fetchpriority="high"/);
});
test("below-the-fold static imagery is lazy-loaded",()=>{
  const images=[...html.matchAll(/<img\b[^>]*>/g)].map(match=>match[0]);
  for (const image of images.filter(image=>!image.includes('id="heroImg1"'))) {
    assert.match(image, /\bloading="lazy"/);
  }
});
test("critical application scripts remain deferred",()=>{
  for (const file of ["keys.js","content.js","app.js","admin.js"]) {
    assert.match(html, new RegExp('<script\\s+src="' + file + '"\\s+defer'));
  }
});


test("product grid defers below-the-fold images behind the hero image",()=>{
  assert.match(app,/loading="lazy" fetchpriority="low" decoding="async"/);
  assert.doesNotMatch(app,/idx < 4 \? 'eager' : 'lazy'/);
  assert.doesNotMatch(app,/idx < 2 \? 'high' : 'auto'/);
});


test("admin image uploads optimize JPEG, PNG and WebP files before sending",()=>{
  assert.match(admin,/async function optimizeAdminImage\(file\)/);
  assert.match(admin,/createImageBitmap\(file\)/);
  assert.match(admin,/canvas\.toBlob\(resolve, 'image\/webp', 0\.82\)/);
  assert.match(admin,/1800 \/ Math\.max\(bitmap\.width, bitmap\.height\)/);
  assert.match(admin,/image\/\(jpeg\|png\|webp\)/);
  assert.equal((admin.match(/fd\.append\('file', uploadFile, uploadFile\.name\)/g)||[]).length,4);
  assert.equal((admin.match(/const uploadFile = await optimizeAdminImage\(file\)/g)||[]).length,4);
});
