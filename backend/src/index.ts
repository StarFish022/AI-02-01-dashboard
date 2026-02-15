interface Env {
  DB: D1Database;
  COMPOSIO_API_KEY?: string;
  COMPOSIO_API_BASE_URL?: string;
  COMPOSIO_EXECUTE_PATH?: string;
  COMPOSIO_CONNECTED_ACCOUNT_ID?: string;
  COMPOSIO_CONNECTED_ACCOUNT_ID_YOUTUBE?: string;
  COMPOSIO_CONNECTED_ACCOUNT_ID_SHEETS?: string;
  SALES_SPREADSHEET_ID?: string;
  SALES_SHEET_NAME?: string;
  SALES_RANGE?: string;
  SALES_COL_DATE?: string;
  SALES_COL_PRODUCT?: string;
  SALES_COL_QUANTITY?: string;
  SALES_COL_AMOUNT?: string;
  SALES_COL_UNIT_PRICE?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHANNEL_ID?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  ALLOWED_ORIGINS?: string;
}

type SyncStatus = "success" | "partial_success" | "failed";

type DashboardResponse = {
  generatedAt: string;
  sales: {
    rows: Array<{ title: string; cost: number; count: number; date: string }>;
    daily: Array<{ date: string; amount: number; count: number }>;
    totals: {
      today: { count: number; amount: number };
      week: { count: number; amount: number };
      month: { count: number; amount: number };
    };
    trendPct: number;
    topProduct: { name: string; count: number; amount: number } | null;
  };
  youtube: {
    daily: Array<{
      date: string;
      views: number;
      subscribers: number;
      viewsDelta: number;
      subscribersDelta: number;
    }>;
    totals: {
      views: { today: number; week: number; month: number };
      subscribers: { today: number; week: number; month: number };
    };
  };
  telegram: {
    posts: Array<{
      channel: string;
      title: string;
      excerpt: string;
      body: string;
      url: string | null;
      createdAt: string;
    }>;
  };
};

const JSON_HEADERS: HeadersInit = { "content-type": "application/json; charset=utf-8" };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), request, env);
    }

    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        return withCors(jsonResponse({ ok: true, now: new Date().toISOString() }), request, env);
      }

      if (request.method === "GET" && url.pathname === "/api/dashboard") {
        const payload = await getDashboardPayload(env);
        return withCors(jsonResponse(payload), request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/refresh-all") {
        const result = await refreshAll(env, "manual");
        const statusCode = result.status === "failed" ? 500 : 200;
        return withCors(jsonResponse(result, statusCode), request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/telegram/webhook") {
        const result = await handleTelegramWebhook(request, env, ctx);
        return withCors(jsonResponse(result), request, env);
      }

      return withCors(jsonResponse({ error: "Not Found" }, 404), request, env);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Unhandled request error", error);
      return withCors(jsonResponse({ error: message }, 500), request, env);
    }
  },

  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    const result = await refreshAll(env, "cron");
    if (result.status === "failed") {
      console.error("Scheduled refresh failed", result);
    }
  },
} satisfies ExportedHandler<Env>;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function withCors(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  const allowedOrigins = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const requestOrigin = request.headers.get("origin");

  if (allowedOrigins.includes("*")) {
    headers.set("access-control-allow-origin", "*");
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    headers.set("access-control-allow-origin", requestOrigin);
    headers.set("vary", "origin");
  }

  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set(
    "access-control-allow-headers",
    "content-type,x-refresh-key,x-telegram-bot-api-secret-token",
  );
  headers.set("access-control-max-age", "86400");
  return new Response(response.body, { status: response.status, headers });
}

async function getDashboardPayload(env: Env): Promise<DashboardResponse> {
  const [salesRows, salesDaily, topProduct, youtubeDaily, telegramPosts] = await Promise.all([
    getSalesRows(env),
    getSalesDaily(env),
    getTopProduct(env),
    getYoutubeDaily(env),
    getTelegramPosts(env),
  ]);

  const salesTotals = {
    today: summarizeSales(salesDaily, 1),
    week: summarizeSales(salesDaily, 7),
    month: summarizeSales(salesDaily, 30),
  };

  const youtubeTotals = summarizeYouTube(youtubeDaily);
  const trendPct = computeWeekOverWeekTrend(salesDaily);

  return {
    generatedAt: new Date().toISOString(),
    sales: {
      rows: salesRows,
      daily: salesDaily,
      totals: salesTotals,
      trendPct,
      topProduct,
    },
    youtube: {
      daily: youtubeDaily,
      totals: youtubeTotals,
    },
    telegram: {
      posts: telegramPosts,
    },
  };
}

