const fallbackSalesRows = [
  { title: "Свитер", cost: 35.16, count: 2, date: "2026-01-01" },
  { title: "Юбка", cost: 32.23, count: 4, date: "2026-01-01" },
  { title: "Рубашка", cost: 38.52, count: 1, date: "2026-01-01" },
  { title: "Платье", cost: 77.34, count: 1, date: "2026-01-01" },
  { title: "Куртка", cost: 119.29, count: 3, date: "2026-01-01" },
  { title: "Куртка", cost: 61.02, count: 5, date: "2026-01-02" },
  { title: "Шорты", cost: 26.58, count: 2, date: "2026-01-02" },
  { title: "Платье", cost: 61.16, count: 5, date: "2026-01-02" },
  { title: "Свитер", cost: 88.87, count: 5, date: "2026-01-02" },
  { title: "Спортивный костюм", cost: 51.86, count: 3, date: "2026-01-02" },
  { title: "Шорты", cost: 17.64, count: 3, date: "2026-01-03" },
  { title: "Пальто", cost: 106.68, count: 5, date: "2026-01-03" },
  { title: "Рубашка", cost: 21.76, count: 5, date: "2026-01-03" },
  { title: "Платье", cost: 30.82, count: 5, date: "2026-01-03" },
  { title: "Пальто", cost: 160.42, count: 2, date: "2026-01-03" },
  { title: "Джинсы", cost: 66.0, count: 4, date: "2026-01-04" },
  { title: "Платье", cost: 42.94, count: 4, date: "2026-01-04" },
  { title: "Футболка", cost: 21.36, count: 3, date: "2026-01-04" },
  { title: "Футболка", cost: 23.6, count: 3, date: "2026-01-04" },
  { title: "Джинсы", cost: 56.49, count: 1, date: "2026-01-04" },
  { title: "Свитер", cost: 78.45, count: 5, date: "2026-01-05" },
  { title: "Спортивный костюм", cost: 57.07, count: 2, date: "2026-01-05" },
];

const fallbackChartData = {
  youtubeViews: [12420, 13180, 12760, 13990, 14120, 14830, 15210, 14720, 15940, 16610, 17400, 18940],
  youtubeSubscribers: [82, 94, 88, 101, 97, 113, 122, 118, 136, 149, 171, 212],
};

const fallbackTelegramPosts = [
  {
    channel: "YouTube Creator RU",
    title: "Как поднять удержание на первых 30 секундах",
    time: "10:42",
    excerpt: "Смена структуры вступления дала +14% к retention. В посте: 5 шаблонов сильного хука...",
    body: `Смена структуры вступления дала +14% к retention.

Тестовый сценарий:
1) Боль аудитории в первом предложении.
2) Обещание результата за ролик.
3) Короткий план из 2-3 пунктов.

В конце добавили CTA на подписку и карточку на следующее видео.`,
    url: null,
  },
  {
    channel: "Ecom Analytics",
    title: "Когортный анализ продаж без BI",
    time: "09:15",
    excerpt: "Показываем как вести weekly когорты в Google Sheets и считать LTV по сегментам...",
    body: `Показываем как вести weekly когорты в Google Sheets и считать LTV по сегментам.

Нужные столбцы:
- дата первой покупки
- источник
- количество повторов

Шаблон таблицы приложен в закрепе.`,
    url: null,
  },
  {
    channel: "Telegram Product Notes",
    title: "3 механики для роста канала в феврале",
    time: "Вчера",
    excerpt: "Комбинация: экспертный пост + голосование + короткий кейс. Удержание аудитории выше...",
    body: `Комбинация: экспертный пост + голосование + короткий кейс.

Практика за 2 недели:
- рост ER на 11%
- рост переходов на сайт на 8%

Главное: фиксировать тему поста и формат в отдельной таблице, чтобы видеть повторяемые паттерны.`,
    url: null,
  },
];

const state = {
  salesRows: [...fallbackSalesRows],
  dayData: getSalesByDay(fallbackSalesRows),
  chartData: { ...fallbackChartData },
  telegramPosts: [...fallbackTelegramPosts],
  dashboard: null,
};

const API_BASE_URL = getApiBaseUrl();

function getApiBaseUrl() {
  const meta = document.querySelector('meta[name="dashboard-api-base-url"]');
  const fromMeta = meta?.getAttribute("content")?.trim();
  const fromWindow = window.DASHBOARD_API_BASE_URL?.trim?.();
  const value = fromMeta || fromWindow || "";
  return value.replace(/\/+$/, "");
}

function buildApiUrl(path) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

function fmtNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function fmtMoney(value) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLabel(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US");
}

