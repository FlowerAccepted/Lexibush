const state = {
  words: [],
  affixes: [],
  stats: {},
  importFormat: {
    words: "auto",
    affixes: "auto",
  },
  activeTabIndex: 0,
  trendMetric: "words",
  trendPoints: [],
};

const SETTINGS_KEY = "lexibush-settings";
const DEFAULT_SETTINGS = {
  mode: "system",
  style: "forest",
  scale: "1",
  uiFont: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  contentFont: "ui-serif, Georgia, Cambria, Times New Roman, serif",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

initSettings();
initMeaningRows();
bindEvents();
refresh().then(loadArchives).catch((error) => toast(error.message));

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 2600);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || "请求失败");
  return data;
}

async function refresh() {
  const data = await api("/api/data");
  state.words = data.words;
  state.affixes = data.affixes;
  state.stats = data.stats;
  renderOverview();
  renderWords(state.words);
  renderAffixes();
  renderStats();
}

function renderOverview() {
  $("#total-words").textContent = state.stats.totalWords || 0;
  $("#total-phrases").textContent = state.stats.phrases || 0;
  $("#total-affixes").textContent = state.stats.totalAffixes || 0;
}

function renderMeanings(meaning = {}) {
  return Object.entries(meaning)
    .map(([pos, text]) => `
      <div class="meaning-row readonly">
        <span class="pos">${escapeHtml(pos || "释义")}</span>
        <span>${escapeHtml(text)}</span>
      </div>
    `)
    .join("");
}

function renderWords(words) {
  const list = $("#word-list");
  if (!list) return;
  const filter = $("#word-list-filter")?.value?.trim().toLowerCase() || "";
  const visible = filter
    ? words.filter((entry) => entry.word.toLowerCase().includes(filter))
    : words;

  list.innerHTML = visible
    .slice()
    .sort((left, right) => left.word.localeCompare(right.word, "en", { sensitivity: "base" }))
    .map(renderWordCard)
    .join("") || `<p>没有可显示的词条。</p>`;
}

function renderWordCard(entry) {
  const tags = (entry.tags || []).map((tag) => `<span class="chip tiny">${escapeHtml(tag)}</span>`).join("");
  return `
    <article class="card">
      <div class="card-head">
        <h3>${escapeHtml(entry.word)}</h3>
        <button class="ghost delete-word" data-word="${escapeAttr(entry.word)}">删除</button>
      </div>
      ${renderMeanings(entry.meaning)}
      ${entry.notes ? `<p>${escapeHtml(entry.notes)}</p>` : ""}
      ${tags ? `<div class="chips">${tags}</div>` : ""}
      <p class="meta">加入：${formatDate(entry.added_at)}</p>
    </article>
  `;
}

function renderAffixes() {
  const list = $("#affix-list");
  if (!list) return;
  list.innerHTML = state.affixes
    .slice()
    .sort((left, right) => left.affix.localeCompare(right.affix, "en", { sensitivity: "base" }))
    .map((entry) => `
      <span class="chip" title="${escapeAttr(entry.meanings.join("; "))}">
        <b>${escapeHtml(entry.affix)}</b> · ${escapeHtml(typeName(entry.type))} · ${escapeHtml(entry.meanings.join("；"))}
        <button class="ghost delete-affix" data-affix="${escapeAttr(entry.affix)}">×</button>
      </span>
    `)
    .join("") || `<p>暂无词根词缀。</p>`;
}

function renderStats() {
  drawGrowth();
  drawBars();
  drawWeeklyHeatmap();
  renderDateStats();
}

function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(520, Math.round(rect.width || canvas.parentElement?.clientWidth || Number(canvas.dataset.cssWidth) || 760));
  const height = Math.max(260, Math.round(rect.height || Number(canvas.dataset.cssHeight) || 300));
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  canvas.dataset.dpr = String(dpr);
  canvas.dataset.cssWidth = String(width);
  canvas.dataset.cssHeight = String(height);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height, dpr };
}