async function refreshAll(
  env: Env,
  triggerType: "manual" | "cron" | "telegram_webhook",
): Promise<{
  runId: string;
  status: SyncStatus;
  errors: string[];
  tasks: Array<{ name: string; status: "ok" | "skipped" | "error"; detail?: string }>;
}> {
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const tasks: Array<{ name: string; status: "ok" | "skipped" | "error"; detail?: string }> = [];
  const errors: string[] = [];

  await env.DB.prepare(
    "INSERT INTO sync_runs (id, trigger_type, started_at_utc, status) VALUES (?, ?, ?, ?)",
  )
    .bind(runId, triggerType, startedAt, "running")
    .run();

  const results = await Promise.allSettled([
    syncYouTube(env, runId),
    syncSales(env, runId),
    syncTelegramUpdates(env, runId),
  ]);

  for (const result of results) {
    if (result.status === "fulfilled") {
      tasks.push(result.value);
      if (result.value.status === "error") {
        errors.push(`${result.value.name}: ${result.value.detail || "unknown error"}`);
      }
    } else {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      tasks.push({ name: "unknown", status: "error", detail: message });
      errors.push(message);
    }
  }

  const status: SyncStatus = errors.length === 0 ? "success" : tasks.some((t) => t.status === "ok") ? "partial_success" : "failed";

  await env.DB.prepare(
    "UPDATE sync_runs SET finished_at_utc = ?, status = ?, details = ? WHERE id = ?",
  )
    .bind(new Date().toISOString(), status, JSON.stringify({ errors, tasks }), runId)
    .run();

  return { runId, status, errors, tasks };
}

