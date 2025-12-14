// src/lib/api.js
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Accept": "application/json",
    "ngrok-skip-browser-warning": "true", // Clave para saltar el aviso de ngrok
  },
});

export async function health() {
  const { data } = await api.get("/health");
  return data; // Retorna { ok: true, db: "..." }
}

export async function listTables() {
  const { data } = await api.get("/tables");
  // Como tu API devuelve { "tables": [...] }, accedemos a data.tables
  return data.tables || [];
}

export async function describeTable(name) {
  // encodeURIComponent asegura que nombres de tabla con espacios o caracteres raros no rompan la URL
  const { data } = await api.get(`/describe/${encodeURIComponent(name)}`);
  return data; // Retorna { columns: [...] }
}

export async function compileNL(nl) {
  const { data } = await api.post("/compile", { nl });
  return data;
}

export async function executeNL(nl, allow_write) {
  const { data } = await api.post("/execute_nl", { nl, allow_write });
  return data;
}

export async function executeSQL(sql, allow_write) {
  const { data } = await api.post("/execute_sql", { sql, allow_write });
  return data;
}