function drawGrowth() {
  const canvas = $("#growth-chart");
  if (!canvas) return;
  const { ctx, width, height, dpr } = prepareCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const daily = state.trendMetric === "affixes" ? state.stats.dailyAffixes || {} : state.stats.dailyWords || {};
  const title = state.trendMetric === "affixes" ? "累计词根词缀增长" : "累计词条增长";
  const days = Object.keys(daily).sort();
  const values = [];
  let sum = 0;
  for (const day of days) {
    sum += daily[day];
    values.push([day, sum]);
  }
  state.trendPoints = [];
  ctx.strokeStyle = cssVar("--accent");
  ctx.lineWidth = 3;
  ctx.fillStyle = cssVar("--text");
  ctx.font = "600 16px system-ui";
  ctx.fillText(title, 20, 30);
  if (!values.length) {
    ctx.fillText("暂无数据", 20, 68);
    return;
  }
  const pad = 48;
  const max = Math.max(...values.map((item) => item[1]), 1);
  const chartWidth = width - pad * 2;
  const chartHeight = height - pad * 2;

  ctx.strokeStyle = colorMix(cssVar("--muted"), 0.22);
  ctx.lineWidth = 1;
  ctx.fillStyle = cssVar("--muted");
  ctx.font = "12px system-ui";
  for (let i = 0; i <= 4; i += 1) {
    const ratio = i / 4;
    const y = height - pad - ratio * chartHeight;
    const value = Math.round(max * ratio);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
    ctx.fillText(String(value), 14, y + 4);
  }

  ctx.strokeStyle = colorMix(cssVar("--text"), 0.32);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, height - pad);
  ctx.lineTo(width - pad, height - pad);
  ctx.stroke();

  ctx.strokeStyle = cssVar("--accent");
  ctx.lineWidth = 3.4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  values.forEach(([day, value], index) => {
    const x = pad + (index / Math.max(values.length - 1, 1)) * chartWidth;
    const y = height - pad - (value / max) * chartHeight;
    state.trendPoints.push({ day, value, x, y });
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = cssVar("--accent-2");
  const pointStep = Math.max(1, Math.ceil(state.trendPoints.length / 60));
  for (const [index, point] of state.trendPoints.entries()) {
    if (index % pointStep !== 0 && index !== state.trendPoints.length - 1) continue;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const labelIndexes = [0, Math.floor((values.length - 1) / 2), values.length - 1].filter((value, index, array) => value >= 0 && array.indexOf(value) === index);
  ctx.fillStyle = cssVar("--muted");
  ctx.font = "11px system-ui";
  for (const index of labelIndexes) {
    const point = state.trendPoints[index];
    if (!point) continue;
    const text = point.day.slice(5);
    ctx.fillText(text, Math.min(width - pad - 34, Math.max(pad - 2, point.x - 16)), height - 18);
  }
}

function drawGrowthHover(point) {
  drawGrowth();
  if (!point) return;
  const canvas = $("#growth-chart");
  const ctx = canvas.getContext("2d");
  const dpr = Number(canvas.dataset.dpr || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const height = Number(canvas.dataset.cssHeight || canvas.height / dpr);
  ctx.save();
  ctx.strokeStyle = colorMix(cssVar("--accent-2"), 0.72);
  ctx.lineWidth = 1.4;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(point.x, 48);
  ctx.lineTo(point.x, height - 48);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = cssVar("--panel-strong");
  ctx.strokeStyle = cssVar("--accent-2");
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBars() {
  const data = state.stats.byPartOfSpeech || {};
  const max = Math.max(...Object.values(data), 1);
  $("#pos-chart").innerHTML = `<h3>词性分布</h3>` + Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .map(([pos, count]) => `
      <div class="bar">
        <span>${escapeHtml(pos)}</span>
        <span style="width:${Math.max(6, (count / max) * 100)}%"></span>
        <b>${count}</b>
      </div>
    `)
    .join("");
}

function renderDateStats() {
  const box = $("#date-stats");
  if (!box) return;
  const { words, affixes } = getExportSelection();
  const daily = new Map();
  for (const entry of words) {
    const day = dayFromEntry(entry);
    daily.set(day, { ...(daily.get(day) || { words: 0, affixes: 0 }), words: (daily.get(day)?.words || 0) + 1 });
  }
  for (const entry of affixes) {
    const day = dayFromEntry(entry);
    daily.set(day, { ...(daily.get(day) || { words: 0, affixes: 0 }), affixes: (daily.get(day)?.affixes || 0) + 1 });
  }
  const rows = Array.from(daily.entries()).sort(([left], [right]) => left.localeCompare(right));
  box.innerHTML = `
    <div class="stat-summary">
      <span><b>${words.length}</b> 词条</span>
      <span><b>${affixes.length}</b> 词根词缀</span>
      <span><b>${rows.length}</b> 天</span>
    </div>
    <div class="date-table">
      ${rows.map(([day, counts]) => `
        <div class="date-row">
          <span>${escapeHtml(day)}</span>
          <span>词条 ${counts.words || 0}</span>
          <span>词根词缀 ${counts.affixes || 0}</span>
        </div>
      `).join("") || `<p>该日期范围内暂无数据。</p>`}
    </div>
  `;
}

function drawWeeklyHeatmap() {
  const daily = state.stats.dailyWords || {};
  const today = startOfLocalDay(new Date());
  const start = new Date(today);
  start.setDate(today.getDate() - 179);
  const sunday = new Date(start);
  sunday.setDate(start.getDate() - start.getDay());

  const weeks = [];
  for (let cursor = new Date(sunday); cursor <= today; cursor.setDate(cursor.getDate() + 7)) {
    const week = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + dayIndex);
      if (date >= start && date <= today) week.push(toDateKey(date));
      else week.push("");
    }
    weeks.push(week);
  }

  const max = Math.max(...Object.values(daily), 1);
  const dayLabels = ["日", "一", "二", "三", "四", "五", "六"];
  $("#heatmap").innerHTML = `
    <div id="heatmap-tooltip" class="heatmap-tooltip"></div>
    <div class="heatmap-labels">${dayLabels.map((label) => `<span>${label}</span>`).join("")}</div>
    <div class="heatmap-weeks">
      ${weeks.map((week) => `
        <div class="heatmap-week">
          ${week.map((day) => {
            if (!day) return `<span class="cell empty"></span>`;
            const count = daily[day] || 0;
            const level = count === 0 ? 0 : Math.ceil((count / max) * 4);
            return `<span class="cell level-${level}" title="${day}: ${count}" data-tip="${day}：${count} 个词条"></span>`;
          }).join("")}
        </div>
      `).join("")}
    </div>
  `;
  bindHeatmapTooltip();
}

function bindHeatmapTooltip() {
  const tooltip = $("#heatmap-tooltip");
  if (!tooltip) return;
  $$("#heatmap .cell[data-tip]").forEach((cell) => {
    cell.addEventListener("mouseenter", (event) => {
      tooltip.textContent = event.currentTarget.dataset.tip;
      tooltip.classList.add("show");
    });
    cell.addEventListener("mousemove", (event) => {
      tooltip.style.left = `${event.clientX + 12}px`;
      tooltip.style.top = `${event.clientY + 12}px`;
    });
    cell.addEventListener("mouseleave", () => {
      tooltip.classList.remove("show");
    });
  });
}

async function doSearch(mode) {
  const input = $(`[data-search-input="${mode}"]`);
  const data = await api(`/api/search?q=${encodeURIComponent(input.value)}&mode=${encodeURIComponent(mode)}`);
  $("#search-results").innerHTML = data.results.map(renderWordCard).join("") || `<p>没有找到匹配词条。</p>`;
}

async function doJump(direction) {
  const input = $(`[data-jump-input="${direction}"]`);
  const data = await api(`/api/fail?word=${encodeURIComponent(input.value)}&direction=${direction}`);
  $("#jump-results").innerHTML = data.results.map((item) => `
    <article class="card">
      <h3>${escapeHtml(item.matched)}</h3>
      <p>差异部分：<b>${escapeHtml(item.difference || "无")}</b></p>
      <p>${item.affix ? `已知词根词缀：${escapeHtml(item.affix.meanings.join("；"))}` : "建议加入词根词缀库。"}</p>
    </article>
  `).join("") || `<p>没有找到跳转链。</p>`;
}

async function lookupDictionary() {
  const word = new FormData($("#word-form")).get("word");
  if (!word) return toast("请先输入词条");
  toast("正在查词典……");
  const data = await api(`/api/dictionary?word=${encodeURIComponent(word)}`);
  setMeaningRows(data.meaning || {});
  toast(`已从 ${data.source} 填入释义`);
}

function initMeaningRows() {
  const box = $("#meaning-rows");
  if (!box) return;
  box.innerHTML = "";
  addMeaningRow("n.", "");
  addMeaningRow("v.", "");
  addMeaningRow("adj.", "");
}

function addMeaningRow(pos = "", text = "") {
  const row = document.createElement("div");
  row.className = "meaning-edit-row";
  row.innerHTML = `
    <input name="pos" placeholder="词性，如 n." value="${escapeAttr(pos)}" />
    <textarea name="definition" rows="2" placeholder="释义">${escapeHtml(text)}</textarea>
    <button type="button" class="ghost remove-meaning-row">删除</button>
  `;
  $("#meaning-rows").append(row);
}

function setMeaningRows(meaning) {
  $("#meaning-rows").innerHTML = "";
  const entries = Object.entries(meaning);
  if (!entries.length) addMeaningRow("", "");
  for (const [pos, text] of entries) addMeaningRow(pos, text);
}

function collectMeanings() {
  const meaning = {};
  for (const row of $$(".meaning-edit-row")) {
    const pos = row.querySelector('[name="pos"]').value.trim();
    const text = row.querySelector('[name="definition"]').value.trim();
    if (pos && text) meaning[pos] = text;
  }
  if (!Object.keys(meaning).length) throw new Error("至少需要一组词性和释义");
  return meaning;
}

function bindEvents() {
  bindFileDropzones();
  initTabMotion();

  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      switchMainTab(button.dataset.tab);
    });
  });

  $$(".subtab[data-subtab]").forEach((button) => {
    button.addEventListener("click", () => {
      switchSubtab(button.dataset.subtab, button.dataset.panel);
    });
  });

  $$(".subtab[data-import-format]").forEach((button) => {
    button.addEventListener("click", () => {
      const group = button.dataset.importFormat;
      state.importFormat[group] = button.dataset.format;
      $$(`.subtab[data-import-format="${group}"]`).forEach((node) => node.classList.remove("active"));
      button.classList.add("active");
      updateTabIndicator(button.closest(".subtabs"), button);
    });
  });

  $$(".subtab[data-trend-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      state.trendMetric = button.dataset.trendMetric;
      $$(".subtab[data-trend-metric]").forEach((node) => node.classList.remove("active"));
      button.classList.add("active");
      updateTabIndicator(button.closest(".subtabs"), button);
      drawGrowth();
    });
  });

  bindGrowthChartInteraction();

  $("#refresh-date-stats-btn").addEventListener("click", () => renderDateStats());
  $("#export-start").addEventListener("change", () => renderDateStats());
  $("#export-end").addEventListener("change", () => renderDateStats());
  $("#export-target").addEventListener("change", () => renderDateStats());
  $("#export-md-btn").addEventListener("click", () => exportDateRange("markdown"));
  $("#export-json-btn").addEventListener("click", () => exportDateRange("json"));

  $$("[data-search-button]").forEach((button) => {
    button.addEventListener("click", () => doSearch(button.dataset.searchButton).catch((error) => toast(error.message)));
  });

  $$("[data-search-input]").forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") doSearch(input.dataset.searchInput).catch((error) => toast(error.message));
    });
  });

  $$("[data-jump-button]").forEach((button) => {
    button.addEventListener("click", () => doJump(button.dataset.jumpButton).catch((error) => toast(error.message)));
  });

  $("#add-meaning-row-btn").addEventListener("click", () => addMeaningRow("", ""));
  $("#lookup-btn").addEventListener("click", () => lookupDictionary().catch((error) => toast(error.message)));

  $("#meaning-rows").addEventListener("click", (event) => {
    const button = event.target.closest(".remove-meaning-row");
    if (!button) return;
    if ($$(".meaning-edit-row").length <= 1) return toast("至少保留一组释义");
    button.closest(".meaning-edit-row").remove();
  });

  $("#word-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/words", {
        method: "POST",
        body: JSON.stringify({
          word: form.get("word"),
          meaning: collectMeanings(),
          notes: form.get("notes"),
          tags: String(form.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      event.currentTarget.reset();
      initMeaningRows();
      await refresh();
      toast("词条已添加");
    } catch (error) {
      toast(error.message);
    }
  });

  $("#word-json-btn").addEventListener("click", async () => {
    const data = await api("/api/words", {
      method: "POST",
      body: JSON.stringify({ action: "import", input: $("#word-json-input").value, format: "json" }),
    });
    await refresh();
    toast(`导入 ${data.result.successCount} 条；错误 ${data.result.errors.length} 条`);
  });

  $("#word-import-btn").addEventListener("click", async () => {
    const data = await api("/api/words", {
      method: "POST",
      body: JSON.stringify({ action: "import", input: $("#word-import-input").value, format: state.importFormat.words }),
    });
    await refresh();
    toast(`导入 ${data.result.successCount} 条；错误 ${data.result.errors.length} 条`);
  });

  $("#word-list-filter").addEventListener("input", () => renderWords(state.words));
  $("#word-list-clear").addEventListener("click", () => {
    $("#word-list-filter").value = "";
    renderWords(state.words);
  });

  $("#affix-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/api/affixes", {
      method: "POST",
      body: JSON.stringify({ affix: form.get("affix"), type: form.get("type"), meanings: form.get("meanings") }),
    });
    event.currentTarget.reset();
    await refresh();
    toast("词根词缀已添加");
  });

  $("#seed-affixes-btn").addEventListener("click", async () => {
    const data = await api("/api/affixes", { method: "POST", body: JSON.stringify({ action: "seed" }) });
    await refresh();
    toast(`播种 ${data.count} 个基础词根词缀`);
  });

  $("#affix-import-btn").addEventListener("click", async () => {
    const data = await api("/api/affixes", {
      method: "POST",
      body: JSON.stringify({ action: "import", input: $("#affix-import-input").value, format: state.importFormat.affixes }),
    });
    await refresh();
    toast(`导入 ${data.result.successCount} 条；错误 ${data.result.errors.length} 条`);
  });

  document.body.addEventListener("click", async (event) => {
    const wordButton = event.target.closest(".delete-word");
    const affixButton = event.target.closest(".delete-affix");
    const restoreButton = event.target.closest(".restore-archive");
    if (wordButton && confirm(`删除「${wordButton.dataset.word}」？删除前会自动建立快照。`)) {
      await api("/api/words", { method: "DELETE", body: JSON.stringify({ word: wordButton.dataset.word }) });
      await refresh();
      await loadArchives();
      toast("词条已删除并建立快照");
    }
    if (affixButton && confirm(`删除「${affixButton.dataset.affix}」？删除前会自动建立快照。`)) {
      await api("/api/affixes", { method: "DELETE", body: JSON.stringify({ affix: affixButton.dataset.affix }) });
      await refresh();
      await loadArchives();
      toast("词根词缀已删除并建立快照");
    }
    if (restoreButton && confirm(`恢复到 ${restoreButton.dataset.hash.slice(0, 7)}？当前状态会先建立快照。`)) {
      await api("/api/archives", { method: "POST", body: JSON.stringify({ action: "restore", hash: restoreButton.dataset.hash }) });
      await refresh();
      await loadArchives();
      toast("已恢复快照");
    }
  });

  $("#snapshot-btn").addEventListener("click", async () => {
    await api("/api/archives", { method: "POST", body: JSON.stringify({ message: $("#archive-message").value || "Manual snapshot" }) });
    await loadArchives();
    toast("快照已建立");
  });
  $("#refresh-archives-btn").addEventListener("click", () => loadArchives().catch((error) => toast(error.message)));

  $("#download-stats-btn").addEventListener("click", () => downloadJson(state.stats, `lexibush-stats-${toDateKey(new Date())}.json`));

  $("#settings-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const settings = {
      mode: form.get("mode"),
      style: form.get("style"),
      scale: form.get("scale"),
      uiFont: form.get("uiFont") || DEFAULT_SETTINGS.uiFont,
      contentFont: form.get("contentFont") || DEFAULT_SETTINGS.contentFont,
    };
    saveSettings(settings);
    applySettings(settings);
    toast("设置已保存");
  });

  $("#reset-settings-btn").addEventListener("click", () => {
    saveSettings(DEFAULT_SETTINGS);
    applySettings(DEFAULT_SETTINGS);
    fillSettingsForm(DEFAULT_SETTINGS);
    toast("设置已重置");
  });
}

