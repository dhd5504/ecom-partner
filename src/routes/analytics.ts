import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert PostgreSQL BigInt strings / numbers to JS number safely */
function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

/** Default date range: last 7 days */
function defaultDates(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from7 = new Date(now);
  from7.setDate(from7.getDate() - 6);
  const from = from7.toISOString().slice(0, 10);
  return { dateFrom: from, dateTo: to };
}

/** Parse and validate query params for date range and optional campaign_id */
function parseDateParams(req: Request): {
  dateFrom: string;
  dateTo: string;
  campaignId: string | null;
} {
  const defaults = defaultDates();
  const dateFrom = typeof req.query.date_from === 'string' ? req.query.date_from : defaults.dateFrom;
  const dateTo = typeof req.query.date_to === 'string' ? req.query.date_to : defaults.dateTo;
  const campaignId =
    typeof req.query.campaign_id === 'string' && req.query.campaign_id !== ''
      ? req.query.campaign_id
      : null;
  return { dateFrom, dateTo, campaignId };
}

/** Calculate derived KPIs from raw aggregates */
function calcKpis(data: {
  cost_vnd: number;
  revenue_vnd: number;
  reduct_vnd: number;
  total_orders: number;
  shopee_clicks: number;
}): { profit_vnd: number; roi_pct: number | null; cr_pct: number | null; cpo_vnd: number | null } {
  const profit_vnd = data.revenue_vnd - data.cost_vnd - data.reduct_vnd;
  const roi_pct = data.cost_vnd > 0 ? (profit_vnd / data.cost_vnd) * 100 : null;
  const cr_pct = data.shopee_clicks > 0 ? (data.total_orders / data.shopee_clicks) * 100 : null;
  const cpo_vnd = data.total_orders > 0 ? data.cost_vnd / data.total_orders : null;
  return { profit_vnd, roi_pct, cr_pct, cpo_vnd };
}

