// src/lib/api.js
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Accept": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

/* =======================
   HEALTH
======================= */
export async function health() {
  const { data } = await api.get("/health");
  return data; // { ok: true, db: "..." }
}

/* =======================
   METADATA / SCHEMA
======================= */
export async function listTables() {
  const { data } = await api.get("/tables");
  return data.tables || [];
}

export async function describeTable(name) {
  const { data } = await api.get(
    `/describe/${encodeURIComponent(name)}`
  );
  return data; // { table, columns }
}

export async function getFullSchema() {
  const { data } = await api.get("/schema");
  return data.schema || {};
}

export async function getTableData(name, limit = 10) {
  const { data } = await api.get(
    `/data/${encodeURIComponent(name)}`,
    { params: { limit } }
  );
  return data; // ExecutionResult
}

/* =======================
   NL → SQL
======================= */
export async function compileNL(nl) {
  const { data } = await api.post("/compile", {
    nl,
    get_log: false,
  });
  return data; // { nl, sql }
}

export async function compileNLWithLog(nl) {
  const { data } = await api.post("/compile_log", {
    nl,
    get_log: true,
  });
  return data; // [ { step, message, timestamp } ]
}

/* =======================
   EXECUTION
======================= */
export async function executeNL(nl, allow_write = false) {
  const { data } = await api.post("/execute_nl", {
    nl,
    allow_write,
  });
  return data;
}

export async function executeSQL(sql, allow_write = false) {
  const { data } = await api.post("/execute_sql", {
    sql,
    allow_write,
  });
  return data;
}
