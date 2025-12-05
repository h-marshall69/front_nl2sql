<!-- src\App.vue -->
<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <div class="dot"></div>
        <div>
          <div class="title">NL2SQLite Playground</div>
          <div class="subtitle">Vue 3 + Vite • FastAPI backend</div>
        </div>
      </div>

      <div class="status">
        <span class="pill" :class="healthOk ? 'ok' : 'bad'">
          {{ healthOk ? `API OK (${dbName})` : 'API offline' }}
        </span>
        <button class="btn" @click="refreshAll" :disabled="busy">
          ↻ Refrescar
        </button>
      </div>
    </header>

    <main class="grid">
      <!-- Sidebar: tablas -->
      <aside class="panel">
        <div class="panel-header">
          <div class="panel-title">Tablas</div>
          <button class="btn ghost" @click="refreshTables" :disabled="busy">Actualizar</button>
        </div>

        <div v-if="tables.length === 0" class="muted">
          No hay tablas (o no se pudo conectar).
        </div>

        <div class="table-list">
          <button
            v-for="t in tables"
            :key="t"
            class="table-item"
            :class="{ active: selectedTable === t }"
            @click="selectTable(t)"
          >
            <span class="mono">{{ t }}</span>
          </button>
        </div>

        <div v-if="selectedTable" class="describe">
          <div class="panel-title">Describe: <span class="mono">{{ selectedTable }}</span></div>
          <div v-if="describeLoading" class="muted">Cargando…</div>
          <div v-else-if="describeError" class="error">{{ describeError }}</div>
          <div v-else class="schema">
            <div v-for="c in tableSchema" :key="c.cid" class="schema-row">
              <div class="mono">{{ c.name }}</div>
              <div class="muted">{{ c.type || 'TEXT' }}</div>
              <div class="tag" v-if="c.pk">PK</div>
              <div class="tag warn" v-if="c.notnull">NOT NULL</div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Center: NL input + SQL + results -->
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title">Consulta en lenguaje natural</div>
          <div class="row">
            <label class="switch">
              <input type="checkbox" v-model="allowWrite" />
              <span class="slider"></span>
            </label>
            <span class="muted">allow_write</span>

            <button class="btn primary" @click="runNL" :disabled="busy || !nl.trim()">
              ▶ Ejecutar NL
            </button>
            <button class="btn" @click="onlyCompile" :disabled="busy || !nl.trim()">
              { } Compilar
            </button>
          </div>
        </div>

        <textarea
          v-model="nl"
          class="textarea"
          placeholder="Ej: crear una tabla llamada usuarios con columnas: id, nombre, edad y correo"
          rows="5"
        ></textarea>

        <div class="split">
          <div class="box">
            <div class="box-title">SQL generado</div>
            <pre class="pre mono">{{ lastSQL || '—' }}</pre>
            <div v-if="blocked" class="warnbox">
              Bloqueado: {{ blockedReason }}
            </div>
          </div>

          <div class="box">
            <div class="box-title">Ejecutar SQL directo (opcional)</div>
            <textarea
              v-model="sqlInput"
              class="textarea small"
              placeholder="Pegá SQL aquí…"
              rows="4"
            ></textarea>
            <div class="row right">
              <button class="btn" @click="runSQL" :disabled="busy || !sqlInput.trim()">
                ▶ Ejecutar SQL
              </button>
            </div>
          </div>
        </div>

        <div class="box">
          <div class="box-title">Resultado</div>

          <div v-if="busy" class="muted">Procesando…</div>
          <div v-else-if="error" class="error">{{ error }}</div>

          <template v-else>
            <div v-if="resultType === 'write'" class="okbox">
              ✅ Query ejecutada. Filas afectadas: <b>{{ rowcount }}</b>
            </div>

            <div v-else-if="resultType === 'select'">
              <div class="muted">Filas: {{ rowcount }}</div>
              <div class="tablewrap" v-if="rows.length">
                <table class="result-table">
                  <thead>
                    <tr>
                      <th v-for="c in columns" :key="c" class="mono">{{ c }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(r, idx) in rows" :key="idx">
                      <td v-for="c in columns" :key="c" class="mono">
                        {{ r[c] }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="muted">Sin resultados.</div>
            </div>

            <div v-else class="muted">—</div>
          </template>
        </div>
      </section>

      <!-- Right: logs -->
      <aside class="panel">
        <div class="panel-header">
          <div class="panel-title">Logs</div>
          <button class="btn ghost" @click="logs = []" :disabled="busy || logs.length === 0">
            Limpiar
          </button>
        </div>

        <div class="logs">
          <div v-if="logs.length === 0" class="muted">Sin logs aún.</div>
          <div v-for="(l, i) in logs" :key="i" class="logline">
            <div class="muted">{{ l.ts }}</div>
            <div class="mono">{{ l.msg }}</div>
          </div>
        </div>
      </aside>
    </main>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { health, listTables, describeTable, compileNL, executeNL, executeSQL } from './lib/api'

const nl = ref('crear una tabla llamada usuarios con columnas: id, nombre, edad y correo')
const allowWrite = ref(true)
const busy = ref(false)

const healthOk = ref(false)
const dbName = ref('—')

const tables = ref([])
const selectedTable = ref('')
const tableSchema = ref([])
const describeLoading = ref(false)
const describeError = ref('')

const lastSQL = ref('')
const sqlInput = ref('')

const resultType = ref('')
const columns = ref([])
const rows = ref([])
const rowcount = ref(0)

const blocked = ref(false)
const blockedReason = ref('')
const error = ref('')

const logs = ref([])

function log(msg) {
  const ts = new Date().toLocaleTimeString()
  logs.value.unshift({ ts, msg })
}

async function refreshHealth() {
  try {
    const h = await health()
    healthOk.value = !!h.ok
    dbName.value = h.db || '—'
    log(`GET /health -> ok=${healthOk.value}`)
  } catch (e) {
    healthOk.value = false
    dbName.value = '—'
    log(`GET /health -> error`)
  }
}

async function refreshTables() {
  try {
    tables.value = await listTables()
    log(`GET /tables -> ${tables.value.length} tables`)
  } catch (e) {
    tables.value = []
    log(`GET /tables -> error`)
  }
}

async function selectTable(t) {
  selectedTable.value = t
  describeLoading.value = true
  describeError.value = ''
  tableSchema.value = []
  try {
    const d = await describeTable(t)
    tableSchema.value = d.columns || []
    log(`GET /describe/${t} -> ${tableSchema.value.length} cols`)
  } catch (e) {
    describeError.value = e?.message || 'Error al describir tabla'
    log(`GET /describe/${t} -> error`)
  } finally {
    describeLoading.value = false
  }
}

function resetResult() {
  resultType.value = ''
  columns.value = []
  rows.value = []
  rowcount.value = 0
  blocked.value = false
  blockedReason.value = ''
  error.value = ''
}

async function onlyCompile() {
  resetResult()
  busy.value = true
  try {
    log(`POST /compile {nl}`)
    const out = await compileNL(nl.value)
    lastSQL.value = out.sql || ''
    sqlInput.value = lastSQL.value
  } catch (e) {
    error.value = e?.response?.data?.detail || e?.message || 'Error compilando'
  } finally {
    busy.value = false
  }
}

async function runNL() {
  resetResult()
  busy.value = true
  try {
    log(`POST /execute_nl allow_write=${allowWrite.value}`)
    const out = await executeNL(nl.value, allowWrite.value)
    lastSQL.value = out.sql || ''
    sqlInput.value = lastSQL.value

    if (out.blocked) {
      blocked.value = true
      blockedReason.value = out.reason || 'blocked'
      return
    }

    const res = out.result || {}
    resultType.value = res.type || ''
    rowcount.value = res.rowcount ?? 0
    columns.value = res.columns || []
    rows.value = res.rows || []

    // refresca tablas si fue write
    if (resultType.value === 'write') await refreshTables()
  } catch (e) {
    error.value = e?.response?.data?.detail || e?.message || 'Error ejecutando'
  } finally {
    busy.value = false
  }
}

async function runSQL() {
  resetResult()
  busy.value = true
  try {
    log(`POST /execute_sql allow_write=${allowWrite.value}`)
    const out = await executeSQL(sqlInput.value, allowWrite.value)

    if (out.blocked) {
      blocked.value = true
      blockedReason.value = out.reason || 'blocked'
      lastSQL.value = sqlInput.value
      return
    }

    lastSQL.value = sqlInput.value
    const res = out.result || {}

    resultType.value = res.type || ''
    rowcount.value = res.rowcount ?? 0
    columns.value = res.columns || []
    rows.value = res.rows || []

    if (resultType.value === 'write') await refreshTables()
  } catch (e) {
    error.value = e?.response?.data?.detail || e?.message || 'Error ejecutando SQL'
  } finally {
    busy.value = false
  }
}

async function refreshAll() {
  await refreshHealth()
  await refreshTables()
  if (selectedTable.value) await selectTable(selectedTable.value)
}

onMounted(async () => {
  await refreshAll()
})
</script>

<style>
:root {
  --bg: #0b1020;
  --panel: rgba(255, 255, 255, 0.06);
  --panel2: rgba(255, 255, 255, 0.04);
  --text: rgba(255, 255, 255, 0.92);
  --muted: rgba(255, 255, 255, 0.65);
  --border: rgba(255, 255, 255, 0.12);
  --ok: rgba(90, 255, 190, 0.18);
  --bad: rgba(255, 90, 120, 0.18);
  --warn: rgba(255, 200, 80, 0.18);
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: radial-gradient(1000px 600px at 30% 0%, rgba(135,120,255,0.18), transparent 60%),
              radial-gradient(900px 500px at 90% 10%, rgba(90,255,190,0.12), transparent 55%),
              var(--bg);
  color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}

.app {
  min-height: 100vh;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 18px;
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  background: rgba(11, 16, 32, 0.65);
}

.brand { display: flex; align-items: center; gap: 12px; }
.dot {
  width: 34px; height: 34px; border-radius: 10px;
  background: linear-gradient(135deg, rgba(90,255,190,0.9), rgba(135,120,255,0.9));
}
.title { font-weight: 700; letter-spacing: 0.2px; }
.subtitle { font-size: 12px; color: var(--muted); margin-top: 2px; }

.status { display: flex; align-items: center; gap: 10px; }

.pill {
  font-size: 12px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--panel);
}
.pill.ok { background: var(--ok); }
.pill.bad { background: var(--bad); }

.grid {
  display: grid;
  grid-template-columns: 280px 1fr 320px;
  gap: 14px;
  padding: 14px;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 12px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.panel-title { font-weight: 700; }
.muted { color: var(--muted); font-size: 13px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }

.table-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.table-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid var(--border);
  background: var(--panel2);
  color: var(--text);
  border-radius: 12px;
  padding: 10px 10px;
  cursor: pointer;
  text-align: left;
}
.table-item:hover { border-color: rgba(255,255,255,0.22); }
.table-item.active { outline: 2px solid rgba(135,120,255,0.45); }

.describe { margin-top: 14px; }
.schema {
  margin-top: 8px;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px;
  background: var(--panel2);
}
.schema-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto auto;
  gap: 8px;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.schema-row:last-child { border-bottom: none; }
.tag {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.05);
}
.tag.warn { background: var(--warn); }

