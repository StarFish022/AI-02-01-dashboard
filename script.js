const salesRows = [
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

const chartData = {
  youtubeViews: [12420, 13180, 12760, 13990, 14120, 14830, 15210, 14720, 15940, 16610, 17400, 18940],
  youtubeSubscribers: [82, 94, 88, 101, 97, 113, 122, 118, 136, 149, 171, 212],
};

const telegramPosts = [
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
  },
];

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
  const latest = dayData[dayData.length - 1];
  const end = new Date(latest.date);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  return dayData.filter((row) => {
    const date = new Date(row.date);
    return date >= start && date <= end;
  });
}

function buildMiniChart(container, values, color) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values.map((value, i) => {
    const x = (i / (values.length - 1)) * 100;
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
  const total = dayData.reduce((sum, item) => sum + item.amount, 0);
  const prevTotal = total * 0.89;
  const trend = ((total - prevTotal) / prevTotal) * 100;
  document.getElementById("totalRevenue").textContent = fmtMoney(total);
  document.getElementById("salesTrend").textContent = `▲ ${trend.toFixed(1)}% vs прошлый период`;

  const barHost = document.getElementById("salesBars");
  const maxAmount = Math.max(...dayData.map((d) => d.amount));
  barHost.innerHTML = "";
  dayData.forEach((day, index) => {
    const bar = document.createElement("div");
    const height = Math.max(18, (day.amount / maxAmount) * 100);
    bar.className = index === dayData.length - 1 ? "bar active" : "bar";
    bar.style.height = `${height}%`;
    bar.title = `${day.date}: ${fmtMoney(day.amount)}`;
    barHost.appendChild(bar);
  });
}

function renderSalesTable(rows) {
  const body = document.getElementById("salesTableBody");
  body.innerHTML = "";
  rows.slice(0, 8).forEach((row) => {
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

  const countToday = today.reduce((sum, item) => sum + item.count, 0);
  const countWeek = week.reduce((sum, item) => sum + item.count, 0);
  const countMonth = month.reduce((sum, item) => sum + item.count, 0);

  const amountToday = today.reduce((sum, item) => sum + item.amount, 0);
  const amountWeek = week.reduce((sum, item) => sum + item.amount, 0);
  const amountMonth = month.reduce((sum, item) => sum + item.amount, 0);

  const ytViewsToday = chartData.youtubeViews[chartData.youtubeViews.length - 1];
  const ytViewsWeek = chartData.youtubeViews.slice(-7).reduce((a, b) => a + b, 0);
  const ytViewsMonth = chartData.youtubeViews.reduce((a, b) => a + b, 0);

  const ytSubsToday = chartData.youtubeSubscribers[chartData.youtubeSubscribers.length - 1];
  const ytSubsWeek = chartData.youtubeSubscribers.slice(-7).reduce((a, b) => a + b, 0);
  const ytSubsMonth = chartData.youtubeSubscribers.reduce((a, b) => a + b, 0);

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

  const byProduct = new Map();
  salesRows.forEach((row) => {
    if (!byProduct.has(row.title)) {
      byProduct.set(row.title, { count: 0, amount: 0 });
    }
    const item = byProduct.get(row.title);
    item.count += row.count;
    item.amount += amountForRow(row);
  });

  const [name, stats] = [...byProduct.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  document.getElementById("topProductName").textContent = name;
  document.getElementById("topProductStats").textContent = `Продано: ${fmtNumber(stats.count)} • Выручка: ${fmtMoney(stats.amount)}`;

  const salesCountSeries = dayData.map((d) => d.count);
  const salesAmountSeries = dayData.map((d) => Math.round(d.amount));
  const seriesMap = {
    youtubeViews: chartData.youtubeViews,
    youtubeSubscribers: chartData.youtubeSubscribers,
    salesCount: salesCountSeries,
    salesAmount: salesAmountSeries,
  };

  document.querySelectorAll("[data-chart]").forEach((chartHost) => {
    const key = chartHost.dataset.chart;
    const color = key.includes("sales") ? "#2b58de" : "#ff7e5f";
    buildMiniChart(chartHost, seriesMap[key], color);
  });
}

function renderTelegramPosts() {
  const list = document.getElementById("telegramList");
  const template = document.getElementById("telegramItemTemplate");
  const dialog = document.getElementById("postDialog");
  const dialogTitle = document.getElementById("dialogTitle");
  const dialogChannel = document.getElementById("dialogChannel");
  const dialogBody = document.getElementById("dialogBody");

  list.innerHTML = "";
  telegramPosts.forEach((post) => {
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
    });
    list.appendChild(node);
  });
}

const dayData = getSalesByDay(salesRows);
renderSalesCard(dayData);
renderSalesTable([...salesRows].reverse());
renderMetrics(dayData);
renderTelegramPosts();
