<!-- src/App.vue -->
<template>
  <div class="min-h-screen">
    <!-- HEADER -->
    <header
      class="flex items-center justify-between px-5 py-4 border-b border-border-subtle backdrop-blur-md sticky top-0 bg-app-bg/65 z-10"
    >
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5affbe] to-[#8778ff]"></div>
        <div>
          <h1 class="font-bold tracking-tight">NL2SQLite Playground</h1>
          <p class="text-[11px] text-white/60">Vue 3 + Vite • FastAPI backend</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <span
          class="text-xs px-3 py-1.5 rounded-full border border-border-subtle transition-colors"
          :class="healthOk ? 'bg-api-ok/20 text-api-ok' : 'bg-api-bad/20 text-api-bad'"
        >
          {{ healthOk ? `API OK (${dbName})` : 'API offline' }}
        </span>

        <button class="btn-base" @click="refreshAll" :disabled="busy">
          ↻ Refrescar
        </button>
      </div>
    </header>

    <!-- MAIN -->
    <main class="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4 p-4">

      <!-- SIDEBAR TABLES -->
      <aside class="flex flex-col gap-3 bg-panel border border-border-subtle rounded-2xl p-4">
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-sm uppercase tracking-wider text-white/50">Tablas</h2>
          <button class="text-xs hover:text-white" @click="refreshTables" :disabled="busy">
            Actualizar
          </button>
        </div>

        <div v-if="tables.length === 0" class="text-sm text-white/40 italic">
          No hay tablas.
        </div>

        <div class="flex flex-col gap-2">
          <button
            v-for="t in tables"
            :key="t"
            @click="selectTable(t)"
            class="flex items-center justify-between p-3 rounded-xl border border-border-subtle text-left transition-all"
            :class="selectedTable === t
              ? 'ring-2 ring-indigo-500/50 bg-white/10'
              : 'bg-white/5 hover:bg-panel-hover'"
          >
            <span class="font-mono text-sm">{{ t }}</span>
          </button>
        </div>

        <!-- TABLE SCHEMA -->
        <div v-if="selectedTable" class="mt-4 pt-4 border-t border-white/5">
          <h3 class="text-sm font-bold mb-3">
            Esquema:
            <span class="font-mono text-indigo-400">{{ selectedTable }}</span>
          </h3>

          <div v-if="describeLoading" class="text-xs text-white/40 animate-pulse">
            Cargando…
          </div>

          <div v-else class="space-y-1">
            <div
              v-for="c in tableSchema"
              :key="c.cid"
              class="grid grid-cols-[1fr_auto] gap-2 items-center p-2 rounded-lg bg-black/20 text-[11px]"
            >
              <span class="font-mono">{{ c.name }}</span>
              <span class="text-white/40">{{ c.type || 'TEXT' }}</span>

              <div class="flex gap-1 col-span-2">
                <span
                  v-if="c.pk"
                  class="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                >
                  PK
                </span>
                <span
                  v-if="c.notnull"
                  class="px-2 py-0.5 rounded bg-api-warn/20 text-api-warn border border-api-warn/30"
                >
                  NOT NULL
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- CENTER -->
      <section class="flex flex-col gap-4">
        <!-- NL INPUT -->
        <div class="bg-panel border border-border-subtle rounded-2xl p-4">
          <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 class="font-bold">Consulta en lenguaje natural</h2>

            <div class="flex items-center gap-4">
              <label class="flex items-center gap-2 cursor-pointer group">
                <div class="relative">
                  <input type="checkbox" v-model="allowWrite" class="sr-only peer" />
                  <div class="w-10 h-5 bg-white/10 rounded-full peer-checked:bg-api-ok/30 border border-white/20"></div>
                  <div class="absolute left-1 top-1 w-3 h-3 bg-white/70 rounded-full peer-checked:translate-x-5"></div>
                </div>
                <span class="text-xs text-white/60 group-hover:text-white">
                  allow_write
                </span>
              </label>

              <button
                class="btn-base bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border-indigo-500/30"
                @click="runNL"
                :disabled="busy || !nl.trim()"
              >
                ▶ Ejecutar
              </button>
            </div>
          </div>

          <textarea
            v-model="nl"
            class="input-base min-h-[120px]"
            placeholder="Ej: crear una tabla llamada usuarios con columnas id, nombre y edad"
          ></textarea>

          <!-- SQL GENERATED -->
          <div class="grid md:grid-cols-2 gap-4 mt-4">
            <div class="p-4 rounded-xl bg-black/30 border border-white/5">
              <h3 class="text-xs font-bold text-white/50 mb-2 uppercase">
                SQL Generado
              </h3>
              <pre class="font-mono text-sm text-emerald-400 overflow-x-auto">
{{ lastSQL || '—' }}
              </pre>
            </div>

            <!-- SQL MANUAL -->
            <div class="p-4 rounded-xl bg-black/30 border border-white/5">
              <h3 class="text-xs font-bold text-white/50 mb-2 uppercase">
                Ejecutar SQL manual
              </h3>

              <textarea
                v-model="sqlInput"
                class="input-base min-h-[80px] font-mono"
                placeholder="SELECT * FROM usuarios"
              ></textarea>

              <div class="flex justify-end mt-3">
                <button
                  class="btn-base text-xs"
                  @click="runSQL"
                  :disabled="busy || !sqlInput.trim()"
                >
                  ▶ Ejecutar SQL
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- RESULT -->
        <div class="bg-panel border border-border-subtle rounded-2xl p-4 flex-1">
          <h2 class="font-bold mb-4 flex items-center gap-2">
            Resultado
            <span v-if="busy" class="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
          </h2>

          <div v-if="error" class="p-3 rounded-xl bg-api-bad/10 border border-api-bad/30 text-api-bad">
            {{ error }}
          </div>

          <div v-else-if="blocked" class="p-3 rounded-xl bg-api-warn/10 border border-api-warn/30 text-api-warn">
            Bloqueado: {{ blockedReason }}
          </div>

          <template v-else>
            <div
              v-if="resultType === 'write'"
              class="p-4 rounded-xl bg-api-ok/10 border border-api-ok/30 text-api-ok"
            >
              ✅ Ejecutada con éxito. Filas afectadas:
              <b>{{ rowcount }}</b>
            </div>

            <div v-else-if="resultType === 'select'" class="space-y-2">
              <div class="text-xs text-white/40 italic">
                Filas encontradas: {{ rowcount }}
              </div>

              <div class="overflow-x-auto rounded-xl border border-white/5">
                <table class="w-full text-left border-collapse">
                  <thead class="bg-white/5 text-white/60 text-xs">
                    <tr>
                      <th
                        v-for="c in columns"
                        :key="c"
                        class="p-3 font-mono border-b border-white/10"
                      >
                        {{ c }}
                      </th>
                    </tr>
                  </thead>

                  <tbody class="text-sm">
                    <tr
                      v-for="(r, i) in rows"
                      :key="i"
                      class="border-b border-white/5 hover:bg-white/5"
                    >
                      <td
                        v-for="c in columns"
                        :key="c"
                        class="p-3 font-mono text-white/80"
                      >
                        {{ r[c] }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div v-else class="text-center py-8 text-white/20 italic">
              Sin datos para mostrar
            </div>
          </template>
        </div>
      </section>

      <!-- LOGS -->
      <aside class="bg-panel border border-border-subtle rounded-2xl p-4 flex flex-col">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-bold text-sm uppercase text-white/50">Activity Logs</h2>
          <button class="text-[10px] bg-white/5 px-2 py-1 rounded" @click="logs = []">
            Limpiar
          </button>
        </div>

        <div class="space-y-2 overflow-y-auto pr-2 custom-scrollbar">
          <div
            v-for="(l, i) in logs"
            :key="i"
            class="p-3 rounded-lg bg-black/20 border border-white/5 text-[11px]"
          >
            <div class="text-indigo-400/70 mb-1 font-mono">{{ l.ts }}</div>
            <div class="text-white/70 break-all font-mono">{{ l.msg }}</div>
          </div>
        </div>
      </aside>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { health, listTables, describeTable, executeNL, executeSQL } from './lib/api'

const nl = ref('crear una tabla llamada usuarios con columnas id, nombre y edad')
const allowWrite = ref(true)
const busy = ref(false)

const healthOk = ref(false)
const dbName = ref('—')

const tables = ref([])
const selectedTable = ref('')
const tableSchema = ref([])
const describeLoading = ref(false)

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
  logs.value.unshift({
    ts: new Date().toLocaleTimeString(),
    msg
  })
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

async function refreshHealth() {
  try {
    const h = await health()
    healthOk.value = !!h.ok
    dbName.value = h.db || '—'
    log('GET /health -> ok')
  } catch {
    healthOk.value = false
    log('GET /health -> error')
  }
}

async function refreshTables() {
  try {
    const res = await listTables()
    tables.value = Array.isArray(res) ? res : res.tables || []
    log(`GET /tables -> ${tables.value.length} tablas`)
  } catch {
    tables.value = []
    log('GET /tables -> error')
  }
}

async function selectTable(t) {
  selectedTable.value = t
  describeLoading.value = true
  tableSchema.value = []
  try {
    const d = await describeTable(t)
    tableSchema.value = d.columns || []
    log(`GET /describe/${t} -> ok`)
  } catch {
    log(`GET /describe/${t} -> error`)
  } finally {
    describeLoading.value = false
  }
}

async function runNL() {
  resetResult()
  busy.value = true
  try {
    log(`POST /execute_nl | allow_write=${allowWrite.value}`)
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

    if (resultType.value === 'write') await refreshTables()
  } catch (e) {
    error.value = e?.message || 'Error de conexión'
  } finally {
    busy.value = false
  }
}

async function runSQL() {
  resetResult()
  busy.value = true
  try {
    log(`POST /execute_sql | allow_write=${allowWrite.value}`)
    const out = await executeSQL(sqlInput.value, allowWrite.value)

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

    if (resultType.value === 'write') await refreshTables()
  } catch (e) {
    error.value = e?.message || 'Error en SQL'
  } finally {
    busy.value = false
  }
}

async function refreshAll() {
  await refreshHealth()
  await refreshTables()
  if (selectedTable.value) await selectTable(selectedTable.value)
}

onMounted(refreshAll)
</script>

<style scoped>
@reference "./style.css";

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  @apply bg-white/10 rounded-full;
}
</style>
