/* ==========================================================
   G_SHOP - Admin.js v2.0
   پنل مدیریت کامل
   ========================================================== */

/* ==========================================================
   ADMIN STATE
   ========================================================== */
const adminState = {
  isAdmin: false,
  currentTab: 'dashboard',
  editingProductId: null,
};

/* ==========================================================
   OPEN / CLOSE ADMIN
   ========================================================== */
function openAdmin() {
  const panel = $('#adminPanel');
  panel.classList.add('on');
  if (localStorage.getItem(ADMIN_TOKEN_KEY)) {
    adminState.isAdmin = true;
    renderAdmin();
  } else {
    renderAdminLogin();
  }
}
function closeAdmin() { $('#adminPanel').classList.remove('on'); }
async function adminLogout() {
  try { await api('/api/admin/logout', { method: 'POST' }); } catch {}
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  adminState.isAdmin = false;
  renderAdminLogin();
}

/* ==========================================================
   LOGIN
   ========================================================== */
function renderAdminLogin() {
  $('#adminBody').innerHTML = `
    <div class="login">
      <div class="modal__box" style="width:min(420px,100%);position:relative;transform:none;margin:0">
        <h2>ورود مدیر</h2>
        <p class="sub">نام کاربری و رمز عبور را وارد کنید.</p>
        <div class="field"><label>نام کاربری</label><input type="text" id="adminUser" value="admin" autocomplete="username"></div>
        <div class="field"><label>رمز عبور</label><input type="password" id="adminPw" placeholder="••••••••" autocomplete="current-password"></div>
        <div class="err" id="adminErr"></div>
        <button class="checkout-btn" id="adminLogin">ورود</button>
      </div>
    </div>
  `;
  const submit = async () => {
    const username = $('#adminUser').value.trim();
    const password = $('#adminPw').value;
    const err = $('#adminErr');
    err.classList.remove('on');
    try {
      const r = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      localStorage.setItem(ADMIN_TOKEN_KEY, r.token);
      adminState.isAdmin = true;
      toast('خوش آمدید ✓');
      renderAdmin();
    } catch (e) {
      err.textContent = e.message;
      err.classList.add('on');
    }
  };
  $('#adminLogin').onclick = submit;
  $('#adminPw').onkeydown = e => { if (e.key === 'Enter') submit(); };
  setTimeout(() => $('#adminPw')?.focus(), 100);
}

/* ==========================================================
   MAIN ADMIN RENDER
   ========================================================== */
async function renderAdmin() {
  const body = $('#adminBody');
  body.innerHTML = `
    <div class="tabs" id="adminTabs">
      <button class="tab active" data-tab="dashboard">📊 داشبورد</button>
      <button class="tab" data-tab="products">🛍️ محصولات</button>
      <button class="tab" data-tab="newproduct">➕ محصول جدید</button>
      <button class="tab" data-tab="stock">📦 موجودی</button>
      <button class="tab" data-tab="orders">🧾 سفارشات</button>
      <button class="tab" data-tab="coupons">🎟 کدها</button>
      <button class="tab" data-tab="reviews">⭐ نظرات</button>
      <button class="tab" data-tab="settings">⚙️ تنظیمات</button>
      <button class="tab" data-tab="audit">📜 لاگ</button>
    </div>
    <div class="panel on" id="panel-dashboard"></div>
    <div class="panel" id="panel-products"></div>
    <div class="panel" id="panel-newproduct"></div>
    <div class="panel" id="panel-stock"></div>
    <div class="panel" id="panel-orders"></div>
    <div class="panel" id="panel-coupons"></div>
    <div class="panel" id="panel-reviews"></div>
    <div class="panel" id="panel-settings"></div>
    <div class="panel" id="panel-audit"></div>
  `;
  body.querySelectorAll('.tab').forEach(t => {
    t.onclick = () => {
      body.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      body.querySelectorAll('.panel').forEach(x => x.classList.remove('on'));
      t.classList.add('active');
      $('#panel-' + t.dataset.tab).classList.add('on');
      adminState.currentTab = t.dataset.tab;
      loadAdminTab();
    };
  });
  loadAdminTab();
}

async function loadAdminTab() {
  const v = adminState.currentTab;
  try {
    if (v === 'dashboard') await loadDashboard();
    else if (v === 'products') await loadProductsAdmin();
    else if (v === 'newproduct') await loadAddProduct();
    else if (v === 'stock') await loadStock();
    else if (v === 'orders') await loadOrders();
    else if (v === 'coupons') await loadCoupons();
    else if (v === 'reviews') await loadReviews();
    else if (v === 'settings') await loadSettingsPanel();
    else if (v === 'audit') await loadAudit();
  } catch (e) {
    if (e.message.includes('دسترسی') || e.status === 401) adminLogout();
  }
}

/* ==========================================================
   1. DASHBOARD
   ========================================================== */
