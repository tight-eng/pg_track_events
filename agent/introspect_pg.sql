WITH tables AS (
    SELECT c.oid AS table_oid,
        n.nspname AS schema_name,
        c.relname AS table_name
    FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' -- ordinary tables only
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
),
/* ---------- columns --------------------------------------------------- */
cols AS (
    SELECT t.table_oid,
        a.attnum AS att_position,
        a.attname AS col_name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) AS col_type,
        a.attnotnull AS not_null,
        pg_get_expr(ad.adbin, ad.adrelid) AS default_expr,
        -- auto-increment if identity OR nextval(…seq…) default
        (
            a.attidentity IN ('a', 'd')
            OR pg_get_expr(ad.adbin, ad.adrelid) ~* 'nextval'
        ) AS auto_increment
    FROM tables t
        JOIN pg_attribute a ON a.attrelid = t.table_oid
        AND a.attnum > 0 -- skip system columns
        AND NOT a.attisdropped
        LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid
        AND ad.adnum = a.attnum
),
/* ---------- primary keys --------------------------------------------- */
pks AS (
    SELECT t.table_oid,
        ARRAY_AGG(
            a.attname
            ORDER BY ord
        ) AS pk_cols
    FROM tables t
        JOIN pg_index i ON i.indrelid = t.table_oid
        AND i.indisprimary
        JOIN LATERAL UNNEST(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON TRUE
        JOIN pg_attribute a ON a.attrelid = t.table_oid
        AND a.attnum = k.attnum
    GROUP BY t.table_oid
),
/* ---------- foreign keys --------------------------------------------- */
fks AS (
    SELECT con.conrelid AS table_oid,
        con.conname AS fk_name,
        con.confdeltype AS fk_deltype,
        ARRAY_AGG(
            src.attname
            ORDER BY ord
        ) AS src_cols,
        (ref_ns.nspname || '.' || ref_cls.relname) AS ref_table,
        ARRAY_AGG(
            ref.attname
            ORDER BY ord
        ) AS ref_cols
    FROM pg_constraint con
        JOIN LATERAL UNNEST(
            con.conkey,
            con.confkey
        ) WITH ORDINALITY AS k(
            src_att,
            ref_att,
            ord
        ) ON TRUE
        JOIN pg_attribute src ON src.attrelid = con.conrelid
        AND src.attnum = k.src_att
        JOIN pg_class ref_cls ON ref_cls.oid = con.confrelid
        JOIN pg_namespace ref_ns ON ref_ns.oid = ref_cls.relnamespace
        JOIN pg_attribute ref ON ref.attrelid = con.confrelid
        AND ref.attnum = k.ref_att
    WHERE con.contype = 'f'
    GROUP BY con.conrelid,
        con.confdeltype,
        con.conname,
        ref_ns.nspname,
        ref_cls.relname
),
/* ---------- indexes (excluding PKs) ---------------------------------- */
idx AS (
    SELECT t.table_oid,
        i.relname AS idx_name,
        x.indisunique AS is_unique,
        am.amname AS idx_type,
        ARRAY_AGG(
            a.attname
            ORDER BY ord
        ) AS idx_cols
    FROM tables t
        JOIN pg_index x ON x.indrelid = t.table_oid
        AND NOT x.indisprimary
        JOIN pg_class i ON i.oid = x.indexrelid
        JOIN pg_am am ON am.oid = i.relam
        JOIN LATERAL UNNEST(x.indkey) WITH ORDINALITY AS k(attnum, ord) ON TRUE
        JOIN pg_attribute a ON a.attrelid = t.table_oid
        AND a.attnum = k.attnum
    GROUP BY t.table_oid,
        i.relname,
        x.indisunique,
        am.amname
),
/* ---------- triggers -------------------------------------------------- */
trg AS (
    SELECT tg.tgrelid AS table_oid,
        tg.tgname AS trig_name,
        (tg.tgconstraint <> 0) AS constraint_trig,
        ARRAY_REMOVE(
            -- derive firing events from tgtype bitmask
            ARRAY [
                CASE WHEN (tgtype &  4) <> 0 THEN 'INSERT'   END,
                CASE WHEN (tgtype &  8) <> 0 THEN 'DELETE'   END,
                CASE WHEN (tgtype & 16) <> 0 THEN 'UPDATE'   END,
                CASE WHEN (tgtype & 32) <> 0 THEN 'TRUNCATE' END
            ],
            NULL
        ) AS trig_events,
        ((tgtype & 1) <> 0) AS for_each_row,
        ((tgtype & 2) <> 0) AS for_each_statement,
        pg_get_expr(tg.tgqual, tg.tgrelid) AS trig_when,
        regexp_replace(
            pg_get_triggerdef(tg.oid),
            '.*EXECUTE PROCEDURE\s+([^ ]+)\(.*',
            '\1'
        ) AS exec_proc,
        /* decode the bytea, trim the trailing NUL, then split on NULs */
        array_remove(
            -- get rid of trailing ''
            string_to_array(
                encode(tg.tgargs, 'escape'),
                -- bytea → 'foo\000bar\000'
                '\\000' -- split on the escape
            ),
            '' -- remove last empty chunk
        ) AS trig_args
    FROM pg_trigger tg
        JOIN tables t ON t.table_oid = tg.tgrelid
    WHERE NOT tg.tgisinternal
)
/* ---------- FINAL JSON ------------------------------------------------ */
SELECT jsonb_pretty(
        jsonb_agg(
            jsonb_build_object(
                'name',
                t.schema_name || '.' || t.table_name,
                'columns',
                (
                    SELECT jsonb_agg(
                            jsonb_build_object(
                                'name',
                                c.col_name,
                                'type',
                                c.col_type,
                                'constraints',
                                CASE
                                    WHEN c.not_null THEN jsonb_build_object('notNull', true)
                                END,
                                'attributes',
                                CASE
                                    WHEN c.auto_increment THEN jsonb_build_object('autoIncrement', true)
                                END,
                                'default',
                                c.default_expr
                            )
                            ORDER BY c.att_position
                        )
                    FROM cols c
                    WHERE c.table_oid = t.table_oid
                ),
                'primaryKey',
                (
                    SELECT pk_cols
                    FROM pks p
                    WHERE p.table_oid = t.table_oid
                ),
                'foreignKeys',
                (
                    SELECT jsonb_agg(
                            jsonb_build_object(
                                'columns',
                                fk.src_cols,
                                'references',
                                jsonb_build_object(
                                    'table',
                                    fk.ref_table,
                                    'columns',
                                    fk.ref_cols
                                ),
                                'onDelete',
                                CASE
                                    fk.fk_deltype
                                    WHEN 'a' THEN 'NO ACTION'
                                    WHEN 'r' THEN 'RESTRICT'
                                    WHEN 'c' THEN 'CASCADE'
                                    WHEN 'n' THEN 'SET NULL'
                                    WHEN 'd' THEN 'SET DEFAULT'
                                END,
                                'name',
                                fk.fk_name
                            )
                        )
                    FROM fks fk
                    WHERE fk.table_oid = t.table_oid
                ),
                'indexes',
                (
                    SELECT jsonb_agg(
                            jsonb_build_object(
                                'columns',
                                i.idx_cols,
                                'name',
                                i.idx_name,
                                'isUnique',
                                i.is_unique,
                                'type',
                                i.idx_type
                            )
                        )
                    FROM idx i
                    WHERE i.table_oid = t.table_oid
                ),
                'triggers',
                (
                    SELECT jsonb_agg(
                            jsonb_build_object(
                                'name',
                                tr.trig_name,
                                'constraintTrigger',
                                tr.constraint_trig,
                                'events',
                                tr.trig_events,
                                'forEachStatement',
                                tr.for_each_statement,
                                'forEachRow',
                                tr.for_each_row,
                                'condition',
                                tr.trig_when,
                                'executeProcedure',
                                tr.exec_proc,
                                'arguments',
                                tr.trig_args
                            )
                        )
                    FROM trg tr
                    WHERE tr.table_oid = t.table_oid
                ),
                'isDeleted',
                false -- placeholder to match struct
            )
            ORDER BY t.schema_name,
                t.table_name
        )
    ) AS schema_json
FROM tables t;