function bindGrowthChartInteraction() {
  const canvas = $("#growth-chart");
  const tooltip = $("#growth-tooltip");
  if (!canvas || !tooltip) return;

  canvas.addEventListener("mousemove", (event) => {
    if (!state.trendPoints.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const nearest = state.trendPoints.reduce((best, point) =>
      Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best,
    );
    drawGrowthHover(nearest);
    tooltip.innerHTML = `<b>${escapeHtml(nearest.day)}</b><br />累计 ${nearest.value}`;
    tooltip.classList.add("show");
    tooltip.style.left = `${event.clientX + 12}px`;
    tooltip.style.top = `${event.clientY + 12}px`;
  });

  canvas.addEventListener("mouseleave", () => {
    tooltip.classList.remove("show");
    drawGrowth();
  });
}

function initTabMotion() {
  $$(".tabs, .subtabs").forEach((nav) => {
    nav.classList.add("has-indicator");
    updateTabIndicator(nav, nav.querySelector(".active"));
    nav.addEventListener("scroll", () => updateTabIndicator(nav, nav.querySelector(".active")), { passive: true });
  });
  bindSwipeTabs();
  window.addEventListener("resize", () => {
    $$(".tabs, .subtabs").forEach((nav) => updateTabIndicator(nav, nav.querySelector(".active")));
    if ($("#tab-stats")?.classList.contains("active")) renderStats();
  });
}

function switchMainTab(tabName) {
  const tabs = $$(".tab");
  const nextButton = tabs.find((button) => button.dataset.tab === tabName);
  const nextPage = $(`#tab-${tabName}`);
  if (!nextButton || !nextPage || nextButton.classList.contains("active")) return;

  const nextIndex = tabs.indexOf(nextButton);
  const direction = nextIndex > state.activeTabIndex ? "right" : "left";
  state.activeTabIndex = nextIndex;

  $$(".tab").forEach((node) => node.classList.remove("active"));
  $$(".tab-page").forEach((node) => node.classList.remove("active", "slide-from-left", "slide-from-right"));
  nextButton.classList.add("active");
  nextPage.classList.add("active", direction === "right" ? "slide-from-right" : "slide-from-left");
  updateTabIndicator($(".tabs"), nextButton);
  nextButton.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  setTimeout(() => updateTabIndicator($(".tabs"), nextButton), 360);
  if (tabName === "stats") setTimeout(renderStats, 40);
  if (tabName === "archives") loadArchives().catch((error) => toast(error.message));
}

function switchSubtab(group, panel) {
  const buttons = $$(`.subtab[data-subtab="${group}"]`);
  const nextButton = buttons.find((button) => button.dataset.panel === panel);
  const nextPage = $(`[data-subpage="${group}-${panel}"]`);
  if (!nextButton || !nextPage || nextButton.classList.contains("active")) return;
  const currentIndex = buttons.findIndex((button) => button.classList.contains("active"));
  const nextIndex = buttons.indexOf(nextButton);
  const direction = nextIndex > currentIndex ? "right" : "left";

  buttons.forEach((node) => node.classList.remove("active"));
  $$(`[data-subpage^="${group}-"]`).forEach((node) => node.classList.remove("active", "slide-from-left", "slide-from-right"));
  nextButton.classList.add("active");
  nextPage.classList.add("active", direction === "right" ? "slide-from-right" : "slide-from-left");
  updateTabIndicator(nextButton.closest(".subtabs"), nextButton);
  nextButton.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  setTimeout(() => updateTabIndicator(nextButton.closest(".subtabs"), nextButton), 320);
}

function updateTabIndicator(nav, activeButton) {
  if (!nav || !activeButton) return;
  const navRect = nav.getBoundingClientRect();
  const activeRect = activeButton.getBoundingClientRect();
  nav.style.setProperty("--indicator-left", `${activeRect.left - navRect.left + nav.scrollLeft}px`);
  nav.style.setProperty("--indicator-width", `${activeRect.width}px`);
}

function bindSwipeTabs() {
  let startX = 0;
  let startY = 0;
  let tracking = false;
  const threshold = 64;

  document.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    if (event.target.closest("input, textarea, select, button, .heatmap")) return;
    tracking = true;
    startX = event.clientX;
    startY = event.clientY;
  });

  document.addEventListener("pointerup", (event) => {
    if (!tracking) return;
    tracking = false;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    const tabs = $$(".tab");
    const nextIndex = Math.max(0, Math.min(tabs.length - 1, state.activeTabIndex + (dx < 0 ? 1 : -1)));
    if (nextIndex !== state.activeTabIndex) switchMainTab(tabs[nextIndex].dataset.tab);
  });
}