async function loadDashboard() {
  const el = $('#panel-dashboard');
  el.innerHTML = '<p style="color:var(--dim)">در حال بارگذاری...</p>';
  try {
    const s = await api('/api/admin/stats');
    const low = await api('/api/admin/low-stock');

    let chartHTML = '';
    if (s.salesChart && s.salesChart.length) {
      const max = Math.max(...s.salesChart.map(x => x.total), 1);
      chartHTML = `
        <div class="chart">
          <h3>📊 فروش ۷ روز اخیر</h3>
          <div class="chart__bars">
            ${s.salesChart.map(x => `
              <div class="chart__bar" style="height:${(x.total / max * 100) || 2}%" data-val="${fmtNum(x.total)}">
                <span>${esc(x.d.split('-').slice(1).join('/'))}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    el.innerHTML = `
      <div class="stats">
        <div class="stat"><div class="stat__l">تعداد سفارشات</div><div class="stat__v lime">${fmtNum(s.totalOrders)}</div></div>
        <div class="stat"><div class="stat__l">درآمد کل</div><div class="stat__v green" style="font-size:16px">${fmt(s.revenue)}</div></div>
        <div class="stat"><div class="stat__l">در انتظار بررسی</div><div class="stat__v gold">${fmtNum(s.pending)}</div></div>
        <div class="stat"><div class="stat__l">موجودی کل</div><div class="stat__v">${fmtNum(s.stock)}</div></div>
      </div>

      ${chartHTML}

      <div style="display:flex;gap:10px;margin-bottom:22px;flex-wrap:wrap">
        <button class="chip" id="testTelegram" style="padding:11px 20px">🔔 تست تلگرام</button>
        <button class="chip" id="exportCSV" style="padding:11px 20px">📥 خروجی CSV</button>
        <button class="chip" id="clearCache" style="padding:11px 20px">🔄 پاک کردن کش</button>
      </div>

      ${low.items.length ? `
        <div style="background:color-mix(in srgb,var(--gold) 8%,transparent);border:1px solid color-mix(in srgb,var(--gold) 30%,transparent);border-radius:16px;padding:18px;margin-bottom:20px">
          <div style="color:var(--gold);font-weight:700;margin-bottom:10px">⚠ هشدار موجودی کم (${fmtNum(low.items.length)} مورد)</div>
          <div style="color:var(--dim);font-size:13px;line-height:2">
            ${low.items.map(i => `• ${esc(i.product_name)} — ${esc(i.color)} ${esc(i.size)}: ${fmtNum(i.stock)} عدد`).join('<br>')}
          </div>
        </div>
      ` : ''}

      ${s.recentOrders?.length ? `
        <div class="chart">
          <h3>🕐 آخرین سفارشات</h3>
          ${s.recentOrders.map(o => `
            <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);font-size:13px;flex-wrap:wrap;gap:8px">
              <span class="mono" style="color:var(--lime)">${esc(o.order_no)}</span>
              <span>${esc(o.name)}</span>
              <span style="font-family:'Space Grotesk',sans-serif">${fmt(o.total)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    $('#testTelegram').onclick = async () => {
      const btn = $('#testTelegram');
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = '⏳ در حال ارسال...';
      try {
        await api('/api/admin/telegram-test', { method: 'POST' });
        toast('پیام تست ارسال شد ✓');
      } catch (e) { toast(e.message, 'err'); }
      finally { btn.disabled = false; btn.textContent = old; }
    };

    $('#exportCSV').onclick = async () => {
      try {
        const r = await fetch(API + '/api/admin/orders.csv', {
          headers: { 'X-Admin-Token': localStorage.getItem(ADMIN_TOKEN_KEY) },
        });
        const b = await r.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = `gshop-orders-${Date.now()}.csv`;
        a.click();
        toast('CSV دانلود شد ✓');
      } catch (e) { toast(e.message, 'err'); }
    };

    $('#clearCache').onclick = () => {
      localStorage.removeItem(SETTINGS_CACHE_KEY);
      toast('کش پاک شد. صفحه رو رفرش کن ✓');
    };
  } catch (e) {
    if (e.message.includes('دسترسی') || e.status === 401) adminLogout();
    else el.innerHTML = `<p style="color:var(--red)">${esc(e.message)}</p>`;
  }
}

/* ==========================================================
   2. PRODUCTS ADMIN (List/Edit/Delete)
   ========================================================== */
async function loadProductsAdmin() {
  const el = $('#panel-products');
  el.innerHTML = '<p style="color:var(--dim)">در حال بارگذاری...</p>';
  try {
    const { products } = await api('/api/products');
    state.products = products;

    el.innerHTML = `
      <div class="filter-bar">
        <input type="text" id="prodSearch" placeholder="🔍 جستجوی محصول...">
        <select id="prodStatusFilter">
          <option value="">همه</option>
          <option value="active">فعال</option>
          <option value="inactive">غیرفعال</option>
          <option value="instock">موجود</option>
          <option value="outstock">ناموجود</option>
        </select>
        <button class="chip" id="prodAddBtn">➕ محصول جدید</button>
      </div>
      <div id="prodList"></div>
    `;

    const render = (search = '', status = '') => {
      let list = [...products];
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(p => p.name.toLowerCase().includes(q) || String(p.id).includes(q));
      }
      if (status === 'active') list = list.filter(p => p.active);
      if (status === 'inactive') list = list.filter(p => !p.active);
      if (status === 'instock') list = list.filter(p => totalStock(p) > 0);
      if (status === 'outstock') list = list.filter(p => totalStock(p) === 0);

      const container = $('#prodList');
      if (!list.length) {
        container.innerHTML = '<p style="color:var(--dim)">محصولی یافت نشد.</p>';
        return;
      }

      container.innerHTML = list.map(p => {
        const stock = totalStock(p);
        const colors = [...new Set(p.variants.map(v => v.color))];
        const sizes = [...new Set(p.variants.map(v => v.size))];
        return `
          <div class="prod-admin" style="display:grid;grid-template-columns:100px 1fr;gap:16px;align-items:start">
            <div style="aspect-ratio:4/5;border-radius:10px;overflow:hidden;background:var(--ink-3)">
              <img src="${esc(p.image)}" style="width:100%;height:100%;object-fit:cover" alt="">
            </div>
            <div>
              <div class="prod-admin__head" style="margin-bottom:10px">
                <div>
                  <strong>${esc(p.name)}</strong>
                  <span style="color:var(--dim);font-size:12px;margin-inline-start:8px">#${p.id}</span>
                  ${p.active ? '' : '<span class="pill cancelled" style="margin-inline-start:8px">غیرفعال</span>'}
                  ${p.tag ? `<span class="pill pending" style="margin-inline-start:8px">${esc(p.tag)}</span>` : ''}
                </div>
                <span class="price">${fmt(p.price)}</span>
              </div>
              <div style="font-size:12.5px;color:var(--dim);line-height:1.8;margin-bottom:12px">
                <div>📦 موجودی کل: <b style="color:${stock === 0 ? 'var(--red)' : stock <= 3 ? 'var(--gold)' : 'var(--green)'}">${fmtNum(stock)}</b> عدد</div>
                <div>🎨 رنگ‌ها: ${colors.length ? colors.map(c => esc(c)).join(' · ') : '—'}</div>
                <div>📏 سایزها: ${sizes.length ? sizes.map(s => esc(s)).join(' · ') : '—'}</div>
                ${p.category ? `<div>📂 دسته: ${esc(p.category)}</div>` : ''}
                <div>🔢 ترتیب: ${p.sort_order || 0}</div>
              </div>
              <div class="prod-admin__head actions" style="margin:0;justify-content:flex-start;gap:8px;flex-wrap:wrap">
                <button data-edit="${p.id}">✏️ ویرایش</button>
                <button data-toggle-active="${p.id}" data-active="${p.active}">${p.active ? '🚫 غیرفعال' : '✅ فعال'}</button>
                <button data-gallery="${p.id}">🖼 گالری</button>
                <button class="danger" data-del="${p.id}">🗑 حذف</button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('[data-edit]').forEach(b => {
        b.onclick = () => openEditProduct(Number(b.dataset.edit));
      });
      container.querySelectorAll('[data-toggle-active]').forEach(b => {
        b.onclick = async () => {
          const active = b.dataset.active === '1' ? 0 : 1;
          try {
            await api('/api/admin/products/' + b.dataset.toggleActive, {
              method: 'PATCH',
              body: JSON.stringify({ active }),
            });
            toast(active ? 'فعال شد ✓' : 'غیرفعال شد');
            loadProductsAdmin();
          } catch (e) { toast(e.message, 'err'); }
        };
      });
      container.querySelectorAll('[data-del]').forEach(b => {
        b.onclick = async () => {
          if (!await confirmDialog('حذف محصول', 'این محصول و همه واریانت‌هاش حذف می‌شن. مطمئنی؟')) return;
          try {
            await api('/api/admin/products/' + b.dataset.del, { method: 'DELETE' });
            toast('محصول حذف شد');
            loadProducts();
            loadProductsAdmin();
          } catch (e) { toast(e.message, 'err'); }
        };
      });
      container.querySelectorAll('[data-gallery]').forEach(b => {
        b.onclick = () => openGalleryManager(Number(b.dataset.gallery));
      });
    };

    render();

    const debouncedRender = debounce((v, s) => render(v, s), 250);
    $('#prodSearch').oninput = (e) => debouncedRender(e.target.value, $('#prodStatusFilter').value);
    $('#prodStatusFilter').onchange = (e) => render($('#prodSearch').value, e.target.value);
    $('#prodAddBtn').onclick = () => {
      document.querySelector('.tab[data-tab="newproduct"]')?.click();
    };
  } catch (e) {
    if (e.message.includes('دسترسی') || e.status === 401) adminLogout();
    else el.innerHTML = `<p style="color:var(--red)">${esc(e.message)}</p>`;
  }
}

/* ==========================================================
   3. EDIT PRODUCT
   ========================================================== */
function openEditProduct(pid) {
  const p = state.products.find(x => x.id === pid);
  if (!p) return;

  const modal = $('#modal');
  const box = $('#modalBox');
  box.classList.add('modal__box--wide');
  box.innerHTML = `
    <div style="padding:32px" id="editProdContainer">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h2 style="margin:0">ویرایش محصول #${p.id}</h2>
        <button class="close-x" id="epClose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>

      <div class="np-grid">
        <div class="np-field"><label>نام محصول *</label><input type="text" id="epName" value="${esc(p.name)}"></div>
        <div class="np-field">
          <label>دسته‌بندی</label>
          <select id="epCategory">
            ${['tshirt','hoodie','shirt','pants','jacket','accessory'].map(c => `<option value="${c}" ${c === p.category ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="np-field"><label>قیمت (تومان) *</label><input type="number" id="epPrice" value="${p.price}" min="0"></div>
        <div class="np-field"><label>قیمت قبل از تخفیف</label><input type="number" id="epCompare" value="${p.compare_price || ''}" min="0"></div>
        <div class="np-field">
          <label>تگ</label>
          <select id="epTag">
            <option value="">بدون</option>
            ${['NEW','HOT','LIMITED','SALE'].map(t => `<option value="${t}" ${t === p.tag ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="np-field"><label>ترتیب نمایش</label><input type="number" id="epSort" value="${p.sort_order || 0}"></div>
      </div>

      <div class="np-field"><label>توضیحات</label><textarea id="epDesc" style="min-height:70px">${esc(p.description || '')}</textarea></div>

      <div class="np-section">
        <div class="np-label">تصویر اصلی</div>
        <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">
          <div style="width:120px;aspect-ratio:4/5;border-radius:12px;overflow:hidden;background:var(--ink-3)">
            <img id="epImg" src="${esc(p.image)}" style="width:100%;height:100%;object-fit:cover">
          </div>
          <div>
            <input type="file" id="epFile" accept="image/*" style="display:none">
            <button class="chip" id="epUploadBtn">📁 تغییر عکس</button>
          </div>
        </div>
      </div>

      <div class="np-section">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div class="np-label" style="margin:0">رنگ‌ها و موجودی</div>
          <button class="chip" id="epAddVariant" style="font-size:12px;padding:8px 14px">+ افزودن</button>
        </div>
        <div id="epVariants"></div>
      </div>

      <div class="err" id="epErr"></div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button class="checkout-btn" id="epSave" style="flex:1">✓ ذخیره تغییرات</button>
        <button class="chip" id="epCancel" style="padding:14px 24px">لغو</button>
      </div>
    </div>
  `;

  let newImageUrl = p.image;
  let variants = p.variants.map(v => ({ color: v.color, size: v.size, stock: v.stock, _id: v.id }));

  const fileInput = $('#epFile');
  $('#epUploadBtn').onclick = () => fileInput.click();
  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('حجم فایل بیش از ۵ مگابایت', 'err'); return; }
    const reader = new FileReader();
    reader.onload = ev => { $('#epImg').src = ev.target.result; };
    reader.readAsDataURL(file);
    try {
      toast('در حال آپلود...');
      const fd = new FormData(); fd.append('file', file);
      const token = localStorage.getItem(ADMIN_TOKEN_KEY);
      const r = await fetch(API + '/api/admin/upload', { method: 'POST', headers: { 'X-Admin-Token': token }, body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'خطا');
      newImageUrl = data.url;
      toast('عکس آپلود شد ✓');
    } catch (err) {
      toast(err.message, 'err');
      $('#epImg').src = p.image;
    }
  };

  function renderVariants() {
    const wrap = $('#epVariants');
    wrap.innerHTML = variants.map((v, i) => `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center">
        <input type="text" value="${esc(v.color)}" placeholder="رنگ" data-vi="${i}" data-vk="color" style="padding:10px 12px;background:var(--ink);border:1px solid var(--line);border-radius:10px;color:var(--text);font-size:13px">
        <input type="text" value="${esc(v.size)}" placeholder="سایز" data-vi="${i}" data-vk="size" style="padding:10px 12px;background:var(--ink);border:1px solid var(--line);border-radius:10px;color:var(--text);font-size:13px">
        <input type="number" value="${v.stock}" min="0" data-vi="${i}" data-vk="stock" style="padding:10px 12px;background:var(--ink);border:1px solid var(--line);border-radius:10px;color:var(--text);font-size:13px">
        <button class="del-btn" data-vdel="${i}" style="padding:10px 14px">×</button>
      </div>
    `).join('');
    wrap.querySelectorAll('input').forEach(inp => {
      inp.oninput = () => {
        const i = Number(inp.dataset.vi), k = inp.dataset.vk;
        variants[i][k] = k === 'stock' ? Number(inp.value) : inp.value;
      };
    });
    wrap.querySelectorAll('[data-vdel]').forEach(b => {
      b.onclick = () => { variants.splice(Number(b.dataset.vdel), 1); renderVariants(); };
    });
  }
  renderVariants();
  $('#epAddVariant').onclick = () => { variants.push({ color: '', size: '', stock: 0 }); renderVariants(); };

  const close = () => { modal.classList.remove('on'); box.classList.remove('modal__box--wide'); };
  $('#epClose').onclick = close;
  $('#epCancel').onclick = close;
  modal.onclick = e => { if (e.target === modal) close(); };

  $('#epSave').onclick = async () => {
    const err = $('#epErr');
    err.classList.remove('on');
    const showErr = (msg) => { err.textContent = msg; err.classList.add('on'); };

    const name = $('#epName').value.trim();
    const price = Number($('#epPrice').value);
    const compare_price = Number($('#epCompare').value) || null;
    const category = $('#epCategory').value;
    const tag = $('#epTag').value;
    const sort_order = Number($('#epSort').value) || 0;
    const description = $('#epDesc').value.trim();

    if (!name) return showErr('نام الزامی است');
    if (!price || price <= 0) return showErr('قیمت معتبر نیست');

    const cleanVariants = variants.map(v => ({
      color: String(v.color).trim(), size: String(v.size).trim(), stock: Math.max(0, Number(v.stock) || 0)
    })).filter(v => v.color && v.size);

    const btn = $('#epSave');
    btn.disabled = true;
    btn.textContent = '⏳ در حال ذخیره...';

    try {
      await api('/api/admin/products/' + p.id, {
        method: 'PATCH',
        body: JSON.stringify({ name, price, compare_price, category, tag, sort_order, description, image: newImageUrl }),
      });
      // به‌روزرسانی variantها با endpoint جدید (اگه داری) یا فعلاً فقط موجودی
      for (const v of cleanVariants) {
        const old = p.variants.find(ov => ov.color === v.color && ov.size === v.size);
        if (old) {
          const delta = v.stock - old.stock;
          if (delta !== 0) {
            await api('/api/admin/stock', {
              method: 'PATCH',
              body: JSON.stringify({ productId: p.id, color: v.color, size: v.size, delta }),
            });
          }
        }
      }
      toast('محصول به‌روز شد ✓');
      await loadProducts();
      await loadProductsAdmin();
      close();
    } catch (e) {
      showErr(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '✓ ذخیره تغییرات';
    }
  };
}

/* ==========================================================
   4. GALLERY MANAGER
   ========================================================== */
async function openGalleryManager(pid) {
  const p = state.products.find(x => x.id === pid);
  if (!p) return;

  const modal = $('#modal');
  const box = $('#modalBox');
  box.classList.add('modal__box--wide');

  let gallery = [...(p.gallery || [])];

  function render() {
    box.innerHTML = `
      <div style="padding:32px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h2 style="margin:0">گالری: ${esc(p.name)}</h2>
          <button class="close-x" id="gmClose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>

        <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">
          <input type="file" id="gmFile" accept="image/*" style="display:none">
          <button class="chip" id="gmUpload">📁 افزودن عکس</button>
          <button class="chip" id="gmUrl">🔗 افزودن با URL</button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px" id="gmGrid">
          ${gallery.length ? gallery.map(g => `
            <div style="position:relative;aspect-ratio:4/5;border-radius:12px;overflow:hidden;background:var(--ink-3);border:1px solid var(--line)">
              <img src="${esc(g.url)}" style="width:100%;height:100%;object-fit:cover" alt="">
              <button class="del-btn" data-gdel="${g.id}" style="position:absolute;top:6px;left:6px;padding:4px 10px;font-size:14px">×</button>
            </div>
          `).join('') : '<p style="color:var(--dim);grid-column:1/-1">هنوز عکسی تو گالری نیست.</p>'}
        </div>
      </div>
    `;

    $('#gmClose').onclick = () => { modal.classList.remove('on'); box.classList.remove('modal__box--wide'); };

    const fileInput = $('#gmFile');
    $('#gmUpload').onclick = () => fileInput.click();
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast('حجم بیش از ۵ مگابایت', 'err'); return; }
      try {
        toast('در حال آپلود...');
        const fd = new FormData(); fd.append('file', file);
        const token = localStorage.getItem(ADMIN_TOKEN_KEY);
        const r = await fetch(API + '/api/admin/upload', { method: 'POST', headers: { 'X-Admin-Token': token }, body: fd });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'خطا');
        await api(`/api/admin/products/${pid}/gallery`, {
          method: 'POST',
          body: JSON.stringify({ url: data.url }),
        });
        const fresh = (await api('/api/products')).products.find(x => x.id === pid);
        gallery = fresh?.gallery || [];
        toast('عکس اضافه شد ✓');
        await loadProducts();
        render();
      } catch (err) { toast(err.message, 'err'); }
    };

    $('#gmUrl').onclick = async () => {
      const url = prompt('آدرس عکس را وارد کن:');
      if (!url) return;
      try {
        await api(`/api/admin/products/${pid}/gallery`, {
          method: 'POST',
          body: JSON.stringify({ url }),
        });
        const fresh = (await api('/api/products')).products.find(x => x.id === pid);
        gallery = fresh?.gallery || [];
        toast('عکس اضافه شد ✓');
        await loadProducts();
        render();
      } catch (err) { toast(err.message, 'err'); }
    };

    box.querySelectorAll('[data-gdel]').forEach(b => {
      b.onclick = async () => {
        if (!await confirmDialog('حذف عکس', 'این عکس از گالری حذف شود؟')) return;
        try {
          await api('/api/admin/gallery/' + b.dataset.gdel, { method: 'DELETE' });
          const fresh = (await api('/api/products')).products.find(x => x.id === pid);
          gallery = fresh?.gallery || [];
          toast('حذف شد');
          await loadProducts();
          render();
        } catch (err) { toast(err.message, 'err'); }
      };
    });
  }

  render();
  modal.classList.add('on');
}

/* ==========================================================
   5. ADD NEW PRODUCT
   ========================================================== */
async function loadAddProduct() {
  const el = $('#panel-newproduct');
  el.innerHTML = `
    <div style="max-width:900px;margin:0 auto">
      <div class="prod-admin" style="padding:28px">
        <h3 style="font-size:20px;font-weight:700;margin-bottom:6px">افزودن محصول جدید</h3>
        <p style="color:var(--dim);font-size:13px;margin-bottom:24px">اطلاعات محصول را کامل کن و روی ثبت بزن.</p>

        <div class="np-section">
          <div class="np-label">تصویر اصلی *</div>
          <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
            <div id="npImgPreview" style="width:140px;aspect-ratio:4/5;border-radius:12px;overflow:hidden;background:var(--ink-3);border:2px dashed var(--line-2);display:grid;place-items:center;cursor:pointer;flex-shrink:0">
              <span style="color:var(--faint);font-size:12px;text-align:center;padding:10px">📸 کلیک کن<br>برای آپلود</span>
            </div>
            <div style="flex:1;min-width:200px">
              <input type="file" id="npFile" accept="image/*" style="display:none">
              <button class="chip" id="npUploadBtn" style="width:100%">📁 انتخاب عکس</button>
              <div style="color:var(--dim);font-size:11.5px;margin-top:10px;line-height:1.7">
                • حداکثر ۵ مگابایت<br>
                • JPG، PNG، WEBP
              </div>
            </div>
          </div>
        </div>

        <div class="np-grid">
          <div class="np-field"><label>نام محصول *</label><input type="text" id="npName" placeholder="مثلاً تیشرت BAD BOY"></div>
          <div class="np-field">
            <label>دسته‌بندی</label>
            <select id="npCategory">
              <option value="tshirt">تیشرت</option>
              <option value="hoodie">هودی</option>
              <option value="shirt">پیراهن</option>
              <option value="pants">شلوار</option>
              <option value="jacket">کاپشن</option>
              <option value="accessory">اکسسوری</option>
            </select>
          </div>
          <div class="np-field"><label>قیمت (تومان) *</label><input type="number" id="npPrice" placeholder="960000" min="0"></div>
          <div class="np-field"><label>قیمت قبل از تخفیف</label><input type="number" id="npComparePrice" placeholder="1200000" min="0"></div>
          <div class="np-field">
            <label>تگ</label>
            <select id="npTag">
              <option value="">بدون</option>
              <option value="NEW">NEW (جدید)</option>
              <option value="HOT">HOT (پرطرفدار)</option>
              <option value="LIMITED">LIMITED (محدود)</option>
              <option value="SALE">SALE (تخفیف)</option>
            </select>
          </div>
          <div class="np-field"><label>ترتیب نمایش</label><input type="number" id="npSort" placeholder="10" value="10"></div>
        </div>

        <div class="np-field"><label>توضیحات</label><textarea id="npDesc" placeholder="توضیحات کوتاه و جذاب..."></textarea></div>

        <div class="np-section" style="margin-top:24px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div class="np-label" style="margin:0">رنگ‌ها و سایزها *</div>
            <button class="chip" id="npAddVariant" style="font-size:12px;padding:8px 14px">+ افزودن</button>
          </div>
          <div id="npVariants"></div>
        </div>

        <div id="npErr" class="err" style="margin-top:20px"></div>
        <div style="display:flex;gap:10px;margin-top:20px">
          <button class="checkout-btn" id="npSubmit" style="flex:1">✓ ثبت محصول</button>
          <button class="chip" id="npReset" style="padding:14px 24px">پاک کردن</button>
        </div>
      </div>
    </div>
  `;

  let imageUrl = '';
  let variants = [{ color: 'مشکی', size: 'M', stock: 5 }];

  const fileInput = $('#npFile');
  $('#npUploadBtn').onclick = () => fileInput.click();
  $('#npImgPreview').onclick = () => fileInput.click();

  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('حجم فایل بیش از ۵ مگابایت', 'err'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      $('#npImgPreview').innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover">`;
    };
    reader.readAsDataURL(file);
    try {
      toast('در حال آپلود...');
      const fd = new FormData(); fd.append('file', file);
      const token = localStorage.getItem(ADMIN_TOKEN_KEY);
      const r = await fetch(API + '/api/admin/upload', { method: 'POST', headers: { 'X-Admin-Token': token }, body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'خطا');
      imageUrl = data.url;
      toast('عکس آپلود شد ✓');
    } catch (err) {
      toast(err.message, 'err');
      imageUrl = '';
      $('#npImgPreview').innerHTML = `<span style="color:var(--faint);font-size:12px;text-align:center;padding:10px">📸 کلیک کن<br>برای آپلود</span>`;
    }
  };

  function renderVariants() {
    const wrap = $('#npVariants');
    wrap.innerHTML = variants.map((v, i) => `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center">
        <input type="text" value="${esc(v.color)}" placeholder="رنگ" data-vi="${i}" data-vk="color" style="padding:10px 12px;background:var(--ink);border:1px solid var(--line);border-radius:10px;color:var(--text);font-size:13px">
        <input type="text" value="${esc(v.size)}" placeholder="سایز" data-vi="${i}" data-vk="size" style="padding:10px 12px;background:var(--ink);border:1px solid var(--line);border-radius:10px;color:var(--text);font-size:13px">
        <input type="number" value="${v.stock}" min="0" data-vi="${i}" data-vk="stock" style="padding:10px 12px;background:var(--ink);border:1px solid var(--line);border-radius:10px;color:var(--text);font-size:13px">
        <button class="del-btn" data-vdel="${i}" style="padding:10px 14px">×</button>
      </div>
    `).join('');
    wrap.querySelectorAll('input').forEach(inp => {
      inp.oninput = () => {
        const i = Number(inp.dataset.vi), k = inp.dataset.vk;
        variants[i][k] = k === 'stock' ? Number(inp.value) : inp.value;
      };
    });
    wrap.querySelectorAll('[data-vdel]').forEach(b => {
      b.onclick = () => {
        variants.splice(Number(b.dataset.vdel), 1);
        if (!variants.length) variants.push({ color: '', size: '', stock: 0 });
        renderVariants();
      };
    });
  }
  renderVariants();

  $('#npAddVariant').onclick = () => { variants.push({ color: '', size: '', stock: 0 }); renderVariants(); };

  $('#npReset').onclick = async () => {
    if (!await confirmDialog('پاک کردن', 'فرم پاک شود؟')) return;
    loadAddProduct();
  };

  $('#npSubmit').onclick = async () => {
    const err = $('#npErr');
    err.classList.remove('on');
    const showErr = (msg) => { err.textContent = msg; err.classList.add('on'); err.scrollIntoView({behavior:'smooth',block:'center'}); };

    const name = $('#npName').value.trim();
    const price = Number($('#npPrice').value);
    const compare_price = Number($('#npComparePrice').value) || null;
    const category = $('#npCategory').value;
    const tag = $('#npTag').value;
    const sort_order = Number($('#npSort').value) || 10;
    const description = $('#npDesc').value.trim();

    if (!name) return showErr('نام محصول الزامی است');
    if (!price || price <= 0) return showErr('قیمت را وارد کنید');
    if (!imageUrl) return showErr('عکس محصول را آپلود کنید');

    const cleanVariants = variants
      .map(v => ({ color: String(v.color).trim(), size: String(v.size).trim(), stock: Math.max(0, Number(v.stock) || 0) }))
      .filter(v => v.color && v.size);

    if (!cleanVariants.length) return showErr('حداقل یه رنگ و سایز با موجودی لازم است');

    const btn = $('#npSubmit');
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = '⏳ در حال ثبت...';

    try {
      await api('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify({ name, price, compare_price, category, tag, sort_order, description, image: imageUrl, variants: cleanVariants }),
      });
      toast('محصول با موفقیت اضافه شد ✓');
      await loadProducts();
      loadAddProduct();
    } catch (e) {
      showErr(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  };
}

/* ==========================================================
   6. STOCK MANAGEMENT
   ========================================================== */
async function loadStock() {
  const el = $('#panel-stock');
  el.innerHTML = '<p style="color:var(--dim)">در حال بارگذاری...</p>';
  try {
    const { products } = await api('/api/products');
    state.products = products;

    el.innerHTML = `
      <div class="filter-bar">
        <input type="text" id="stockSearch" placeholder="🔍 جستجوی محصول...">
      </div>
      <div id="stockList"></div>
    `;

    const render = (search = '') => {
      let list = products;
      if (search) {
        const q = search.toLowerCase();
        list = products.filter(p => p.name.toLowerCase().includes(q));
      }
      const container = $('#stockList');
      if (!list.length) {
        container.innerHTML = '<p style="color:var(--dim)">محصولی یافت نشد.</p>';
        return;
      }
      container.innerHTML = list.map(p => {
        const rows = p.variants.map(v => {
          const cls = v.stock === 0 ? 'out' : (v.stock <= 3 ? 'low' : '');
          const colorCls = COLOR_MAP[v.color] || 'black';
          return `
            <div class="vrow ${cls}">
              <div class="vrow__label">
                <span class="dot dot--${colorCls}"></span>
                <b>${esc(v.color)}</b><span style="color:var(--dim)">·</span><b>${esc(v.size)}</b>
                <small>(${fmtNum(v.stock)} عدد)</small>
              </div>
              <input type="number" min="1" value="1" data-pid="${p.id}" data-color="${esc(v.color)}" data-size="${esc(v.size)}">
              <div class="vrow__btns">
                <button class="plus" data-act="inc" data-pid="${p.id}" data-color="${esc(v.color)}" data-size="${esc(v.size)}">+</button>
                <button class="minus" data-act="dec" data-pid="${p.id}" data-color="${esc(v.color)}" data-size="${esc(v.size)}">−</button>
              </div>
            </div>
          `;
        }).join('');
        return `
          <div class="prod-admin">
            <div class="prod-admin__head">
              <strong>${esc(p.name)}</strong>
              <span class="price">${fmt(p.price)}</span>
            </div>
            ${rows}
          </div>
        `;
      }).join('');

      container.querySelectorAll('.vrow__btns button').forEach(b => {
        b.onclick = async () => {
          const pid = Number(b.dataset.pid);
          const input = container.querySelector(`input[data-pid="${pid}"][data-color="${b.dataset.color}"][data-size="${b.dataset.size}"]`);
          const val = Math.max(1, parseInt(input.value) || 1);
          const delta = b.dataset.act === 'inc' ? val : -val;
          try {
            await api('/api/admin/stock', { method: 'PATCH', body: JSON.stringify({ productId: pid, color: b.dataset.color, size: b.dataset.size, delta }) });
            toast('موجودی به‌روز شد ✓');
            loadStock();
            loadProducts();
          } catch (e) { toast(e.message, 'err'); }
        };
      });
    };

    render();
    const debouncedRender = debounce((v) => render(v), 250);
    $('#stockSearch').oninput = (e) => debouncedRender(e.target.value);
  } catch (e) {
    if (e.message.includes('دسترسی') || e.status === 401) adminLogout();
    else el.innerHTML = `<p style="color:var(--red)">${esc(e.message)}</p>`;
  }
}

/* ==========================================================
   7. ORDERS MANAGEMENT
   ========================================================== */
async function loadOrders() {
  const el = $('#panel-orders');
  el.innerHTML = `
    <div class="filter-bar">
      <input type="text" id="ordSearch" placeholder="🔍 جستجو (شماره، نام، موبایل)">
      <select id="ordStatus">
        <option value="">همه وضعیت‌ها</option>
        <option value="pending">در انتظار</option>
        <option value="confirmed">تایید شده</option>
        <option value="shipped">ارسال شده</option>
        <option value="delivered">تحویل شده</option>
        <option value="cancelled">لغو شده</option>
      </select>
      <button class="chip" id="ordExport">📥 CSV</button>
    </div>
    <div id="ordList"></div>
  `;

  const fetchOrders = async () => {
    const q = $('#ordSearch').value;
    const status = $('#ordStatus').value;
    const url = `/api/admin/orders?q=${encodeURIComponent(q)}&status=${status}`;
    const list = $('#ordList');
    list.innerHTML = '<p style="color:var(--dim)">در حال بارگذاری...</p>';
    try {
      const { orders } = await api(url);
      state.adminOrders = orders;
      if (!orders.length) { list.innerHTML = '<p style="color:var(--dim)">سفارشی یافت نشد.</p>'; return; }
      renderOrdersList(list, orders);
    } catch (e) {
      if (e.message.includes('دسترسی') || e.status === 401) adminLogout();
      else list.innerHTML = `<p style="color:var(--red)">${esc(e.message)}</p>`;
    }
  };

  const debouncedFetch = debounce(fetchOrders, 300);
  $('#ordSearch').oninput = debouncedFetch;
  $('#ordStatus').onchange = fetchOrders;
  $('#ordExport').onclick = async () => {
    try {
      const r = await fetch(API + '/api/admin/orders.csv', {
        headers: { 'X-Admin-Token': localStorage.getItem(ADMIN_TOKEN_KEY) },
      });
      const b = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `gshop-orders-${Date.now()}.csv`;
      a.click();
      toast('CSV دانلود شد ✓');
    } catch (e) { toast(e.message, 'err'); }
  };

  await fetchOrders();
}

function renderOrdersList(el, orders) {
  const statuses = [
    { v:'pending',   l:'در انتظار',   c:'pending' },
    { v:'confirmed', l:'تایید شده',   c:'confirmed' },
    { v:'shipped',   l:'ارسال شده',   c:'shipped' },
    { v:'delivered', l:'تحویل شده',   c:'delivered' },
    { v:'cancelled', l:'لغو شده',     c:'cancelled' },
  ];

  el.innerHTML = orders.map(o => {
    const st = statuses.find(s => s.v === o.status) || statuses[0];
    const date = new Date(o.created_at).toLocaleString('fa-IR');
    const waLink = `https://wa.me/${String(o.phone).replace(/\D/g,'')}?text=${encodeURIComponent('سلام، سفارش شما در G_SHOP به شماره ' + o.order_no)}`;
    const tgLink = `https://t.me/+98${String(o.phone).replace(/\D/g,'').replace(/^0/,'')}`;
    return `
      <div class="ocard">
        <div class="ocard__head">
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <span class="ocard__no mono">${esc(o.order_no)}</span>
            <span class="pill ${st.c}">${st.l}</span>
          </div>
          <span class="ocard__date">${esc(date)}</span>
        </div>
        <div class="ocard__cust">
          👤 <b>${esc(o.name)}</b> &nbsp;·&nbsp; 📱 <b class="mono">${esc(o.phone)}</b>
          ${o.address ? `<br><span style="color:var(--dim);font-size:12px">📍 ${esc(o.address)}</span>` : ''}
          ${o.note ? `<br><span style="color:var(--gold);font-size:12px">📝 ${esc(o.note)}</span>` : ''}
          ${o.tracking_no ? `<br><span style="color:var(--lime);font-size:12px">📦 کد رهگیری: <b class="mono">${esc(o.tracking_no)}</b></span>` : ''}
        </div>
        <div class="ocard__items">
          ${o.items.map(i => `• <b>${esc(i.name)}</b> — ${esc(i.color)} · ${esc(i.size)} · ×${fmtNum(i.qty)} = ${fmt(i.price * i.qty)}`).join('<br>')}
        </div>
        ${o.notes?.length ? `
          <div class="ocard__notes">
            <div style="color:var(--dim);font-size:11px;margin-bottom:6px;letter-spacing:.05em">یادداشت‌ها</div>
            ${o.notes.map(n => `<div class="nt">${esc(n.note)} <span style="color:var(--faint);font-size:10px">— ${esc(n.created_at)}</span></div>`).join('')}
          </div>
        ` : ''}
        <div class="ocard__foot">
          <div class="ocard__total">مجموع: <span>${fmt(o.total)}</span>${o.discount > 0 ? `<span style="color:var(--dim);font-size:12px;margin-right:10px">(تخفیف ${fmt(o.discount)})</span>` : ''}</div>
          <div class="ocard__actions">
            <a class="nt-btn" href="${waLink}" target="_blank" rel="noopener" style="text-decoration:none">💬 واتساپ</a>
            <a class="nt-btn" href="${tgLink}" target="_blank" rel="noopener" style="text-decoration:none">✈️ تلگرام</a>
            <select class="status-sel" data-no="${esc(o.order_no)}">
              ${statuses.map(s => `<option value="${s.v}" ${s.v === o.status ? 'selected' : ''}>${s.l}</option>`).join('')}
            </select>
            <button class="nt-btn" data-tracking="${esc(o.order_no)}">📦 رهگیری</button>
            <button class="nt-btn" data-note="${esc(o.order_no)}">📝 یادداشت</button>
            <button class="del-btn" data-del="${esc(o.order_no)}">🗑 حذف</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('.status-sel').forEach(sel => {
    sel.onchange = async () => {
      try {
        await api('/api/admin/orders/' + sel.dataset.no, { method: 'PATCH', body: JSON.stringify({ status: sel.value }) });
        toast('وضعیت به‌روز شد ✓');
        loadOrders();
      } catch (e) { toast(e.message, 'err'); }
    };
  });

  el.querySelectorAll('[data-del]').forEach(b => {
    b.onclick = async () => {
      if (!await confirmDialog('حذف سفارش', `سفارش ${b.dataset.del} حذف شود؟`)) return;
      try {
        await api('/api/admin/orders/' + b.dataset.del, { method: 'DELETE' });
        toast('سفارش حذف شد');
        loadOrders();
      } catch (e) { toast(e.message, 'err'); }
    };
  });

  el.querySelectorAll('[data-note]').forEach(b => {
    b.onclick = () => showNoteModal(b.dataset.note, loadOrders);
  });

  el.querySelectorAll('[data-tracking]').forEach(b => {
    b.onclick = () => showTrackingModal(b.dataset.tracking, loadOrders);
  });
}

function showNoteModal(orderNo, onDone) {
  const modal = $('#modal');
  const box = $('#modalBox');
  box.classList.remove('modal__box--wide');
  box.innerHTML = `
    <button class="close-x" id="ntmClose" style="position:absolute;top:16px;left:16px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <h2>یادداشت سفارش</h2>
    <p class="sub">${esc(orderNo)}</p>
    <div class="field"><textarea id="ntText" placeholder="مثلاً: با مشتری تماس گرفتم، ارسال فردا"></textarea></div>
    <div class="err" id="ntErr"></div>
    <button class="checkout-btn" id="ntSave">ثبت یادداشت</button>
  `;
  $('#ntmClose').onclick = () => modal.classList.remove('on');
  $('#ntSave').onclick = async () => {
    const note = $('#ntText').value.trim();
    if (!note) { $('#ntErr').textContent = 'متن الزامی است'; $('#ntErr').classList.add('on'); return; }
    try {
      await api(`/api/admin/orders/${orderNo}/notes`, { method: 'POST', body: JSON.stringify({ note }) });
      toast('یادداشت ثبت شد ✓');
      modal.classList.remove('on');
      onDone?.();
    } catch (e) { toast(e.message, 'err'); }
  };
  modal.classList.add('on');
}

function showTrackingModal(orderNo, onDone) {
  const modal = $('#modal');
  const box = $('#modalBox');
  box.classList.remove('modal__box--wide');
  const order = state.adminOrders.find(o => o.order_no === orderNo);
  box.innerHTML = `
    <button class="close-x" id="trmClose" style="position:absolute;top:16px;left:16px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <h2>کد رهگیری پستی</h2>
    <p class="sub">${esc(orderNo)}</p>
    <div class="field"><label>کد رهگیری</label><input type="text" id="trmCode" value="${esc(order?.tracking_no || '')}" placeholder="مثلاً 12345678901234567890" class="mono"></div>
    <div class="err" id="trmErr"></div>
    <button class="checkout-btn" id="trmSave">ذخیره</button>
  `;
  $('#trmClose').onclick = () => modal.classList.remove('on');
  $('#trmSave').onclick = async () => {
    const code = $('#trmCode').value.trim();
    try {
      await api('/api/admin/orders/' + orderNo, {
        method: 'PATCH',
        body: JSON.stringify({ status: order?.status || 'shipped', tracking_no: code }),
      });
      toast('کد رهگیری ثبت شد ✓');
      modal.classList.remove('on');
      onDone?.();
    } catch (e) { toast(e.message, 'err'); }
  };
  modal.classList.add('on');
}

/* ==========================================================
   8. COUPONS
   ========================================================== */
async function loadCoupons() {
  const el = $('#panel-coupons');
  el.innerHTML = '<p style="color:var(--dim)">در حال بارگذاری...</p>';
  try {
    const { coupons } = await api('/api/admin/coupons');
    el.innerHTML = `
      <div class="prod-admin" style="margin-bottom:22px">
        <div style="font-size:14px;font-weight:700;margin-bottom:14px">➕ کد جدید</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:12px">
          <input type="text" id="ncCode" placeholder="کد (مثلاً GIFT10)" style="padding:11px 14px;background:var(--ink);border:1px solid var(--line);border-radius:10px;color:var(--text);font-family:'Space Grotesk',sans-serif;letter-spacing:.05em;text-transform:uppercase">
          <select id="ncType" style="padding:11px 14px;background:var(--ink);border:1px solid var(--line);border-radius:10px;color:var(--text)">
            <option value="percent">درصدی ٪</option>
            <option value="fixed">مبلغ ثابت</option>
          </select>
          <input type="number" id="ncValue" placeholder="مقدار" min="1" style="padding:11px 14px;background:var(--ink);border:1px solid var(--line);border-radius:10px;color:var(--text)">
          <input type="number" id="ncMax" placeholder="حداکثر استفاده" min="1" style="padding:11px 14px;background:var(--ink);border:1px solid var(--line);border-radius:10px;color:var(--text)">
          <input type="number" id="ncMin" placeholder="حداقل خرید" min="0" style="padding:11px 14px;background:var(--ink);border:1px solid var(--line);border-radius:10px;color:var(--text)">
          <input type="text" id="ncLabel" placeholder="برچسب" style="padding:11px 14px;background:var(--ink);border:1px solid var(--line);border-radius:10px;color:var(--text)">
        </div>
        <button class="checkout-btn" id="ncAdd" style="padding:12px 24px;font-size:13px;width:auto">افزودن کد</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">
        ${coupons.map(c => `
          <div class="prod-admin" style="padding:18px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <span class="mono" style="font-size:18px;font-weight:700;color:var(--lime)">${esc(c.code)}</span>
              <span class="pill ${c.active ? 'delivered' : 'cancelled'}">${c.active ? 'فعال' : 'غیرفعال'}</span>
            </div>
            <div style="font-size:13px;color:var(--dim);margin-bottom:6px">${esc(c.label || '')}</div>
            <div style="font-size:12.5px;color:var(--dim);line-height:1.8">
              مقدار: <b style="color:var(--text)">${c.type === 'percent' ? nf(c.value) + '٪' : fmt(c.value)}</b><br>
              استفاده: <b style="color:var(--text)">${nf(c.uses)}${c.max_uses ? ' / ' + nf(c.max_uses) : ''}</b>
              ${c.min_total > 0 ? `<br>حداقل خرید: <b style="color:var(--text)">${fmt(c.min_total)}</b>` : ''}
            </div>
            <div style="display:flex;gap:8px;margin-top:12px">
              <button class="nt-btn" data-toggle-coupon="${esc(c.code)}" data-active="${c.active}" style="flex:1">${c.active ? 'غیرفعال' : 'فعال'}</button>
              <button class="del-btn" data-del-coupon="${esc(c.code)}">🗑</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    $('#ncAdd').onclick = async () => {
      const code = $('#ncCode').value.trim().toUpperCase();
      const type = $('#ncType').value;
      const value = parseInt($('#ncValue').value);
      const max_uses = $('#ncMax').value ? parseInt($('#ncMax').value) : null;
      const min_total = $('#ncMin').value ? parseInt($('#ncMin').value) : 0;
      const label = $('#ncLabel').value.trim();
      if (!code || !value) return toast('کد و مقدار الزامی', 'err');
      try {
        await api('/api/admin/coupons', { method: 'POST', body: JSON.stringify({ code, type, value, max_uses, min_total, label }) });
        toast('کد اضافه شد ✓');
        loadCoupons();
      } catch (e) { toast(e.message, 'err'); }
    };

    el.querySelectorAll('[data-toggle-coupon]').forEach(b => {
      b.onclick = async () => {
        const active = b.dataset.active === '1' ? 0 : 1;
        try {
          await api('/api/admin/coupons/' + b.dataset.toggleCoupon, { method: 'PATCH', body: JSON.stringify({ active }) });
          loadCoupons();
        } catch (e) { toast(e.message, 'err'); }
      };
    });

    el.querySelectorAll('[data-del-coupon]').forEach(b => {
      b.onclick = async () => {
        if (!await confirmDialog('حذف کد', `کد ${b.dataset.delCoupon} حذف شود؟`)) return;
        try {
          await api('/api/admin/coupons/' + b.dataset.delCoupon, { method: 'DELETE' });
          toast('حذف شد');
          loadCoupons();
        } catch (e) { toast(e.message, 'err'); }
      };
    });
  } catch (e) {
    if (e.message.includes('دسترسی') || e.status === 401) adminLogout();
    else el.innerHTML = `<p style="color:var(--red)">${esc(e.message)}</p>`;
  }
}

/* ==========================================================
   9. REVIEWS
   ========================================================== */
async function loadReviews() {
  const el = $('#panel-reviews');
  el.innerHTML = '<p style="color:var(--dim)">در حال بارگذاری...</p>';
  try {
    const { reviews } = await api('/api/admin/reviews');
    if (!reviews.length) { el.innerHTML = '<p style="color:var(--dim)">نظری ثبت نشده.</p>'; return; }
    el.innerHTML = reviews.map(r => `
      <div class="ocard">
        <div class="ocard__head">
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <span style="color:var(--gold);font-size:16px">${'★'.repeat(r.rating)}<span style="color:var(--faint)">${'★'.repeat(5-r.rating)}</span></span>
            <span class="pill ${r.approved ? 'delivered' : 'pending'}">${r.approved ? 'تایید شده' : 'در انتظار'}</span>
          </div>
          <span class="ocard__date">${esc(r.created_at)}</span>
        </div>
        <div class="ocard__cust"><b>${esc(r.name)}</b> روی <b>${esc(r.product_name)}</b></div>
        <div style="font-size:13px;color:var(--dim);line-height:1.8;margin-bottom:12px">${esc(r.comment)}</div>
        <div style="display:flex;gap:8px">
          <button class="nt-btn" data-approve="${r.id}" data-val="${r.approved ? 0 : 1}">${r.approved ? 'لغو تایید' : '✓ تایید'}</button>
          <button class="del-btn" data-del-review="${r.id}">🗑 حذف</button>
        </div>
      </div>
    `).join('');

    el.querySelectorAll('[data-approve]').forEach(b => {
      b.onclick = async () => {
        try {
          await api('/api/admin/reviews/' + b.dataset.approve, { method: 'PATCH', body: JSON.stringify({ approved: b.dataset.val === '1' }) });
          toast('به‌روز شد ✓');
          loadReviews();
        } catch (e) { toast(e.message, 'err'); }
      };
    });
    el.querySelectorAll('[data-del-review]').forEach(b => {
      b.onclick = async () => {
        if (!await confirmDialog('حذف نظر', 'این نظر حذف شود؟')) return;
        try {
          await api('/api/admin/reviews/' + b.dataset.delReview, { method: 'DELETE' });
          toast('حذف شد');
          loadReviews();
        } catch (e) { toast(e.message, 'err'); }
      };
    });
  } catch (e) {
    if (e.message.includes('دسترسی') || e.status === 401) adminLogout();
    else el.innerHTML = `<p style="color:var(--red)">${esc(e.message)}</p>`;
  }
}

/* ==========================================================
   10. SETTINGS PANEL
   ========================================================== */
async function loadSettingsPanel() {
  const el = $('#panel-settings');
  el.innerHTML = '<p style="color:var(--dim)">در حال بارگذاری...</p>';
  try {
    const { settings } = await api('/api/settings');

    const fields = [
      { key: 'brand_name', label: 'اسم برند', type: 'text', placeholder: 'G_SHOP' },
      { key: 'brand_tagline', label: 'شعار برند', type: 'text', placeholder: 'پوشاک اسپرت' },
      { key: 'hero_tag', label: 'تگ هیرو', type: 'text', placeholder: '● کالکشن ۲۰۲۶' },
      { key: 'hero_line1', label: 'خط اول عنوان', type: 'text', placeholder: 'G_' },
      { key: 'hero_line2', label: 'خط دوم عنوان', type: 'text', placeholder: 'SHOP' },
      { key: 'hero_lead', label: 'متن هیرو (HTML مجاز)', type: 'textarea', placeholder: 'پوشاک <strong>اسپرت</strong> ...' },
      { key: 'footer_desc', label: 'توضیح فوتر', type: 'textarea' },
      { key: 'phone', label: 'شماره تماس', type: 'tel', placeholder: '09120507960' },
      { key: 'telegram', label: 'آیدی تلگرام (بدون @)', type: 'text', placeholder: 'Alisdt98' },
      { key: 'instagram', label: 'آیدی اینستاگرام (بدون @)', type: 'text', placeholder: 'g__shop11' },
      { key: 'email', label: 'ایمیل', type: 'email' },
      { key: 'address', label: 'آدرس', type: 'text' },
      { key: 'free_shipping_threshold', label: 'حد ارسال رایگان (تومان)', type: 'number', placeholder: '1000000' },
      { key: 'shipping_tehran', label: 'هزینه ارسال (تهران/البرز/قم)', type: 'number', placeholder: '35000' },
      { key: 'shipping_middle', label: 'هزینه ارسال (استان‌های میانی)', type: 'number', placeholder: '45000' },
      { key: 'shipping_other', label: 'هزینه ارسال (سایر استان‌ها)', type: 'number', placeholder: '55000' },
      { key: 'countdown_end', label: 'تاریخ پایان شمارش معکوس', type: 'text', placeholder: '2026-12-31T23:59:59' },
      { key: 'countdown_label', label: 'متن شمارش معکوس', type: 'text' },
      { key: 'ticker_items', label: 'آیتم‌های تیکر (JSON array)', type: 'textarea', placeholder: '["متن ۱","متن ۲"]' },
    ];

    el.innerHTML = `
      <div style="max-width:900px;margin:0 auto">
        <div class="prod-admin" style="padding:28px">
          <h3 style="font-size:20px;font-weight:700;margin-bottom:6px">تنظیمات فروشگاه</h3>
          <p style="color:var(--dim);font-size:13px;margin-bottom:24px">این تنظیمات بلافاصله تو سایت اعمال می‌شن.</p>

          <div class="np-grid">
            ${fields.map(f => `
              <div class="np-field" style="${f.type === 'textarea' ? 'grid-column:1/-1' : ''}">
                <label>${esc(f.label)}</label>
                ${f.type === 'textarea'
                  ? `<textarea id="st_${f.key}" placeholder="${esc(f.placeholder || '')}">${esc(settings[f.key] || '')}</textarea>`
                  : `<input type="${f.type}" id="st_${f.key}" value="${esc(settings[f.key] || '')}" placeholder="${esc(f.placeholder || '')}">`
                }
              </div>
            `).join('')}
          </div>

          <div id="stErr" class="err"></div>
          <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap">
            <button class="checkout-btn" id="stSave" style="flex:1;min-width:200px">✓ ذخیره تنظیمات</button>
            <button class="chip" id="stReset" style="padding:14px 24px">🔄 بازخوانی</button>
          </div>
        </div>
      </div>
    `;

    $('#stReset').onclick = () => loadSettingsPanel();

    $('#stSave').onclick = async () => {
      const err = $('#stErr');
      err.classList.remove('on');
      const payload = {};
      fields.forEach(f => {
        const el = $('#st_' + f.key);
        if (el) payload[f.key] = el.value.trim();
      });

      // Validate ticker JSON
      if (payload.ticker_items) {
        try { JSON.parse(payload.ticker_items); }
        catch { err.textContent = 'ticker_items باید آرایه JSON معتبر باشد'; err.classList.add('on'); return; }
      }

      const btn = $('#stSave');
      btn.disabled = true;
      btn.textContent = '⏳ در حال ذخیره...';
      try {
        await api('/api/admin/settings', { method: 'POST', body: JSON.stringify(payload) });
        state.settings = { ...state.settings, ...payload };
        localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(state.settings));
        applySettings();
        toast('تنظیمات ذخیره شد ✓');
      } catch (e) {
        err.textContent = e.message;
        err.classList.add('on');
      } finally {
        btn.disabled = false;
        btn.textContent = '✓ ذخیره تنظیمات';
      }
    };
  } catch (e) {
    if (e.message.includes('دسترسی') || e.status === 401) adminLogout();
    else el.innerHTML = `<p style="color:var(--red)">${esc(e.message)}</p>`;
  }
}

/* ==========================================================
   11. AUDIT LOG
   ========================================================== */
async function loadAudit() {
  const el = $('#panel-audit');
  el.innerHTML = '<p style="color:var(--dim)">در حال بارگذاری...</p>';
  try {
    const { logs } = await api('/api/admin/audit');
    if (!logs.length) { el.innerHTML = '<p style="color:var(--dim)">لاگی وجود ندارد.</p>'; return; }
    el.innerHTML = `
      <div style="background:var(--ink-1);border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden">
        <div style="display:grid;grid-template-columns:1fr 1fr 1.5fr 1fr;padding:14px 18px;background:var(--ink-2);font-size:12px;font-weight:700;color:var(--dim);letter-spacing:.05em">
          <span>اکشن</span><span>هدف</span><span>توضیحات</span><span>زمان</span>
        </div>
        ${logs.map(l => `
          <div style="display:grid;grid-template-columns:1fr 1fr 1.5fr 1fr;padding:12px 18px;font-size:12.5px;border-top:1px solid var(--line);align-items:center">
            <span class="mono" style="color:var(--lime)">${esc(l.action)}</span>
            <span style="color:var(--text)">${esc(l.target || '-')}</span>
            <span style="color:var(--dim);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((l.payload || '').slice(0, 60))}</span>
            <span class="mono" style="color:var(--dim);font-size:11px">${esc(l.created_at)}</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch (e) {
    if (e.message.includes('دسترسی') || e.status === 401) adminLogout();
    else el.innerHTML = `<p style="color:var(--red)">${esc(e.message)}</p>`;
  }
}

/* ==========================================================
   BIND ADMIN GLOBAL BUTTONS
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const openAdminBtn = $('#openAdmin');
  const closeAdminBtn = $('#closeAdmin');
  const adminLogoutBtn = $('#adminLogout');
  if (openAdminBtn) openAdminBtn.onclick = openAdmin;
  if (closeAdminBtn) closeAdminBtn.onclick = closeAdmin;
  if (adminLogoutBtn) adminLogoutBtn.onclick = adminLogout;
});

if (document.readyState !== 'loading') {
  const openAdminBtn = $('#openAdmin');
  const closeAdminBtn = $('#closeAdmin');
  const adminLogoutBtn = $('#adminLogout');
  if (openAdminBtn) openAdminBtn.onclick = openAdmin;
  if (closeAdminBtn) closeAdminBtn.onclick = closeAdmin;
  if (adminLogoutBtn) adminLogoutBtn.onclick = adminLogout;
}