async function syncYouTube(
  env: Env,
  runId: string,
): Promise<{ name: string; status: "ok" | "skipped" | "error"; detail?: string }> {
  if (!env.COMPOSIO_API_KEY) {
    return { name: "youtube", status: "skipped", detail: "COMPOSIO_API_KEY not configured" };
  }

  try {
    const payload = await executeComposioAction(
      env,
      "YOUTUBE_GET_CHANNEL_STATISTICS",
      { mine: true, part: "statistics,snippet" },
      env.COMPOSIO_CONNECTED_ACCOUNT_ID_YOUTUBE || env.COMPOSIO_CONNECTED_ACCOUNT_ID,
    );

    const viewCount = findFirstNumber(payload, ["viewCount", "view_count", "views"]);
    const subscriberCount = findFirstNumber(payload, [
      "subscriberCount",
      "subscriber_count",
      "subscribers",
    ]);

    if (viewCount === null || subscriberCount === null) {
      return {
        name: "youtube",
        status: "error",
        detail: "Cannot parse YouTube statistics from Composio response",
      };
    }

    const nowIso = new Date().toISOString();
    const mskDate = toMskDate(nowIso);

    await env.DB.prepare(
      `INSERT INTO youtube_snapshots
      (id, run_id, snapshot_at_utc, snapshot_date_msk, view_count, subscriber_count, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        runId,
        nowIso,
        mskDate,
        Math.max(0, Math.trunc(viewCount)),
        Math.max(0, Math.trunc(subscriberCount)),
        JSON.stringify(payload),
      )
      .run();

    return { name: "youtube", status: "ok" };
  } catch (error) {
    return {
      name: "youtube",
      status: "error",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function syncSales(
  env: Env,
  runId: string,
): Promise<{ name: string; status: "ok" | "skipped" | "error"; detail?: string }> {
  if (!env.COMPOSIO_API_KEY) {
    return { name: "sales", status: "skipped", detail: "COMPOSIO_API_KEY not configured" };
  }
  if (!env.SALES_SPREADSHEET_ID) {
    return {
      name: "sales",
      status: "skipped",
      detail: "SALES_SPREADSHEET_ID not configured",
    };
  }

  try {
    const range = env.SALES_RANGE || `${env.SALES_SHEET_NAME || "Sales"}!A:Z`;
    const payload = await executeComposioAction(
      env,
      "GOOGLESHEETS_BATCH_GET",
      {
        spreadsheet_id: env.SALES_SPREADSHEET_ID,
        ranges: [range],
        valueRenderOption: "UNFORMATTED_VALUE",
        dateTimeRenderOption: "FORMATTED_STRING",
      },
      env.COMPOSIO_CONNECTED_ACCOUNT_ID_SHEETS || env.COMPOSIO_CONNECTED_ACCOUNT_ID,
    );

    const matrix = extractSheetMatrix(payload);
    if (matrix.length < 2) {
      await env.DB.prepare("DELETE FROM sales_rows_raw").run();
      return { name: "sales", status: "ok", detail: "No sales rows found in source sheet" };
    }

    const headers = matrix[0].map((cell) => String(cell ?? "").trim());
    const dateIdx = findHeaderIndex(headers, [env.SALES_COL_DATE, "Date", "Дата"]);
    const productIdx = findHeaderIndex(headers, [
      env.SALES_COL_PRODUCT,
      "Title",
      "Product",
      "Name",
      "Товар",
      "Наименование",
    ]);
    const qtyIdx = findHeaderIndex(headers, [
      env.SALES_COL_QUANTITY,
      "Count",
      "Quantity",
      "Qty",
      "Кол-во",
      "Количество",
    ]);
    const amountIdx = findHeaderIndex(headers, [
      env.SALES_COL_AMOUNT,
      "Amount",
      "Sum",
      "Revenue",
      "Сумма",
      "Выручка",
    ]);
    const priceIdx = findHeaderIndex(headers, [
      env.SALES_COL_UNIT_PRICE,
      "Cost",
      "Price",
      "Unit Price",
      "Цена",
    ]);

    if (dateIdx === -1 || productIdx === -1 || qtyIdx === -1 || (amountIdx === -1 && priceIdx === -1)) {
      return {
        name: "sales",
        status: "error",
        detail:
          "Cannot map sales columns. Check SALES_COL_* env variables and source sheet headers.",
      };
    }

    const parsedRows: Array<{
      rowIndex: number;
      saleDate: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      amount: number;
      recordHash: string;
      raw: unknown[];
    }> = [];

    for (let i = 1; i < matrix.length; i += 1) {
      const row = matrix[i];
      const rawDate = row[dateIdx];
      const rawProduct = row[productIdx];
      const rawQty = row[qtyIdx];
      const rawAmount = amountIdx >= 0 ? row[amountIdx] : null;
      const rawPrice = priceIdx >= 0 ? row[priceIdx] : null;

      const saleDate = normalizeDateString(rawDate);
      const productName = String(rawProduct ?? "").trim();
      const quantity = Math.max(0, Math.round(toNumber(rawQty) || 0));
      const amount = Math.max(0, toNumber(rawAmount) || 0);
      const unitPrice = Math.max(0, toNumber(rawPrice) || (quantity > 0 ? amount / quantity : 0));

      if (!saleDate || !productName || quantity <= 0 || (!amount && !unitPrice)) {
        continue;
      }

      const normalizedAmount = amount > 0 ? amount : unitPrice * quantity;
      const recordHash = fnv1a(
        `${saleDate}|${productName}|${quantity}|${normalizedAmount.toFixed(2)}|${i + 1}`,
      );

      parsedRows.push({
        rowIndex: i + 1,
        saleDate,
        productName,
        quantity,
        unitPrice,
        amount: normalizedAmount,
        recordHash,
        raw: row,
      });
    }

    await env.DB.prepare("DELETE FROM sales_rows_raw").run();
    if (parsedRows.length > 0) {
      const chunks = chunkArray(parsedRows, 50);
      for (const chunk of chunks) {
        const statements = chunk.map((row) =>
          env.DB.prepare(
            `INSERT INTO sales_rows_raw
            (id, run_id, row_index, sale_date_msk, product_name, quantity, unit_price, amount, currency, record_hash, raw_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?)`,
          ).bind(
            crypto.randomUUID(),
            runId,
            row.rowIndex,
            row.saleDate,
            row.productName,
            row.quantity,
            round2(row.unitPrice),
            round2(row.amount),
            row.recordHash,
            JSON.stringify(row.raw),
          ),
        );
        await env.DB.batch(statements);
      }
    }

    return { name: "sales", status: "ok", detail: `Loaded ${parsedRows.length} sales rows` };
  } catch (error) {
    return {
      name: "sales",
      status: "error",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function syncTelegramUpdates(
  env: Env,
  runId: string,
): Promise<{ name: string; status: "ok" | "skipped" | "error"; detail?: string }> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return {
      name: "telegram",
      status: "skipped",
      detail: "TELEGRAM_BOT_TOKEN not configured",
    };
  }

  try {
    const offsetRaw = await getState(env, "telegram_update_offset");
    const offset = Number.parseInt(offsetRaw || "0", 10);

    const url = new URL(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates`);
    if (Number.isFinite(offset) && offset > 0) {
      url.searchParams.set("offset", String(offset));
    }
    url.searchParams.set("timeout", "0");
    url.searchParams.set("limit", "100");
    url.searchParams.set("allowed_updates", JSON.stringify(["channel_post"]));

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "content-type": "application/json" },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Telegram getUpdates failed: ${response.status} ${text}`);
    }

    const payload = (await response.json()) as {
      ok?: boolean;
      result?: Array<Record<string, unknown>>;
      description?: string;
    };

    if (!payload.ok) {
      throw new Error(payload.description || "Telegram API returned ok=false");
    }

    const updates = payload.result || [];
    let nextOffset = offset;
    for (const update of updates) {
      const updateId = toNumber(update.update_id);
      if (updateId !== null) {
        nextOffset = Math.max(nextOffset, Math.trunc(updateId) + 1);
      }
    }

    await upsertTelegramUpdates(env, updates, runId);

    if (nextOffset !== offset) {
      await setState(env, "telegram_update_offset", String(nextOffset));
    }

    return { name: "telegram", status: "ok", detail: `Processed ${updates.length} updates` };
  } catch (error) {
    return {
      name: "telegram",
      status: "error",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleTelegramWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<{ ok: true }> {
  const secret = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (secret) {
    const header = request.headers.get("x-telegram-bot-api-secret-token");
    if (!header || header !== secret) {
      throw new Error("Telegram webhook secret mismatch");
    }
  }

  const payload = (await request.json()) as Record<string, unknown>;
  ctx.waitUntil(upsertTelegramUpdates(env, [payload], null));
  return { ok: true };
}

async function upsertTelegramUpdates(
  env: Env,
  updates: Array<Record<string, unknown>>,
  runId: string | null,
): Promise<void> {
  for (const update of updates) {
    const channelPost = asRecord(update.channel_post);
    if (!channelPost) {
      continue;
    }

    const chat = asRecord(channelPost.chat);
    const channelId = String(chat?.id ?? "");
    if (!channelId) {
      continue;
    }

    const allowedChannelId = (env.TELEGRAM_CHANNEL_ID || "").trim();
    if (allowedChannelId && allowedChannelId !== channelId) {
      continue;
    }

    const messageId = Math.trunc(toNumber(channelPost.message_id) || 0);
    if (!messageId) {
      continue;
    }

    const unix = Math.trunc(toNumber(channelPost.date) || 0);
    const messageDateIso = unix > 0 ? new Date(unix * 1000).toISOString() : new Date().toISOString();
    const messageDateMsk = toMskDate(messageDateIso);
    const channelTitle = String(chat?.title || chat?.username || "Telegram");
    const body = String(channelPost.text || channelPost.caption || "").trim();
    const title = buildTelegramTitle(body);
    const excerpt = body.replace(/\s+/g, " ").trim().slice(0, 160);

    let permalink: string | null = null;
    if (typeof chat?.username === "string" && chat.username) {
      permalink = `https://t.me/${chat.username}/${messageId}`;
    } else if (channelId.startsWith("-100")) {
      permalink = `https://t.me/c/${channelId.slice(4)}/${messageId}`;
    }

    await env.DB.prepare(
      `INSERT INTO telegram_posts
      (id, run_id, channel_id, channel_title, message_id, message_date_utc, message_date_msk, title, excerpt, content, permalink, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(channel_id, message_id) DO UPDATE SET
        channel_title = excluded.channel_title,
        message_date_utc = excluded.message_date_utc,
        message_date_msk = excluded.message_date_msk,
        title = excluded.title,
        excerpt = excluded.excerpt,
        content = excluded.content,
        permalink = excluded.permalink,
        raw_json = excluded.raw_json`,
    )
      .bind(
        crypto.randomUUID(),
        runId,
        channelId,
        channelTitle,
        messageId,
        messageDateIso,
        messageDateMsk,
        title,
        excerpt,
        body,
        permalink,
        JSON.stringify(update),
      )
      .run();
  }
}