function bindFileDropzones() {
  $$("[data-file-drop]").forEach((textarea) => {
    const wrap = textarea.closest(".drop-wrap");
    const picker = wrap?.querySelector(`[data-file-picker="${textarea.id}"]`);
    if (!wrap || !picker) return;

    wrap.querySelector(".drop-hint")?.addEventListener("click", () => {
      picker.click();
    });

    picker.addEventListener("change", async () => {
      const [file] = picker.files || [];
      if (!file) return;
      await loadFileIntoTextarea(file, textarea);
      picker.value = "";
    });

    for (const eventName of ["dragenter", "dragover"]) {
      wrap.addEventListener(eventName, (event) => {
        event.preventDefault();
        wrap.classList.add("dragging");
      });
    }

    for (const eventName of ["dragleave", "drop"]) {
      wrap.addEventListener(eventName, (event) => {
        event.preventDefault();
        if (eventName === "dragleave" && wrap.contains(event.relatedTarget)) return;
        wrap.classList.remove("dragging");
      });
    }

    wrap.addEventListener("drop", async (event) => {
      const [file] = event.dataTransfer?.files || [];
      if (!file) return;
      await loadFileIntoTextarea(file, textarea);
    });
  });
}

async function loadFileIntoTextarea(file, textarea) {
  if (file.size > 2 * 1024 * 1024) {
    toast("文件太大了，建议控制在 2MB 内");
    return;
  }
  try {
    textarea.value = await file.text();
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    toast(`已读取文件：${file.name}`);
  } catch {
    toast(`读取失败：${file.name}`);
  }
}

