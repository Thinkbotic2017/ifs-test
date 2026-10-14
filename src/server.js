require("dotenv").config();
const express = require("express");
const oracledb = require("oracledb");
const queries = require("./queries");

const app = express();
app.use(express.json({ limit: "32kb" }));
app.use(express.static("public"));

const port = Number(process.env.APP_PORT || 3100);
const host = process.env.APP_HOST || "127.0.0.1";
const timeout = Number(process.env.QUERY_TIMEOUT_MS || 30000);

function config() {
  const required = ["IFS_USER", "IFS_PASSWORD", "IFS_CONNECT_STRING"];
  const missing = required.filter(k => !process.env[k] || process.env[k].startsWith("your-") || process.env[k] === "replace_me");
  if (missing.length) {
    const err = new Error(`Missing Oracle settings: ${missing.join(", ")}. Copy .env.example to .env and fill it in.`);
    err.status = 400;
    throw err;
  }
  return {
    user: process.env.IFS_USER,
    password: process.env.IFS_PASSWORD,
    connectString: process.env.IFS_CONNECT_STRING
  };
}

async function withConnection(fn) {
  let conn;
  try {
    conn = await oracledb.getConnection(config());
    return await fn(conn);
  } finally {
    if (conn) await conn.close();
  }
}

function safeParams(q, overrides = {}) {
  if (q.id === "Q0") return {};
  if (q.id === "Q1") {
    const watermark = overrides.watermarkDate || "2026-10-01 00:00:00";
    const date = new Date(watermark);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid watermark date. Use a valid date/time value.");
    return {
      watermarkDate: date,
      watermarkCursor: String(overrides.watermarkCursor ?? "GE-0001"),
      rowLimit: Math.min(1000, Math.max(1, Math.trunc(Number(overrides.limit || 25))))
    };
  }
  if (q.id === "Q2" || q.id === "Q3") return { gateEntryNo: String(overrides.gateEntryNo || "GE-0002") };
  if (["Q4", "Q5", "Q6"].includes(q.id)) {
    const partNos = Array.isArray(overrides.partNos) && overrides.partNos.length
      ? overrides.partNos.slice(0, 200).map(String)
      : ["PART-A", "PART-B"];
    return { partNos };
  }
  return {};
}

function buildExecution(q, values) {
  if (!["Q4", "Q5", "Q6"].includes(q.id)) return { sql: q.sql, binds: values };
  const partNos = values.partNos;
  if (!partNos.length) return { sql: q.sql.replace(/WHERE PART_NO IN \([^)]+\)/, "WHERE 1 = 0"), binds: {} };
  const bindNames = partNos.map((_, i) => `:part${i}`);
  const sql = q.sql.replace(/WHERE PART_NO IN \([^)]+\)/, `WHERE PART_NO IN (${bindNames.join(", ")})`);
  const binds = Object.fromEntries(partNos.map((value, i) => [`part${i}`, value]));
  return { sql, binds };
}

async function execute(conn, q, overrides = {}) {
  const values = safeParams(q, overrides);
  const { sql, binds } = buildExecution(q, values);
  const start = Date.now();
  let timer;
  try {
    const result = await Promise.race([
      conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Query timed out after ${timeout} ms`)), timeout); })
    ]);
    const displayParams = q.id === "Q4" || q.id === "Q5" || q.id === "Q6" ? values.partNos : values;
    return { id: q.id, name: q.name, sql, params: displayParams, rowCount: result.rows ? result.rows.length : 0, rows: result.rows || [], durationMs: Date.now() - start };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

app.get("/api/health", (_req, res) => res.json({
  ok: true,
  configured: Boolean(process.env.IFS_USER && process.env.IFS_PASSWORD && process.env.IFS_CONNECT_STRING),
  database: "Oracle",
  queryIds: queries.map(q => q.id)
}));

app.get("/api/queries", (_req, res) => res.json(queries.map(({ id, name, description, sql, params }) => ({ id, name, description, sql, sampleParams: params }))));

app.post("/api/test-connection", async (_req, res) => {
  try {
    const result = await withConnection(conn => conn.execute("SELECT 1 AS \"connectionOk\" FROM DUAL", [], { outFormat: oracledb.OUT_FORMAT_OBJECT }));
    res.json({ ok: true, message: "Oracle database connection successful.", result: result.rows[0] });
  } catch (e) {
    res.status(e.status || 502).json({ ok: false, error: e.message });
  }
});

app.post("/api/run-all", async (req, res) => {
  const overrides = req.body || {};
  const results = [];
  try {
    await withConnection(async conn => {
      for (const q of queries) {
        try { results.push({ ...await execute(conn, q, overrides), ok: true }); }
        catch (e) { results.push({ id: q.id, name: q.name, sql: q.sql, ok: false, error: e.message, rowCount: null, rows: [] }); }
      }
    });
    res.json({ ok: results.every(r => r.ok), executedAt: new Date().toISOString(), results });
  } catch (e) {
    res.status(e.status || 502).json({ ok: false, error: e.message, results });
  }
});

app.post("/api/run/:id", async (req, res) => {
  const q = queries.find(x => x.id === req.params.id);
  if (!q) return res.status(404).json({ ok: false, error: "Unknown query ID." });
  try {
    const result = await withConnection(conn => execute(conn, q, req.body || {}));
    res.json({ ok: true, result });
  } catch (e) {
    res.status(e.status || 502).json({ ok: false, error: e.message });
  }
});

app.listen(port, host, () => {
  console.log(`IFS SITS Oracle Query Tester running at http://${host}:${port}`);
  console.log("Read-only query runner. Keep .env private and use a SELECT-only IFS account.");
});
