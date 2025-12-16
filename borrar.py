    def compile(self, text: str) -> str:
        try:
            cleaned = self.nlp.preprocess(text)
            self._log(f"[1] Texto preprocesado: {cleaned}")

            doc = self.nlp.doc(cleaned)

            mentions = self.nlp.onto.mentions(doc)
            self._log(f"[2] Onto mentions: {[(m.type, m.concept, m.text) for m in mentions]}")

            mode = self.reduction_mode
            toks = self.nlp.to_tokens(doc, mentions=mentions, mode=("stopword" if mode == "stopword" else "protected"))
            if mode == "none":
                toks = [Token(text=t.text, lemma=self.nlp.syn.normalize(t.lemma_), pos=t.pos_, is_stop=t.is_stop, dep=t.dep_, idx=t.i) for t in doc]
            self._log(f"[3] Tokens reducidos: {[t.lemma for t in toks]}")

            handler = self._select_handler(doc)
            self._log(f"[4] Acción detectada: {handler.action.value}")

            intent = handler.extract(doc, toks, mentions)
            self._log(f"[5] Intención → action={intent.action.value}, table={intent.table}, "
                      f"cols={intent.columns}, aggs={intent.aggregations}, conds={intent.conditions}")

            sql = handler.generate_sql(intent)
            return sql

        except Exception as e:
            return f"-- Error en compilación: {e}"

    def compile_batch(self, queries: List[str]) -> List[str]:
        out: List[str] = []
        for q in queries:
            sql = self.compile(q)
            out.append(sql)
            if self.verbose:
                print("\nNL:", q)
                print("SQL:", sql)
                print("-" * 80)
        return out

# =========================================================
# Demo
# =========================================================

if __name__ == "__main__":
    engine = NL2SQLiteEngine(language="es", verbose=True, reduction_mode="protected")

    demo = [
        # --- DDL (Estructura) ---
        "Crear una tabla llamada usuarios con las columnas id, nombre, edad correo, fecha",
        "Generar la tabla productos con los campos id, nombre, categoría y precio",

        # --- DML: INSERT ---
        "Insertar en la tabla usuarios a Ana con edad 30 y email ana@mail.com",
        "Añadir un nuevo registro en productos: laptop, electrónica, 1500",

        # --- DML: UPDATE ---
        "Actualizar el correo de Ana a ana.nueva@empresa.com en la tabla usuarios",
        "Modificar el precio del producto iPhone a 999 en la tabla productos",

        # --- DML: DELETE ---
        "Borrar el registro de Luis de la tabla usuarios",
        "Eliminar de la tabla productos todos los items con precio menor a 10",

        # --- DQL: SELECT & FILTROS ---
        "Mostrar todos los usuarios cuya edad sea mayor o igual a 25",
        "Dame los nombres de los usuarios que tengan más de 50 años", # Proyección de columnas
        "Listar los primeros 10 productos con categoría ropa", # LIMIT

        # --- AGREGACIONES ---
        "Contar cuántos productos hay en la categoría electrónicos",
        "Dime el total de la suma de precios de la tabla productos", # SUM
        "¿Cuál es el promedio de edad de los usuarios?", # AVG
        "Muéstrame el precio máximo de los artículos de tipo oficina", # MAX
    ]

    engine.compile_batch(demo)