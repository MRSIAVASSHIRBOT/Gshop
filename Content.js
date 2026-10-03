/* ==========================================================
   G_SHOP - Content.js
   مدیریت محتوای داینامیک (عکس‌ها و متن‌ها)
   ========================================================== */

const CONTENT_CACHE_KEY = 'gshop_content_cache';

async function loadContent() {
  try {
    const r = await api('/api/content');
    state.content = r.content || {};
    safeStore(CONTENT_CACHE_KEY, state.content);
    applyContent();
  } catch (e) {
    const cached = safeGet(CONTENT_CACHE_KEY, null);
    if (cached) { state.content = cached; applyContent(); }
  }
}

function applyContent() {
  const c = (state && state.content) || {};
  const setImg = (id, url) => { const el = document.getElementById(id); if (el && url) el.src = url; };
  const setTxt = (id, txt) => { const el = document.getElementById(id); if (el && txt != null && txt !== '') el.textContent = txt; };

  // Hero
  setImg('heroImg1', c.hero_img_1);
  setImg('heroImg2', c.hero_img_2);
  setTxt('heroCardTitle', c.hero_card_title);
  setTxt('heroCardPrice', c.hero_card_price);

  // Lookbook
  setImg('lookbookBigImg', c.lookbook_big_img);
  setTxt('lookbookBigTag', c.lookbook_big_tag);
  setTxt('lookbookBigTitle', c.lookbook_big_title);
  setTxt('lookbookBigSub', c.lookbook_big_sub);

  setImg('lookbookS1Img', c.lookbook_s1_img);
  setTxt('lookbookS1Tag', c.lookbook_s1_tag);
  setTxt('lookbookS1Title', c.lookbook_s1_title);

  setImg('lookbookS2Img', c.lookbook_s2_img);
  setTxt('lookbookS2Tag', c.lookbook_s2_tag);
  setTxt('lookbookS2Title', c.lookbook_s2_title);

  // Story
  setImg('storyImg', c.story_img);

  // Instagram
  for (let i = 1; i <= 6; i++) {
    setImg('igImg' + i, c['instagram_' + i]);
  }
}

window.loadContent = loadContent;
window.applyContent = applyContent;
