// Importa axios
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL

export const api = axios.create({
  baseURL: BASE_URL,
})

// Funciones de utilidad para las llamadas a la API
export async function health() {
  const { data } = await api.get('/health');
  return data;
}

export async function listTables() {
  const { data } = await api.get('/tables');
  // Asegúrate de manejar el caso si data.tables no existe
  return data.tables || []; 
}

export async function describeTable(name) {
  // Corregido: encodeURIComponent va aquí
  const { data } = await api.get(`/describe/${encodeURIComponent(name)}`);
  return data;
}

export async function compileNL(nl) {
  const { data } = await api.post('/compile', { nl });
  return data;
}

export async function executeNL(nl, allow_write) {
  const { data } = await api.post('/execute_nl', { nl, allow_write });
  return data;
}

export async function executeSQL(sql, allow_write) {
  const { data } = await api.post('/execute_sql', { sql, allow_write });
  return data;
}