.textarea {
  width: 100%;
  border: 1px solid var(--border);
  background: rgba(0,0,0,0.25);
  color: var(--text);
  border-radius: 14px;
  padding: 12px;
  outline: none;
  resize: vertical;
  line-height: 1.35;
}
.textarea.small { border-radius: 12px; padding: 10px; }

.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
}

.box {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 10px;
  background: rgba(255,255,255,0.04);
  margin-top: 10px;
}
.box-title { font-weight: 700; margin-bottom: 8px; }

.pre {
  margin: 0;
  padding: 10px;
  border-radius: 12px;
  background: rgba(0,0,0,0.25);
  border: 1px solid rgba(255,255,255,0.06);
  min-height: 58px;
  overflow: auto;
}

.btn {
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.06);
  color: var(--text);
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 600;
}
.btn:hover { border-color: rgba(255,255,255,0.22); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn.primary {
  background: linear-gradient(135deg, rgba(135,120,255,0.35), rgba(90,255,190,0.28));
}
.btn.ghost { background: transparent; }

.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.row.right { justify-content: flex-end; }

.logs {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 75vh;
  overflow: auto;
  padding-right: 6px;
}
.logline {
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(0,0,0,0.23);
  border-radius: 12px;
  padding: 10px;
}

.error {
  background: rgba(255, 90, 120, 0.12);
  border: 1px solid rgba(255, 90, 120, 0.22);
  padding: 10px;
  border-radius: 12px;
}
.okbox {
  background: rgba(90, 255, 190, 0.12);
  border: 1px solid rgba(90, 255, 190, 0.22);
  padding: 10px;
  border-radius: 12px;
}
.warnbox {
  margin-top: 10px;
  background: rgba(255, 200, 80, 0.12);
  border: 1px solid rgba(255, 200, 80, 0.22);
  padding: 10px;
  border-radius: 12px;
}

.switch {
  position: relative;
  width: 46px;
  height: 26px;
  display: inline-block;
}
.switch input { display: none; }
.slider {
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 999px;
  transition: 0.2s;
}
.slider::after {
  content: "";
  position: absolute;
  width: 20px;
  height: 20px;
  top: 2px; left: 2px;
  background: rgba(255,255,255,0.85);
  border-radius: 999px;
  transition: 0.2s;
}
.switch input:checked + .slider {
  background: rgba(90, 255, 190, 0.22);
}
.switch input:checked + .slider::after {
  transform: translateX(20px);
}

/* responsive */
@media (max-width: 1100px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