async function loadArchives() {
  const data = await api("/api/archives");
  $("#archive-list").innerHTML = data.archives.map((archive) => `
    <article class="card">
      <div class="card-head">
        <h3>${escapeHtml(archive.hash.slice(0, 7))}</h3>
        <button class="secondary restore-archive" data-hash="${escapeAttr(archive.hash)}">恢复</button>
      </div>
      <p>${escapeHtml(archive.message)}</p>
      <p class="meta">${formatDate(archive.date)}</p>
    </article>
  `).join("") || `<p>还没有快照。添加、删除或手动建立后会出现在这里。</p>`;
}

function initSettings() {
  const settings = loadSettings();
  applySettings(settings);
  queueMicrotask(() => fillSettingsForm(settings));
}

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function fillSettingsForm(settings) {
  const form = $("#settings-form");
  if (!form) return;
  form.elements.mode.value = settings.mode;
  form.elements.style.value = settings.style;
  form.elements.scale.value = settings.scale;
  form.elements.uiFont.value = settings.uiFont;
  form.elements.contentFont.value = settings.contentFont;
}

function applySettings(settings) {
  const root = document.documentElement;
  root.className = root.className
    .split(/\s+/)
    .filter((name) => name && !name.startsWith("theme-") && name !== "dark-theme")
    .join(" ");
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const dark = settings.mode === "dark" || (settings.mode === "system" && prefersDark);
  root.classList.add(`theme-${settings.style || "forest"}`);
  if (dark) root.classList.add("dark-theme");
  root.style.setProperty("--font-scale", settings.scale || "1");
  root.style.setProperty("--ui-font", settings.uiFont || DEFAULT_SETTINGS.uiFont);
  root.style.setProperty("--content-font", settings.contentFont || DEFAULT_SETTINGS.contentFont);
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportDateRange(format) {
  const selection = getExportSelection();
  const start = $("#export-start").value || "all";
  const end = $("#export-end").value || "all";
  const target = $("#export-target").value;
  const baseName = `lexibush-${target}-${start}_to_${end}`;
  if (format === "json") {
    downloadJson(selection, `${baseName}.json`);
    return;
  }
  downloadText(toMarkdown(selection), `${baseName}.md`, "text/markdown");
}

function getExportSelection() {
  const start = $("#export-start")?.value || "";
  const end = $("#export-end")?.value || "";
  const target = $("#export-target")?.value || "words";
  return {
    range: { start: start || null, end: end || null },
    words: target === "affixes" ? [] : state.words.filter((entry) => inDateRange(dayFromEntry(entry), start, end)).sort((left, right) => left.word.localeCompare(right.word, "en", { sensitivity: "base" })),
    affixes: target === "words" ? [] : state.affixes.filter((entry) => inDateRange(dayFromEntry(entry), start, end)).sort((left, right) => left.affix.localeCompare(right.affix, "en", { sensitivity: "base" })),
  };
}

function toMarkdown(selection) {
  const lines = ["# Lexibush 导出", ""];
  const range = `${selection.range.start || "最早"} ~ ${selection.range.end || "今天"}`;
  lines.push(`日期范围：${range}`, "");
  if (selection.words.length) {
    lines.push("## 单词 / 短语", "", "| 词条 | 释义 | 标签 | 加入日期 |", "| --- | --- | --- | --- |");
    for (const entry of selection.words) {
      lines.push(`| ${escapeMarkdownCell(entry.word)} | ${escapeMarkdownCell(formatMeaningText(entry.meaning))} | ${escapeMarkdownCell((entry.tags || []).join(", "))} | ${escapeMarkdownCell(dayFromEntry(entry))} |`);
    }
    lines.push("");
  }
  if (selection.affixes.length) {
    lines.push("## 词根词缀", "", "| 词根词缀 | 类型 | 含义 | 加入日期 |", "| --- | --- | --- | --- |");
    for (const entry of selection.affixes) {
      lines.push(`| ${escapeMarkdownCell(entry.affix)} | ${escapeMarkdownCell(typeName(entry.type))} | ${escapeMarkdownCell(entry.meanings.join("；"))} | ${escapeMarkdownCell(dayFromEntry(entry))} |`);
    }
    lines.push("");
  }
  if (!selection.words.length && !selection.affixes.length) lines.push("该日期范围内暂无数据。", "");
  return lines.join("\n");
}

function downloadText(text, filename, type = "text/plain") {
  const blob = new Blob([text], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function dayFromEntry(entry) {
  return String(entry.added_at || "").slice(0, 10) || "未知";
}

function inDateRange(day, start, end) {
  if (day === "未知") return !start && !end;
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}

function formatMeaningText(meaning = {}) {
  return Object.entries(meaning).map(([pos, text]) => `${pos || "释义"} ${text}`).join("；");
}

function escapeMarkdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function formatDate(value) {
  if (!value) return "未知";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function typeName(type) {
  return { prefix: "前缀", suffix: "后缀", root: "词根" }[type] || type;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function colorMix(color, alpha) {
  return color.startsWith("#") ? `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}` : color;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