// ---------------------------------------------------------------------------
// GET /api/metrics — aggregate KPIs
// ---------------------------------------------------------------------------
router.get('/api/metrics', async (req: Request, res: Response): Promise<void> => {
  try {
    const { dateFrom, dateTo, campaignId } = parseDateParams(req);

    // Run three independent queries in parallel (different date columns)
    const [propRow, ordRow, clkRow] = await Promise.all([
      pool.query<{
        impressions: string;
        propeller_clicks: string;
        cost_vnd: string;
      }>(
        `SELECT
          COALESCE(SUM(impressions), 0)       AS impressions,
          COALESCE(SUM(propeller_clicks), 0)  AS propeller_clicks,
          COALESCE(SUM(cost_vnd), 0)          AS cost_vnd
        FROM partner_propeller_stats
        WHERE stat_date BETWEEN $1 AND $2
          AND ($3::text IS NULL OR campaign_id = $3)`,
        [dateFrom, dateTo, campaignId]
      ),
      pool.query<{
        total_orders: string;
        cancelled_orders: string;
        revenue_vnd: string;
        reduct_vnd: string;
      }>(
        `SELECT
          COALESCE(SUM(CASE WHEN status_group IN ('pending','completed') THEN order_count ELSE 0 END), 0) AS total_orders,
          COALESCE(SUM(CASE WHEN status_group = 'cancelled' THEN order_count ELSE 0 END), 0)              AS cancelled_orders,
          COALESCE(SUM(CASE WHEN status_group IN ('pending','completed') THEN revenue_vnd ELSE 0 END), 0) AS revenue_vnd,
          COALESCE(SUM(CASE WHEN status_group = 'cancelled' THEN reduct_vnd ELSE 0 END), 0)               AS reduct_vnd
        FROM partner_orders
        WHERE purchase_date BETWEEN $1 AND $2
          AND ($3::text IS NULL OR campaign_id = $3)`,
        [dateFrom, dateTo, campaignId]
      ),
      pool.query<{ shopee_clicks: string }>(
        `SELECT COALESCE(SUM(click_count), 0) AS shopee_clicks
        FROM partner_clicks
        WHERE click_date BETWEEN $1 AND $2
          AND ($3::text IS NULL OR campaign_id = $3)`,
        [dateFrom, dateTo, campaignId]
      ),
    ]);

    const prop = propRow.rows[0];
    const ord = ordRow.rows[0];
    const clk = clkRow.rows[0];

    const cost_vnd = toNum(prop.cost_vnd);
    const revenue_vnd = toNum(ord.revenue_vnd);
    const reduct_vnd = toNum(ord.reduct_vnd);
    const total_orders = toNum(ord.total_orders);
    const cancelled_orders = toNum(ord.cancelled_orders);
    const shopee_clicks = toNum(clk.shopee_clicks);
    const impressions = toNum(prop.impressions);
    const propeller_clicks = toNum(prop.propeller_clicks);

    const { profit_vnd, roi_pct, cr_pct, cpo_vnd } = calcKpis({
      cost_vnd,
      revenue_vnd,
      reduct_vnd,
      total_orders,
      shopee_clicks,
    });

    res.json({
      status: 'success',
      data: {
        cost_vnd,
        revenue_vnd,
        reduct_vnd,
        profit_vnd,
        roi_pct,
        total_orders,
        cancelled_orders,
        shopee_clicks,
        impressions,
        propeller_clicks,
        cr_pct,
        cpo_vnd,
      },
    });
  } catch (err) {
    console.error('[/api/metrics]', err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/metrics/daily — day-by-day series for chart
// ---------------------------------------------------------------------------
router.get('/api/metrics/daily', async (req: Request, res: Response): Promise<void> => {
  try {
    const { dateFrom, dateTo, campaignId } = parseDateParams(req);

    // Generate a date series and left-join each source independently.
    // We do NOT join propeller_stats with orders by date — they use different
    // date columns and must be aggregated separately then merged by date in Node.
    const [propRows, ordRows, clkRows] = await Promise.all([
      pool.query<{ stat_date: string; impressions: string; propeller_clicks: string; cost_vnd: string }>(
        `SELECT stat_date::text,
          SUM(impressions)       AS impressions,
          SUM(propeller_clicks)  AS propeller_clicks,
          SUM(cost_vnd)          AS cost_vnd
        FROM partner_propeller_stats
        WHERE stat_date BETWEEN $1 AND $2
          AND ($3::text IS NULL OR campaign_id = $3)
        GROUP BY stat_date
        ORDER BY stat_date`,
        [dateFrom, dateTo, campaignId]
      ),
      pool.query<{
        purchase_date: string;
        total_orders: string;
        cancelled_orders: string;
        revenue_vnd: string;
        reduct_vnd: string;
      }>(
        `SELECT purchase_date::text,
          SUM(CASE WHEN status_group IN ('pending','completed') THEN order_count ELSE 0 END) AS total_orders,
          SUM(CASE WHEN status_group = 'cancelled' THEN order_count ELSE 0 END)              AS cancelled_orders,
          SUM(CASE WHEN status_group IN ('pending','completed') THEN revenue_vnd ELSE 0 END) AS revenue_vnd,
          SUM(CASE WHEN status_group = 'cancelled' THEN reduct_vnd ELSE 0 END)               AS reduct_vnd
        FROM partner_orders
        WHERE purchase_date BETWEEN $1 AND $2
          AND ($3::text IS NULL OR campaign_id = $3)
        GROUP BY purchase_date
        ORDER BY purchase_date`,
        [dateFrom, dateTo, campaignId]
      ),
      pool.query<{ click_date: string; shopee_clicks: string }>(
        `SELECT click_date::text, SUM(click_count) AS shopee_clicks
        FROM partner_clicks
        WHERE click_date BETWEEN $1 AND $2
          AND ($3::text IS NULL OR campaign_id = $3)
        GROUP BY click_date
        ORDER BY click_date`,
        [dateFrom, dateTo, campaignId]
      ),
    ]);

    // Build lookup maps keyed by date string
    const propMap = new Map(propRows.rows.map((r) => [r.stat_date, r]));
    const ordMap = new Map(ordRows.rows.map((r) => [r.purchase_date, r]));
    const clkMap = new Map(clkRows.rows.map((r) => [r.click_date, r]));

    // Collect all unique dates across the three sources
    const allDates = new Set([...propMap.keys(), ...ordMap.keys(), ...clkMap.keys()]);
    const sortedDates = Array.from(allDates).sort();

    const series = sortedDates.map((date) => {
      const p = propMap.get(date);
      const o = ordMap.get(date);
      const c = clkMap.get(date);

      const cost_vnd = toNum(p?.cost_vnd);
      const revenue_vnd = toNum(o?.revenue_vnd);
      const reduct_vnd = toNum(o?.reduct_vnd);
      const total_orders = toNum(o?.total_orders);
      const cancelled_orders = toNum(o?.cancelled_orders);
      const shopee_clicks = toNum(c?.shopee_clicks);
      const impressions = toNum(p?.impressions);
      const propeller_clicks = toNum(p?.propeller_clicks);
      const profit_vnd = revenue_vnd - cost_vnd - reduct_vnd;

      return {
        date,
        revenue_vnd,
        cost_vnd,
        reduct_vnd,
        profit_vnd,
        total_orders,
        cancelled_orders,
        shopee_clicks,
        impressions,
        propeller_clicks,
      };
    });

    res.json({ status: 'success', data: series });
  } catch (err) {
    console.error('[/api/metrics/daily]', err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/campaigns — per-campaign breakdown
// ---------------------------------------------------------------------------
router.get('/api/campaigns', async (req: Request, res: Response): Promise<void> => {
  try {
    const { dateFrom, dateTo } = parseDateParams(req);

    const result = await pool.query<{
      campaign_id: string;
      campaign_name: string;
      impressions: string;
      propeller_clicks: string;
      shopee_clicks: string;
      total_orders: string;
      cancelled_orders: string;
      revenue_vnd: string;
      reduct_vnd: string;
      cost_vnd: string;
    }>(
      `WITH prop AS (
        SELECT
          campaign_id,
          MAX(campaign_name)    AS campaign_name,
          SUM(impressions)      AS impressions,
          SUM(propeller_clicks) AS propeller_clicks,
          SUM(cost_vnd)         AS cost_vnd
        FROM partner_propeller_stats
        WHERE stat_date BETWEEN $1 AND $2
        GROUP BY campaign_id
      ),
      ord AS (
        SELECT
          campaign_id,
          SUM(CASE WHEN status_group IN ('pending','completed') THEN order_count ELSE 0 END) AS total_orders,
          SUM(CASE WHEN status_group = 'cancelled' THEN order_count ELSE 0 END)              AS cancelled_orders,
          SUM(CASE WHEN status_group IN ('pending','completed') THEN revenue_vnd ELSE 0 END) AS revenue_vnd,
          SUM(CASE WHEN status_group = 'cancelled' THEN reduct_vnd ELSE 0 END)               AS reduct_vnd
        FROM partner_orders
        WHERE purchase_date BETWEEN $1 AND $2
        GROUP BY campaign_id
      ),
      clk AS (
        SELECT campaign_id, SUM(click_count) AS shopee_clicks
        FROM partner_clicks
        WHERE click_date BETWEEN $1 AND $2
        GROUP BY campaign_id
      )
      SELECT
        COALESCE(prop.campaign_id, ord.campaign_id, clk.campaign_id)       AS campaign_id,
        COALESCE(prop.campaign_name, prop.campaign_id, ord.campaign_id, clk.campaign_id) AS campaign_name,
        COALESCE(prop.impressions, 0)      AS impressions,
        COALESCE(prop.propeller_clicks, 0) AS propeller_clicks,
        COALESCE(clk.shopee_clicks, 0)     AS shopee_clicks,
        COALESCE(ord.total_orders, 0)      AS total_orders,
        COALESCE(ord.cancelled_orders, 0)  AS cancelled_orders,
        COALESCE(ord.revenue_vnd, 0)       AS revenue_vnd,
        COALESCE(ord.reduct_vnd, 0)        AS reduct_vnd,
        COALESCE(prop.cost_vnd, 0)         AS cost_vnd
      FROM prop
      FULL OUTER JOIN ord USING(campaign_id)
      FULL OUTER JOIN clk USING(campaign_id)
      ORDER BY COALESCE(prop.cost_vnd, 0) DESC`,
      [dateFrom, dateTo]
    );

    const rows = result.rows.map((r) => {
      const cost_vnd = toNum(r.cost_vnd);
      const revenue_vnd = toNum(r.revenue_vnd);
      const reduct_vnd = toNum(r.reduct_vnd);
      const total_orders = toNum(r.total_orders);
      const shopee_clicks = toNum(r.shopee_clicks);
      const profit_vnd = revenue_vnd - cost_vnd - reduct_vnd;
      const roi_pct = cost_vnd > 0 ? (profit_vnd / cost_vnd) * 100 : null;
      const cr_pct = shopee_clicks > 0 ? (total_orders / shopee_clicks) * 100 : null;
      const cpo_vnd = total_orders > 0 ? cost_vnd / total_orders : null;
      return {
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        impressions: toNum(r.impressions),
        propeller_clicks: toNum(r.propeller_clicks),
        shopee_clicks,
        total_orders,
        cancelled_orders: toNum(r.cancelled_orders),
        revenue_vnd,
        reduct_vnd,
        cost_vnd,
        profit_vnd,
        roi_pct,
        cr_pct,
        cpo_vnd,
      };
    });

    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('[/api/campaigns]', err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/zones — per-zone breakdown
// ---------------------------------------------------------------------------
router.get('/api/zones', async (req: Request, res: Response): Promise<void> => {
  try {
    const { dateFrom, dateTo } = parseDateParams(req);

    const result = await pool.query<{
      zone_alias: string;
      impressions: string;
      propeller_clicks: string;
      shopee_clicks: string;
      total_orders: string;
      cancelled_orders: string;
      revenue_vnd: string;
      reduct_vnd: string;
      cost_vnd: string;
    }>(
      `WITH prop AS (
        SELECT
          zone_alias,
          SUM(impressions)      AS impressions,
          SUM(propeller_clicks) AS propeller_clicks,
          SUM(cost_vnd)         AS cost_vnd
        FROM partner_propeller_stats
        WHERE stat_date BETWEEN $1 AND $2
        GROUP BY zone_alias
      ),
      ord AS (
        SELECT
          zone_alias,
          SUM(CASE WHEN status_group IN ('pending','completed') THEN order_count ELSE 0 END) AS total_orders,
          SUM(CASE WHEN status_group = 'cancelled' THEN order_count ELSE 0 END)              AS cancelled_orders,
          SUM(CASE WHEN status_group IN ('pending','completed') THEN revenue_vnd ELSE 0 END) AS revenue_vnd,
          SUM(CASE WHEN status_group = 'cancelled' THEN reduct_vnd ELSE 0 END)               AS reduct_vnd
        FROM partner_orders
        WHERE purchase_date BETWEEN $1 AND $2
        GROUP BY zone_alias
      ),
      clk AS (
        SELECT zone_alias, SUM(click_count) AS shopee_clicks
        FROM partner_clicks
        WHERE click_date BETWEEN $1 AND $2
        GROUP BY zone_alias
      )
      SELECT
        COALESCE(prop.zone_alias, ord.zone_alias, clk.zone_alias) AS zone_alias,
        COALESCE(prop.impressions, 0)      AS impressions,
        COALESCE(prop.propeller_clicks, 0) AS propeller_clicks,
        COALESCE(clk.shopee_clicks, 0)     AS shopee_clicks,
        COALESCE(ord.total_orders, 0)      AS total_orders,
        COALESCE(ord.cancelled_orders, 0)  AS cancelled_orders,
        COALESCE(ord.revenue_vnd, 0)       AS revenue_vnd,
        COALESCE(ord.reduct_vnd, 0)        AS reduct_vnd,
        COALESCE(prop.cost_vnd, 0)         AS cost_vnd
      FROM prop
      FULL OUTER JOIN ord USING(zone_alias)
      FULL OUTER JOIN clk USING(zone_alias)
      ORDER BY COALESCE(prop.cost_vnd, 0) DESC`,
      [dateFrom, dateTo]
    );

    const rows = result.rows.map((r) => {
      const cost_vnd = toNum(r.cost_vnd);
      const revenue_vnd = toNum(r.revenue_vnd);
      const reduct_vnd = toNum(r.reduct_vnd);
      const total_orders = toNum(r.total_orders);
      const shopee_clicks = toNum(r.shopee_clicks);
      const profit_vnd = revenue_vnd - cost_vnd - reduct_vnd;
      const roi_pct = cost_vnd > 0 ? (profit_vnd / cost_vnd) * 100 : null;
      const cr_pct = shopee_clicks > 0 ? (total_orders / shopee_clicks) * 100 : null;
      const cpo_vnd = total_orders > 0 ? cost_vnd / total_orders : null;
      return {
        zone_alias: r.zone_alias,
        impressions: toNum(r.impressions),
        propeller_clicks: toNum(r.propeller_clicks),
        shopee_clicks,
        total_orders,
        cancelled_orders: toNum(r.cancelled_orders),
        revenue_vnd,
        reduct_vnd,
        cost_vnd,
        profit_vnd,
        roi_pct,
        cr_pct,
        cpo_vnd,
      };
    });

    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('[/api/zones]', err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/campaigns/list — dropdown list of campaigns
// ---------------------------------------------------------------------------
router.get('/api/campaigns/list', async (req: Request, res: Response): Promise<void> => {
  try {
    const { dateFrom, dateTo } = parseDateParams(req);

    const result = await pool.query<{ campaign_id: string; campaign_name: string }>(
      `SELECT DISTINCT campaign_id, MAX(campaign_name) AS campaign_name
      FROM partner_propeller_stats
      WHERE stat_date BETWEEN $1 AND $2
        AND campaign_id != '__unknown__'
      GROUP BY campaign_id
      ORDER BY campaign_id`,
      [dateFrom, dateTo]
    );

    res.json({ status: 'success', data: result.rows });
  } catch (err) {
    console.error('[/api/campaigns/list]', err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

export default router;