async function executeComposioAction(
  env: Env,
  action: string,
  input: Record<string, unknown>,
  connectedAccountId?: string,
): Promise<unknown> {
  if (!env.COMPOSIO_API_KEY) {
    throw new Error("COMPOSIO_API_KEY is required");
  }

  const base = (env.COMPOSIO_API_BASE_URL || "https://api.composio.dev").replace(/\/+$/, "");
  const path = env.COMPOSIO_EXECUTE_PATH || "/v1/actions/execute";
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const body: Record<string, unknown> = {
    action,
    input,
  };
  if (connectedAccountId) {
    body.connectedAccountId = connectedAccountId;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.COMPOSIO_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`Composio request failed (${response.status}): ${rawText}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Composio response is not valid JSON");
  }

  const record = asRecord(parsed);
  if (record?.successful === false) {
    throw new Error(String(record.error || "Composio action execution failed"));
  }

  return record?.data ?? parsed;
}

async function getSalesRows(
  env: Env,
): Promise<Array<{ title: string; cost: number; count: number; date: string }>> {
  const result = await env.DB.prepare(
    `SELECT product_name AS title, unit_price AS cost, quantity AS count, sale_date_msk AS date
    FROM sales_rows_raw
    ORDER BY sale_date_msk DESC, row_index DESC
    LIMIT 500`,
  ).all<{ title: string; cost: number; count: number; date: string }>();
  return result.results || [];
}

async function getSalesDaily(
  env: Env,
): Promise<Array<{ date: string; amount: number; count: number }>> {
  const result = await env.DB.prepare(
    `SELECT sale_date_msk AS date,
      ROUND(SUM(amount), 2) AS amount,
      SUM(quantity) AS count
    FROM sales_rows_raw
    GROUP BY sale_date_msk
    ORDER BY sale_date_msk ASC`,
  ).all<{ date: string; amount: number; count: number }>();
  return result.results || [];
}

async function getTopProduct(
  env: Env,
): Promise<{ name: string; count: number; amount: number } | null> {
  const minDate = getPastMskDate(29);
  const result = await env.DB.prepare(
    `SELECT product_name AS name,
      SUM(quantity) AS count,
      ROUND(SUM(amount), 2) AS amount
    FROM sales_rows_raw
    WHERE sale_date_msk >= ?
    GROUP BY product_name
    ORDER BY count DESC, amount DESC
    LIMIT 1`,
  )
    .bind(minDate)
    .first<{ name: string; count: number; amount: number }>();
  return result || null;
}

async function getYoutubeDaily(
  env: Env,
): Promise<
  Array<{ date: string; views: number; subscribers: number; viewsDelta: number; subscribersDelta: number }>
> {
  const result = await env.DB.prepare(
    `WITH ranked AS (
      SELECT
        snapshot_date_msk,
        view_count,
        subscriber_count,
        ROW_NUMBER() OVER (PARTITION BY snapshot_date_msk ORDER BY snapshot_at_utc DESC) AS rn
      FROM youtube_snapshots
    ),
    latest AS (
      SELECT
        snapshot_date_msk AS date,
        view_count AS views,
        subscriber_count AS subscribers
      FROM ranked
      WHERE rn = 1
      ORDER BY snapshot_date_msk DESC
      LIMIT 90
    )
    SELECT date, views, subscribers
    FROM latest
    ORDER BY date ASC`,
  ).all<{ date: string; views: number; subscribers: number }>();

  const rows = result.results || [];
  const withDelta: Array<{
    date: string;
    views: number;
    subscribers: number;
    viewsDelta: number;
    subscribersDelta: number;
  }> = [];

  for (let i = 0; i < rows.length; i += 1) {
    const current = rows[i];
    const prev = rows[i - 1];
    const viewsDelta = prev ? Math.max(0, current.views - prev.views) : 0;
    const subscribersDelta = prev ? Math.max(0, current.subscribers - prev.subscribers) : 0;
    withDelta.push({ ...current, viewsDelta, subscribersDelta });
  }

  return withDelta;
}

async function getTelegramPosts(
  env: Env,
): Promise<
  Array<{
    channel: string;
    title: string;
    excerpt: string;
    body: string;
    url: string | null;
    createdAt: string;
  }>
> {
  const result = await env.DB.prepare(
    `SELECT
      channel_title AS channel,
      title,
      excerpt,
      content AS body,
      permalink AS url,
      message_date_utc AS createdAt
    FROM telegram_posts
    ORDER BY message_date_utc DESC
    LIMIT 3`,
  ).all<{
    channel: string;
    title: string;
    excerpt: string;
    body: string;
    url: string | null;
    createdAt: string;
  }>();
  return result.results || [];
}

function summarizeSales(
  daily: Array<{ date: string; amount: number; count: number }>,
  days: number,
): { count: number; amount: number } {
  const slice = daily.slice(-days);
  return {
    count: slice.reduce((sum, item) => sum + item.count, 0),
    amount: round2(slice.reduce((sum, item) => sum + item.amount, 0)),
  };
}

function summarizeYouTube(
  daily: Array<{ viewsDelta: number; subscribersDelta: number }>,
): {
  views: { today: number; week: number; month: number };
  subscribers: { today: number; week: number; month: number };
} {
  const sum = (rows: Array<{ viewsDelta: number; subscribersDelta: number }>) =>
    rows.reduce(
      (acc, row) => {
        acc.views += row.viewsDelta;
        acc.subscribers += row.subscribersDelta;
        return acc;
      },
      { views: 0, subscribers: 0 },
    );

  const today = sum(daily.slice(-1));
  const week = sum(daily.slice(-7));
  const month = sum(daily.slice(-30));

  return {
    views: { today: today.views, week: week.views, month: month.views },
    subscribers: {
      today: today.subscribers,
      week: week.subscribers,
      month: month.subscribers,
    },
  };
}

function computeWeekOverWeekTrend(daily: Array<{ amount: number }>): number {
  const current = daily.slice(-7).reduce((sum, item) => sum + item.amount, 0);
  const previous = daily.slice(-14, -7).reduce((sum, item) => sum + item.amount, 0);
  if (previous <= 0) {
    return 0;
  }
  return round2(((current - previous) / previous) * 100);
}

function extractSheetMatrix(payload: unknown): unknown[][] {
  if (Array.isArray(payload) && payload.every((row) => Array.isArray(row))) {
    return payload as unknown[][];
  }

  const root = asRecord(payload);
  if (!root) {
    return [];
  }

  const candidates: unknown[] = [
    root.values,
    asRecord(root.data)?.values,
    asRecord(root.data)?.valueRanges,
    root.valueRanges,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (Array.isArray(candidate)) {
      if (candidate.length === 0) continue;
      if (candidate.every((row) => Array.isArray(row))) {
        return candidate as unknown[][];
      }
      const first = asRecord(candidate[0]);
      if (first && Array.isArray(first.values)) {
        return first.values as unknown[][];
      }
    }
  }

  return [];
}

function findHeaderIndex(headers: string[], candidates: Array<string | undefined>): number {
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    if (!candidate) continue;
    const idx = normalizedHeaders.indexOf(candidate.trim().toLowerCase());
    if (idx >= 0) {
      return idx;
    }
  }
  return -1;
}

function findFirstNumber(payload: unknown, keys: string[]): number | null {
  const normalized = new Set(keys.map((key) => key.toLowerCase()));
  const queue: unknown[] = [payload];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }
    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      if (normalized.has(key.toLowerCase())) {
        const num = toNumber(value);
        if (num !== null) {
          return num;
        }
      }
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return null;
}

function normalizeDateString(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split(".");
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value
      .trim()
      .replace(/\s+/g, "")
      .replace(/[^\d.,-]/g, "");
    if (!cleaned) {
      return null;
    }

    let normalized = cleaned;
    const commaIndex = normalized.lastIndexOf(",");
    const dotIndex = normalized.lastIndexOf(".");

    if (commaIndex >= 0 && dotIndex >= 0) {
      if (commaIndex > dotIndex) {
        normalized = normalized.replace(/\./g, "").replace(",", ".");
      } else {
        normalized = normalized.replace(/,/g, "");
      }
    } else {
      normalized = normalized.replace(",", ".");
    }

    const num = Number.parseFloat(normalized);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toMskDate(isoString: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoString));
}

function getPastMskDate(daysBack: number): string {
  const now = new Date();
  const ms = now.getTime() - daysBack * 24 * 60 * 60 * 1000;
  return toMskDate(new Date(ms).toISOString());
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function getState(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM app_state WHERE key = ?").bind(key).first<{
    value: string;
  }>();
  return row?.value || null;
}

async function setState(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO app_state (key, value, updated_at_utc)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at_utc = excluded.updated_at_utc`,
  )
    .bind(key, value, new Date().toISOString())
    .run();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function buildTelegramTitle(body: string): string {
  const firstLine = body.split("\n").map((line) => line.trim()).find(Boolean);
  if (!firstLine) return "Новый пост";
  return firstLine.length > 110 ? `${firstLine.slice(0, 107)}...` : firstLine;
}