function amountForRow(row) {
  return row.cost * row.count;
}

function getSalesByDay(rows) {
  const byDay = new Map();
  rows.forEach((row) => {
    if (!byDay.has(row.date)) {
      byDay.set(row.date, { date: row.date, amount: 0, count: 0 });
    }
    const item = byDay.get(row.date);
    item.amount += amountForRow(row);
    item.count += row.count;
  });
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateLastDays(dayData, days) {
  if (dayData.length === 0) {
    return [];
  }
  return dayData.slice(-days);
}

function buildMiniChart(container, values, color) {
  if (!values.length) {
    container.innerHTML = "";
    return;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values.map((value, i) => {
    const x = values.length === 1 ? 50 : (i / (values.length - 1)) * 100;
    const y = 30 - ((value - min) / range) * 24;
    return `${x},${y}`;
  });
  const area = [`0,30`, ...points, `100,30`].join(" ");
  const gradientId = `g-${container.dataset.chart}`;

  container.innerHTML = `
    <svg viewBox="0 0 100 30" preserveAspectRatio="none">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.34"></stop>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      <polyline points="${area}" fill="url(#${gradientId})"></polyline>
      <polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="1.8"></polyline>
    </svg>
  `;
}

function renderSalesCard(dayData) {
  const apiTotals = state.dashboard?.sales?.totals;
  const apiTrend = state.dashboard?.sales?.trendPct;

  const total = typeof apiTotals?.month?.amount === "number"
    ? apiTotals.month.amount
    : dayData.reduce((sum, item) => sum + item.amount, 0);

  const trend = typeof apiTrend === "number" ? apiTrend : 0;
  const trendSign = trend >= 0 ? "▲" : "▼";

  document.getElementById("totalRevenue").textContent = fmtMoney(total);
  document.getElementById("salesTrend").textContent = `${trendSign} ${Math.abs(trend).toFixed(1)}% vs прошлый период`;

  const barHost = document.getElementById("salesBars");
  const maxAmount = Math.max(1, ...dayData.map((d) => d.amount));
  barHost.innerHTML = "";
  dayData.slice(-12).forEach((day, index, source) => {
    const bar = document.createElement("div");
    const height = Math.max(18, (day.amount / maxAmount) * 100);
    bar.className = index === source.length - 1 ? "bar active" : "bar";
    bar.style.height = `${height}%`;
    bar.title = `${day.date}: ${fmtMoney(day.amount)}`;
    barHost.appendChild(bar);
  });
}

function renderSalesTable(rows) {
  const body = document.getElementById("salesTableBody");
  body.innerHTML = "";
  rows.slice(0, 7).forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.title}</td>
      <td>${dateLabel(row.date)}</td>
      <td>${row.count}</td>
      <td>${fmtMoney(amountForRow(row))}</td>
    `;
    body.appendChild(tr);
  });
}

function renderMetrics(dayData) {
  const today = aggregateLastDays(dayData, 1);
  const week = aggregateLastDays(dayData, 7);
  const month = aggregateLastDays(dayData, 30);

  const fallbackCountToday = today.reduce((sum, item) => sum + item.count, 0);
  const fallbackCountWeek = week.reduce((sum, item) => sum + item.count, 0);
  const fallbackCountMonth = month.reduce((sum, item) => sum + item.count, 0);

  const fallbackAmountToday = today.reduce((sum, item) => sum + item.amount, 0);
  const fallbackAmountWeek = week.reduce((sum, item) => sum + item.amount, 0);
  const fallbackAmountMonth = month.reduce((sum, item) => sum + item.amount, 0);

  const salesTotals = state.dashboard?.sales?.totals;
  const youtubeTotals = state.dashboard?.youtube?.totals;

  const countToday = salesTotals?.today?.count ?? fallbackCountToday;
  const countWeek = salesTotals?.week?.count ?? fallbackCountWeek;
  const countMonth = salesTotals?.month?.count ?? fallbackCountMonth;

  const amountToday = salesTotals?.today?.amount ?? fallbackAmountToday;
  const amountWeek = salesTotals?.week?.amount ?? fallbackAmountWeek;
  const amountMonth = salesTotals?.month?.amount ?? fallbackAmountMonth;

  const ytViewsSeries = state.chartData.youtubeViews;
  const ytSubsSeries = state.chartData.youtubeSubscribers;

  const ytViewsToday = youtubeTotals?.views?.today ?? ytViewsSeries.at(-1) ?? 0;
  const ytViewsWeek = youtubeTotals?.views?.week ?? ytViewsSeries.slice(-7).reduce((a, b) => a + b, 0);
  const ytViewsMonth = youtubeTotals?.views?.month ?? ytViewsSeries.slice(-30).reduce((a, b) => a + b, 0);

  const ytSubsToday = youtubeTotals?.subscribers?.today ?? ytSubsSeries.at(-1) ?? 0;
  const ytSubsWeek = youtubeTotals?.subscribers?.week ?? ytSubsSeries.slice(-7).reduce((a, b) => a + b, 0);
  const ytSubsMonth = youtubeTotals?.subscribers?.month ?? ytSubsSeries.slice(-30).reduce((a, b) => a + b, 0);

  document.getElementById("ytViewsToday").textContent = fmtNumber(ytViewsToday);
  document.getElementById("ytViewsWeek").textContent = fmtNumber(ytViewsWeek);
  document.getElementById("ytViewsMonth").textContent = fmtNumber(ytViewsMonth);

  document.getElementById("ytSubsToday").textContent = `+${fmtNumber(ytSubsToday)}`;
  document.getElementById("ytSubsWeek").textContent = `+${fmtNumber(ytSubsWeek)}`;
  document.getElementById("ytSubsMonth").textContent = `+${fmtNumber(ytSubsMonth)}`;

  document.getElementById("salesCountToday").textContent = fmtNumber(countToday);
  document.getElementById("salesCountWeek").textContent = fmtNumber(countWeek);
  document.getElementById("salesCountMonth").textContent = fmtNumber(countMonth);

  document.getElementById("salesAmountToday").textContent = fmtMoney(amountToday);
  document.getElementById("salesAmountWeek").textContent = fmtMoney(amountWeek);
  document.getElementById("salesAmountMonth").textContent = fmtMoney(amountMonth);

  const apiTop = state.dashboard?.sales?.topProduct;
  if (apiTop && apiTop.name) {
    document.getElementById("topProductName").textContent = apiTop.name;
    document.getElementById("topProductStats").innerHTML =
      `Продано: <strong>${fmtNumber(apiTop.count)}</strong> • Выручка: <strong>${fmtMoney(apiTop.amount)}</strong>`;
  } else {
    const byProduct = new Map();
    state.salesRows.forEach((row) => {
      if (!byProduct.has(row.title)) {
        byProduct.set(row.title, { count: 0, amount: 0 });
      }
      const item = byProduct.get(row.title);
      item.count += row.count;
      item.amount += amountForRow(row);
    });
    const sorted = [...byProduct.entries()].sort((a, b) => b[1].count - a[1].count);
    const top = sorted[0];
    if (top) {
      const [name, stats] = top;
      document.getElementById("topProductName").textContent = name;
      document.getElementById("topProductStats").innerHTML =
        `Продано: <strong>${fmtNumber(stats.count)}</strong> • Выручка: <strong>${fmtMoney(stats.amount)}</strong>`;
    }
  }

  const salesCountSeries = dayData.slice(-30).map((d) => d.count);
  const salesAmountSeries = dayData.slice(-30).map((d) => Math.round(d.amount));
  const seriesMap = {
    youtubeViews: ytViewsSeries.slice(-30),
    youtubeSubscribers: ytSubsSeries.slice(-30),
    salesCount: salesCountSeries,
    salesAmount: salesAmountSeries,
  };

  document.querySelectorAll("[data-chart]").forEach((chartHost) => {
    const key = chartHost.dataset.chart;
    const color = key.includes("sales") ? "#2b58de" : "#ff7e5f";
    buildMiniChart(chartHost, seriesMap[key] || [], color);
  });
}

function renderTelegramPosts() {
  const list = document.getElementById("telegramList");
  const template = document.getElementById("telegramItemTemplate");
  const dialog = document.getElementById("postDialog");
  const dialogTitle = document.getElementById("dialogTitle");
  const dialogChannel = document.getElementById("dialogChannel");
  const dialogBody = document.getElementById("dialogBody");
  const badge = document.querySelector(".section-telegram .badge");

  if (badge) {
    badge.textContent = `${state.telegramPosts.length} post`;
  }

  list.innerHTML = "";
  state.telegramPosts.forEach((post) => {
    const node = template.content.cloneNode(true);
    node.querySelector(".chat-author").textContent = post.channel;
    node.querySelector(".chat-time").textContent = post.time;
    node.querySelector(".chat-title").textContent = post.title;
    node.querySelector(".chat-preview").textContent = post.excerpt;
    node.querySelector(".chat-open").addEventListener("click", () => {
      dialogTitle.textContent = post.title;
      dialogChannel.textContent = post.channel;
      dialogBody.textContent = post.body;
      dialog.showModal();
      if (post.url) {
        dialogChannel.innerHTML = `<a href="${post.url}" target="_blank" rel="noopener noreferrer">${post.channel}</a>`;
      }
    });
    list.appendChild(node);
  });
}

function renderUtilityDateTime() {
  const dateNode = document.getElementById("utilityDate");
  const timeNode = document.getElementById("utilityTime");
  if (!dateNode || !timeNode) return;

  const update = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    dateNode.textContent = `${day}-${month}-${year}`;
    timeNode.textContent = now.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  update();
  setInterval(update, 1000);
}

function syncRightColumnHeight() {
  const salesPanel = document.querySelector(".section-main");
  const rightStack = document.querySelector(".section-right-stack");
  const utilityPanel = document.querySelector(".section-utility");
  const telegramPanel = document.querySelector(".section-telegram");
  if (!salesPanel || !rightStack || !utilityPanel || !telegramPanel) return;

  const totalHeight = Math.round(salesPanel.getBoundingClientRect().height);
  rightStack.style.height = `${totalHeight}px`;

  const gap = parseFloat(getComputedStyle(rightStack).rowGap || "0");
  const utilityHeight = Math.round(utilityPanel.getBoundingClientRect().height);
  const telegramHeight = Math.max(180, totalHeight - utilityHeight - gap);
  telegramPanel.style.height = `${telegramHeight}px`;
}

function renderAll() {
  renderSalesCard(state.dayData);
  renderSalesTable([...state.salesRows].reverse());
  renderMetrics(state.dayData);
  renderTelegramPosts();
  syncRightColumnHeight();
}

function parseNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function setStateFromApi(payload) {
  state.dashboard = payload || null;

  const salesRows = payload?.sales?.rows;
  if (Array.isArray(salesRows) && salesRows.length) {
    state.salesRows = salesRows
      .map((row) => ({
        title: String(row.title ?? ""),
        cost: parseNumber(row.cost, 0),
        count: Math.max(0, Math.round(parseNumber(row.count, 0))),
        date: String(row.date ?? ""),
      }))
      .filter((row) => row.title && row.date);
  }

  const daily = payload?.sales?.daily;
  if (Array.isArray(daily) && daily.length) {
    state.dayData = daily
      .map((row) => ({
        date: String(row.date ?? ""),
        amount: parseNumber(row.amount, 0),
        count: Math.max(0, Math.round(parseNumber(row.count, 0))),
      }))
      .filter((row) => row.date);
  } else {
    state.dayData = getSalesByDay(state.salesRows);
  }

  const youtubeDaily = payload?.youtube?.daily;
  if (Array.isArray(youtubeDaily) && youtubeDaily.length) {
    state.chartData.youtubeViews = youtubeDaily.map((row) => parseNumber(row.viewsDelta, 0));
    state.chartData.youtubeSubscribers = youtubeDaily.map((row) => parseNumber(row.subscribersDelta, 0));
  }

  const telegramPosts = payload?.telegram?.posts;
  if (Array.isArray(telegramPosts)) {
    state.telegramPosts = telegramPosts.map((post) => {
      const createdAt = post.createdAt ? new Date(post.createdAt) : null;
      const time = createdAt && !Number.isNaN(createdAt.getTime())
        ? createdAt.toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" })
        : "—";
      return {
        channel: String(post.channel ?? "Telegram"),
        title: String(post.title ?? "Пост"),
        excerpt: String(post.excerpt ?? ""),
        body: String(post.body ?? ""),
        time,
        url: post.url ? String(post.url) : null,
      };
    });
  }
}

async function requestJson(path, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    headers: { Accept: "application/json" },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${path} failed: ${response.status} ${text}`);
  }
  return response.json();
}

async function loadDashboardFromApi() {
  const payload = await requestJson("/api/dashboard");
  setStateFromApi(payload);
  renderAll();
}

async function refreshAllFromApi(button) {
  const originalDisabled = button.disabled;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");

  try {
    await requestJson("/api/refresh-all", { method: "POST" });
    await loadDashboardFromApi();
  } finally {
    button.disabled = originalDisabled;
    button.removeAttribute("aria-busy");
  }
}

function wireRefreshButton() {
  const refreshButton = document.querySelector(".utility-refresh-button");
  if (!refreshButton) return;
  refreshButton.addEventListener("click", async () => {
    try {
      await refreshAllFromApi(refreshButton);
    } catch (error) {
      console.error("Refresh failed", error);
    }
  });
}

async function bootstrap() {
  renderAll();
  wireRefreshButton();
  renderUtilityDateTime();
  window.addEventListener("resize", syncRightColumnHeight);

  try {
    await loadDashboardFromApi();
  } catch (error) {
    console.error("API is not available, fallback data is used", error);
  }
}

bootstrap();
