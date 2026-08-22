'use server'

import { db, client } from './db'
import { sql } from 'drizzle-orm'
import { getCurrentAdmin, isAdminAuthenticated } from './admin-actions'
import { logAudit } from './actions/audit-actions'
import AdmZip from 'adm-zip'
import { isR2Configured, uploadToR2, getPresignedDownloadUrl, cleanupExpiredBackups } from './r2'
import { sendDatabaseBackupNotification } from './email'

// Helper to check standard admin authentication
async function ensureAdmin() {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    throw new Error('Unauthorized')
  }
}

// Helper to check super admin authentication for mutations
async function ensureSuperAdmin() {
  await ensureAdmin()
  const admin = await getCurrentAdmin()
  if (!admin || admin.role !== 'super_admin') {
    throw new Error('Unauthorized: Only Super Admins have database manipulation overrides.')
  }
}

// 1. Validate if a table name exists in the public schema to prevent SQL Injection
async function validateTableName(tableName: string): Promise<string> {
  const result: any = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = ${tableName}
      AND table_type = 'BASE TABLE'
    LIMIT 1;
  `)
  if (result.length === 0) {
    throw new Error(`Access Denied: Invalid or protected table name "${tableName}"`)
  }
  return tableName
}

// 2. Fetch all public base tables in the database
export async function getDatabaseTables() {
  await ensureAdmin()
  try {
    const result: any = await db.execute(sql`
      SELECT 
        c.relname AS name,
        c.relrowsecurity AS rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' 
        AND c.relkind = 'r'
      ORDER BY c.relname;
    `)

    const tables = result.map((row: any) => ({
      name: row.name as string,
      rlsEnabled: row.rls_enabled as boolean,
      rowCount: 0
    }))

    // Query exact row counts for all tables in parallel
    await Promise.all(
      tables.map(async (t: any) => {
        try {
          const countRes = await client.unsafe(`SELECT count(*)::int FROM public."${t.name}"`)
          t.rowCount = countRes[0]?.count ?? 0
        } catch (err) {
          console.error(`Failed to get exact count for table ${t.name}:`, err)
        }
      })
    )

    return { 
      success: true, 
      tables
    }
  } catch (error: any) {
    console.error('Failed to get database tables:', error)
    return { success: false, error: error.message || 'Failed to list tables.' }
  }
}

// 3. Fetch detailed table structure (columns, types, default values, nullability, primary keys)
export async function getTableDetails(tableName: string) {
  await ensureAdmin()
  try {
    const validTable = await validateTableName(tableName)

    // Columns, primary keys, and foreign keys are three independent
    // catalog reads for the same table — run them concurrently.
    const [columnsResult, pkResult, fkResult]: [any, any, any] = await Promise.all([
      db.execute(sql`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${validTable}
        ORDER BY ordinal_position;
      `),
      db.execute(sql`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_name = ${validTable};
      `),
      db.execute(sql`
        SELECT kcu.column_name,
               ccu.table_name  AS foreign_table,
               ccu.column_name AS foreign_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = ${validTable};
      `),
    ])

    const primaryKeys = pkResult.map((row: any) => row.column_name as string)

    const fkMap = new Map<string, string>()
    for (const row of fkResult) {
      fkMap.set(row.column_name as string, `${row.foreign_table}.${row.foreign_column}`)
    }

    const columns = columnsResult.map((row: any) => ({
      name: row.column_name as string,
      type: row.data_type as string,
      nullable: row.is_nullable === 'YES',
      defaultVal: row.column_default as string | null,
      isPrimaryKey: primaryKeys.includes(row.column_name as string),
      isForeignKey: fkMap.has(row.column_name as string),
      references: fkMap.get(row.column_name as string) || null,
    }))

    return { success: true, columns, primaryKeys }
  } catch (error: any) {
    console.error(`Failed to get details for table ${tableName}:`, error)
    return { success: false, error: error.message || 'Failed to fetch table structure.' }
  }
}

// 4. Fetch table records dynamically with pagination, sorting, and simple filtering
export async function getTableData(
  tableName: string, 
  options: { 
    page: number
    limit: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    filterColumn?: string
    filterValue?: string
    filtersJson?: string
  }
) {
  await ensureAdmin()
  try {
    const validTable = await validateTableName(tableName)
    const page = Math.max(1, options.page)
    const limit = Math.max(1, Math.min(100, options.limit))
    const offset = (page - 1) * limit

    // Validate and sanitize sort column if provided
    let sortSql = ''
    if (options.sortBy) {
      const isColValid: any = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = ${validTable} 
          AND column_name = ${options.sortBy}
        LIMIT 1;
      `)
      if (isColValid.length > 0) {
        const order = options.sortOrder === 'desc' ? 'DESC' : 'ASC'
        sortSql = `ORDER BY "${options.sortBy}" ${order}`
      }
    }

    // Fetch active columns for validation
    const colsResult: any = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = ${validTable};
    `)
    const validColumns = colsResult.map((row: any) => row.column_name as string)

    // Validate and sanitize filter column if provided
    let whereSql = ''
    const params: any[] = []

    if (options.filtersJson) {
      try {
        const parsedFilters = JSON.parse(options.filtersJson)
        if (Array.isArray(parsedFilters) && parsedFilters.length > 0) {
          const clauses: string[] = []
          for (const filter of parsedFilters) {
            const { column, operator, value } = filter
            if (!validColumns.includes(column)) continue

            let clause = ''
            if (operator === 'is_null') {
              clause = `"${column}" IS NULL`
            } else if (operator === 'is_not_null') {
              clause = `"${column}" IS NOT NULL`
            } else if (value !== undefined && value !== null) {
              const valStr = String(value).trim()
              params.push(valStr)
              const paramIdx = `$${params.length}`

              if (operator === 'equals') {
                clause = `CAST("${column}" AS TEXT) = ${paramIdx}`
              } else if (operator === 'contains') {
                params[params.length - 1] = `%${valStr}%`
                clause = `CAST("${column}" AS TEXT) ILIKE ${paramIdx}`
              } else if (operator === 'starts_with') {
                params[params.length - 1] = `${valStr}%`
                clause = `CAST("${column}" AS TEXT) ILIKE ${paramIdx}`
              } else if (operator === 'ends_with') {
                params[params.length - 1] = `%${valStr}`
                clause = `CAST("${column}" AS TEXT) ILIKE ${paramIdx}`
              } else if (operator === 'greater_than') {
                clause = `"${column}" > ${paramIdx}`
              } else if (operator === 'less_than') {
                clause = `"${column}" < ${paramIdx}`
              }
            }

            if (clause) {
              clauses.push(clause)
            }
          }
          if (clauses.length > 0) {
            whereSql = `WHERE ${clauses.join(' AND ')}`
          }
        }
      } catch (err) {
        console.error('Failed to parse filtersJson:', err)
      }
    } else if (options.filterColumn && options.filterValue !== undefined && options.filterValue.trim() !== '') {
      if (validColumns.includes(options.filterColumn)) {
        whereSql = `WHERE CAST("${options.filterColumn}" AS TEXT) ILIKE $1`
        params.push(`%${options.filterValue.trim()}%`)
      }
    }

    // Count query
    const countQuery = `SELECT count(*)::int FROM public."${validTable}" ${whereSql}`
    const countResult = await client.unsafe(countQuery, params)
    const totalRecords = countResult[0]?.count ?? 0

    // Select query
    params.push(limit, offset)
    const dataQuery = `
      SELECT * 
      FROM public."${validTable}" 
      ${whereSql} 
      ${sortSql} 
      LIMIT $${params.length - 1} 
      OFFSET $${params.length}
    `
    const rows = await client.unsafe(dataQuery, params)

    return { 
      success: true, 
      rows: Array.from(rows), 
      totalRecords 
    }
  } catch (error: any) {
    console.error(`Failed to get data for table ${tableName}:`, error)
    return { success: false, error: error.message || 'Failed to fetch table records.' }
  }
}

// 5. Insert a new record into a table (restricted to super_admin)
export async function insertTableRecord(tableName: string, record: Record<string, any>) {
  await ensureSuperAdmin()
  try {
    const validTable = await validateTableName(tableName)

    // Fetch and validate active columns
    const columnsResult: any = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = ${validTable};
    `)
    const validColumns = columnsResult.map((row: any) => row.column_name as string)

    const columnsToInsert: string[] = []
    const valuesToInsert: any[] = []

    for (const [key, value] of Object.entries(record)) {
      if (validColumns.includes(key)) {
        columnsToInsert.push(`"${key}"`)
        // Handle empty strings for numbers/dates by setting to null
        if (value === '') {
          valuesToInsert.push(null)
        } else {
          valuesToInsert.push(value)
        }
      }
    }

    if (columnsToInsert.length === 0) {
      return { success: false, error: 'No valid columns provided for insertion.' }
    }

    const columnsList = columnsToInsert.join(', ')
    const placeholdersList = columnsToInsert.map((_, i) => `$${i + 1}`).join(', ')
    const queryText = `INSERT INTO public."${validTable}" (${columnsList}) VALUES (${placeholdersList}) RETURNING *`

    const inserted = await client.unsafe(queryText, valuesToInsert)
    await logAudit({ category: 'db', action: 'db.insert', target: `${validTable} (1 row)` })
    return { success: true, record: inserted[0] }
  } catch (error: any) {
    console.error(`Failed to insert record in table ${tableName}:`, error)
    return { success: false, error: error.message || 'Failed to insert record.' }
  }
}

// 6. Update cell-level fields in a record (restricted to super_admin)
export async function updateTableRecord(
  tableName: string, 
  primaryKeyName: string, 
  primaryKeyValue: any, 
  updatedFields: Record<string, any>
) {
  await ensureSuperAdmin()
  try {
    const validTable = await validateTableName(tableName)

    // Fetch and validate columns
    const columnsResult: any = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = ${validTable};
    `)
    const validColumns = columnsResult.map((row: any) => row.column_name as string)

    if (!validColumns.includes(primaryKeyName)) {
      return { success: false, error: `Invalid primary key column name: ${primaryKeyName}` }
    }

    const setClauses: string[] = []
    const params: any[] = [primaryKeyValue] // $1 is the primary key value

    for (const [key, value] of Object.entries(updatedFields)) {
      if (validColumns.includes(key) && key !== primaryKeyName) {
        params.push(value === '' ? null : value)
        setClauses.push(`"${key}" = $${params.length}`)
      }
    }

    if (setClauses.length === 0) {
      return { success: false, error: 'No fields to update.' }
    }

    const queryText = `
      UPDATE public."${validTable}" 
      SET ${setClauses.join(', ')} 
      WHERE "${primaryKeyName}" = $1 
      RETURNING *
    `

    const updated = await client.unsafe(queryText, params)
    await logAudit({ category: 'db', action: 'db.update', target: `${validTable} · ${primaryKeyName}=${String(primaryKeyValue).slice(0, 12)}` })
    return { success: true, record: updated[0] }
  } catch (error: any) {
    console.error(`Failed to update record in table ${tableName}:`, error)
    return { success: false, error: error.message || 'Failed to update record.' }
  }
}

// 7. Delete multiple records in a table (restricted to super_admin)
export async function deleteTableRecords(
  tableName: string, 
  primaryKeyName: string, 
  primaryKeyValues: any[]
) {
  await ensureSuperAdmin()
  try {
    const validTable = await validateTableName(tableName)

    // Fetch and validate columns
    const columnsResult: any = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = ${validTable} 
        AND column_name = ${primaryKeyName}
      LIMIT 1;
    `)

    if (columnsResult.length === 0) {
      return { success: false, error: `Invalid primary key name: ${primaryKeyName}` }
    }

    if (primaryKeyValues.length === 0) {
      return { success: false, error: 'No primary key values provided for deletion.' }
    }

    const placeholders = primaryKeyValues.map((_, i) => `$${i + 1}`).join(', ')
    const queryText = `DELETE FROM public."${validTable}" WHERE "${primaryKeyName}" IN (${placeholders})`

    await client.unsafe(queryText, primaryKeyValues)
    await logAudit({ category: 'db', action: 'db.delete', target: `${validTable} (${primaryKeyValues.length} row${primaryKeyValues.length === 1 ? '' : 's'})` })
    return { success: true }
  } catch (error: any) {
    console.error(`Failed to delete records from table ${tableName}:`, error)
    return { success: false, error: error.message || 'Failed to delete records.' }
  }
}

// 8. Get Database Overview info (actual statistics from pg catalog)
export async function getDatabaseOverview() {
  await ensureAdmin()
  try {
    // Steps 1-5, 7 and 8 (below) are all independent single-value/list
    // queries against different catalog views — run them concurrently
    // instead of one round-trip at a time.
    const [dbNameRes, dbSizeRes, connRes, tablesCountRes, versionRes, tableSizes, rolesRes, dbListRes] =
      await Promise.all([
        // 1. Get database name
        client.unsafe(`SELECT current_database() as dbname`),
        // 2. Get database size
        client.unsafe(`SELECT pg_database_size(current_database()) as size`),
        // 3. Get active connections
        client.unsafe(`SELECT count(*)::int as active_conns FROM pg_stat_activity`),
        // 4. Get total tables count in public schema
        client.unsafe(`
          SELECT count(*)::int as count
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `),
        // 5. Get database version
        client.unsafe(`SELECT version()`),
        // 6. Fetch all public tables and their sizes
        client.unsafe(`
          SELECT
            relname AS name,
            pg_total_relation_size(c.oid) AS total_bytes,
            pg_relation_size(c.oid) AS table_bytes,
            pg_indexes_size(c.oid) AS index_bytes
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r'
          ORDER BY pg_total_relation_size(c.oid) DESC
        `),
        // 7. Get Roles List
        client.unsafe(`
          SELECT rolname as name FROM pg_roles WHERE rolcanlogin = true AND rolname NOT LIKE 'pg_%'
        `),
        // 8. Get Database List
        client.unsafe(`
          SELECT datname as name FROM pg_database WHERE datistemplate = false AND datname NOT LIKE 'pg_%'
        `),
      ])

    const dbName = dbNameRes[0]?.dbname || 'neondb'
    const dbSizeBytes = Number(dbSizeRes[0]?.size || 0)
    const dbSizePretty = (dbSizeBytes / (1024 * 1024)).toFixed(2) + ' MB'
    const activeConnections = connRes[0]?.active_conns || 1
    const tablesCount = tablesCountRes[0]?.count || 0
    const version = versionRes[0]?.version || 'PostgreSQL'
    const rolesList = rolesRes.map((r: any) => r.name)
    const dbList = dbListRes.map((d: any) => d.name)

    // Fetch count for each table in public schema
    const tableDetails = await Promise.all(
      tableSizes.map(async (row: any) => {
        const name = row.name as string
        let count = 0
        try {
          const countRes = await client.unsafe(`SELECT count(*)::int FROM public."${name}"`)
          count = countRes[0]?.count || 0
        } catch (e) {}
        
        return {
          name,
          totalSize: (Number(row.total_bytes) / (1024 * 1024) > 0.1) 
            ? (Number(row.total_bytes) / (1024 * 1024)).toFixed(2) + ' MB' 
            : (Number(row.total_bytes) / 1024).toFixed(1) + ' KB',
          tableSize: (Number(row.table_bytes) / (1024 * 1024) > 0.1)
            ? (Number(row.table_bytes) / (1024 * 1024)).toFixed(2) + ' MB'
            : (Number(row.table_bytes) / 1024).toFixed(1) + ' KB',
          indexSize: (Number(row.index_bytes) / (1024 * 1024) > 0.1)
            ? (Number(row.index_bytes) / (1024 * 1024)).toFixed(2) + ' MB'
            : (Number(row.index_bytes) / 1024).toFixed(1) + ' KB',
          rowCount: count
        }
      })
    )

    // 9. Parse actual host and connection details from DATABASE_URL
    const dbUrl = process.env.DATABASE_URL || ''
    let host = 'localhost'
    let port = '5432'
    let user = 'postgres'
    let sslMode = 'disable'
    let maskedUri = dbUrl

    try {
      const cleanUri = dbUrl.split('?')[0] || ''
      const queryParams = dbUrl.split('?')[1] || ''
      
      if (queryParams.includes('sslmode=require') || queryParams.includes('ssl=true') || queryParams.includes('sslmode=verify-full')) {
        sslMode = 'require'
      }
      
      const parts = cleanUri.replace('postgresql://', '').split('@')
      if (parts.length === 2) {
        const credentials = parts[0] || ''
        const serverAndDb = parts[1] || ''
        const credParts = credentials.split(':')
        user = credParts[0] || 'postgres'
        
        const serverParts = serverAndDb.split('/')
        const serverHostAndPort = serverParts[0] || ''
        const hostParts = serverHostAndPort.split(':')
        host = hostParts[0] || 'localhost'
        port = hostParts[1] || '5432'
      }
      maskedUri = dbUrl.replace(/postgresql:\/\/([^:]+):([^@]+)@/, 'postgresql://$1:••••••••@')
    } catch (err) {
      console.error('Failed to parse connection URI:', err)
    }

    // 10 & 11 are each independent, soft-failing (default on error) stats
    // reads — run all three underlying queries concurrently.
    const [uptime, { cacheHitRatio, commits }] = await Promise.all([
      // 10. Query server uptime
      (async () => {
        try {
          const uptimeRes = await client.unsafe(`SELECT pg_postmaster_start_time() as start_time`)
          const startTimeVal = uptimeRes[0]?.start_time
          if (!startTimeVal) return 'N/A'
          const diffMs = Date.now() - new Date(startTimeVal).getTime()
          const diffSecs = Math.floor(diffMs / 1000)
          const diffMins = Math.floor(diffSecs / 60)
          const diffHours = Math.floor(diffMins / 60)
          const diffDays = Math.floor(diffHours / 24)

          if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`
          if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`
          return `${diffMins}m`
        } catch (e) {
          console.error('Failed to query server uptime:', e)
          return 'N/A'
        }
      })(),
      // 11. Query Cache Hit Ratio & Transactions Commits count
      (async () => {
        try {
          const [cacheRes, xactRes] = await Promise.all([
            client.unsafe(`
              SELECT
                COALESCE(round(sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0), 2), 100.0) as hit_ratio
              FROM pg_stat_database
              WHERE datname = current_database()
            `),
            client.unsafe(`
              SELECT
                sum(xact_commit) as commits
              FROM pg_stat_database
              WHERE datname = current_database()
            `),
          ])
          const cacheHitRatio = Number(cacheRes[0]?.hit_ratio || 100).toFixed(2) + '%'

          const commitsCount = Number(xactRes[0]?.commits || 0)
          let commits: string
          if (commitsCount > 1000000) {
            commits = (commitsCount / 1000000).toFixed(1) + 'M'
          } else if (commitsCount > 1000) {
            commits = (commitsCount / 1000).toFixed(0) + 'K'
          } else {
            commits = commitsCount.toString()
          }
          return { cacheHitRatio, commits }
        } catch (e) {
          console.error('Failed to query cache ratio/commits:', e)
          return { cacheHitRatio: '100.00%', commits: '0' }
        }
      })(),
    ])

    return {
      success: true,
      dbName,
      dbSize: dbSizePretty,
      activeConnections,
      tablesCount,
      version,
      tableDetails,
      rolesList,
      dbList,
      host,
      port,
      user,
      sslMode,
      maskedUri,
      uptime,
      cacheHitRatio,
      commits
    }
  } catch (error: any) {
    console.error('Failed to fetch database overview:', error)
    return { success: false, error: error.message || 'Failed to fetch database overview.' }
  }
}

// 9. Get running active queries in the database
export async function getActiveQueries() {
  await ensureAdmin()
  try {
    const result = await client.unsafe(`
      SELECT 
        pid, 
        query, 
        state, 
        now() - query_start AS duration,
        usename AS user
      FROM pg_stat_activity 
      WHERE state IS NOT NULL 
        AND query NOT LIKE '%pg_stat_activity%'
        AND query <> ''
      ORDER BY query_start DESC
      LIMIT 15
    `)
    return {
      success: true,
      queries: result.map((r: any) => {
        // Format PG interval to human readable text
        let durationStr = '0s'
        if (r.duration) {
          const secs = Math.round(Number(r.duration.seconds || 0))
          const mins = Math.round(Number(r.duration.minutes || 0))
          if (mins > 0) {
            durationStr = `${mins}m ${secs}s`
          } else {
            durationStr = `${secs}s`
          }
        }
        return {
          pid: r.pid,
          query: r.query,
          state: r.state,
          duration: durationStr,
          user: r.user || 'system'
        }
      })
    }
  } catch (error: any) {
    console.error('Failed to fetch active queries:', error)
    return { success: false, error: error.message || 'Failed to fetch active queries.' }
  }
}

// Helper to safely split multi-statement SQL strings
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let inDollarQuote = false
  let dollarQuoteTag = ''
  let inLineComment = false
  let inBlockComment = false
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i]
    const nextChar = sql[i + 1] || ''
    
    // Handle comments
    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false
      }
      current += char
      continue
    }
    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false
        current += '*/'
        i++
      } else {
        current += char
      }
      continue
    }
    
    // Check for comments start
    if (char === '-' && nextChar === '-') {
      inLineComment = true
      current += '--'
      i++
      continue
    }
    if (char === '/' && nextChar === '*') {
      inBlockComment = true
      current += '/*'
      i++
      continue
    }
    
    // Handle quotes
    if (inSingleQuote) {
      if (char === "'") {
        if (nextChar === "'") {
          current += "''"
          i++
        } else {
          inSingleQuote = false
          current += "'"
        }
      } else {
        current += char
      }
      continue
    }
    if (inDoubleQuote) {
      if (char === '"') {
        inDoubleQuote = false
        current += '"'
      } else {
        current += char
      }
      continue
    }
    if (inDollarQuote) {
      if (char === '$') {
        const sub = sql.slice(i, i + dollarQuoteTag.length)
        if (sub === dollarQuoteTag) {
          inDollarQuote = false
          current += dollarQuoteTag
          i += dollarQuoteTag.length - 1
        } else {
          current += char
        }
      } else {
        current += char
      }
      continue
    }
    
    // Check for quotes start
    if (char === "'") {
      inSingleQuote = true
      current += "'"
      continue
    }
    if (char === '"') {
      inDoubleQuote = true
      current += '"'
      continue
    }
    if (char === '$' && nextChar === '$') {
      inDollarQuote = true
      dollarQuoteTag = '$$'
      current += '$$'
      i++
      continue
    }
    if (char === '$') {
      const match = sql.slice(i).match(/^(\$[a-zA-Z0-9_]*\$)/)
      if (match) {
        inDollarQuote = true
        dollarQuoteTag = match[1]
        current += dollarQuoteTag
        i += dollarQuoteTag.length - 1
        continue
      }
    }
    
    // Semicolon split
    if (char === ';') {
      if (current.trim()) {
        statements.push(current.trim())
      }
      current = ''
    } else {
      current += char
    }
  }
  
  if (current.trim()) {
    statements.push(current.trim())
  }
  
  return statements
}

// 10. Execute custom SQL query
export async function executeSQLQuery(query: string) {
  await ensureAdmin()
  const admin = await getCurrentAdmin()
  if (!admin) {
    throw new Error('Unauthorized')
  }

  const isSuperAdmin = admin.role === 'super_admin'

  try {
    const startTime = performance.now()
    
    // Split the query into statements and run them in sequence
    const statements = splitSqlStatements(query)
    if (statements.length === 0) {
      return {
        success: true,
        headers: [],
        rows: [],
        affectedRows: 0,
        duration: 0
      }
    }

    let lastResult: any = null
    let totalAffectedRows = 0

    if (isSuperAdmin) {
      for (const stmt of statements) {
        lastResult = await client.unsafe(stmt)
        if (lastResult && lastResult.count !== undefined) {
          totalAffectedRows += lastResult.count
        }
      }
    } else {
      try {
        await client.begin(async (sql) => {
          await sql.unsafe('SET TRANSACTION READ ONLY;')
          for (const stmt of statements) {
            lastResult = await sql.unsafe(stmt)
            if (lastResult && lastResult.count !== undefined) {
              totalAffectedRows += lastResult.count
            }
          }
        })
      } catch (err: any) {
        const isWriteErr = 
          err.code === '25006' || // read_only_sql_transaction
          err.code === '42501' || // insufficient_privilege
          (err.message && err.message.toLowerCase().includes('read-only transaction')) ||
          (err.message && err.message.toLowerCase().includes('permission denied'))
          
        if (isWriteErr) {
          return {
            success: false,
            requiresApproval: true,
            error: 'This query modifies database state and requires Super Admin approval.'
          }
        }
        throw err
      }
    }

    const endTime = performance.now()
    const durationMs = Math.round(endTime - startTime)

    const rows = Array.isArray(lastResult) ? lastResult : []
    const headers = rows.length > 0 ? Object.keys(rows[0]) : []

    return {
      success: true,
      headers,
      rows,
      affectedRows: lastResult?.count !== undefined ? lastResult.count : rows.length,
      duration: durationMs
    }
  } catch (error: any) {
    console.error('SQL Execution failed:', error)
    return { success: false, error: error.message || 'Query execution failed.' }
  }
}

// 11. Get Database Metrics for Monitoring (querying actual pg statistics)
export async function getDatabaseMetrics() {
  await ensureAdmin()
  try {
    // All 8 stat queries below are independent of one another — run them
    // concurrently instead of one round-trip at a time.
    const [connRes, maxConnRes, rowsRes, deadlocksRes, cacheRes, dbSizeRes, allDbsSizeRes, xactRes] =
      await Promise.all([
        // 1. Get connections metrics
        client.unsafe(`
          SELECT
            count(*)::int as total,
            count(*) FILTER (where state = 'active' AND query NOT LIKE '%pg_stat_activity%')::int as active,
            count(*) FILTER (where state = 'idle')::int as idle,
            count(*) FILTER (where wait_event IS NOT NULL AND state = 'active')::int as waiting
          FROM pg_stat_activity
        `),
        // Get max connections
        client.unsafe(`SHOW max_connections`),
        // 2. Get rows operations metrics
        client.unsafe(`
          SELECT
            sum(tup_inserted)::bigint as inserted,
            sum(tup_updated)::bigint as updated,
            sum(tup_deleted)::bigint as deleted
          FROM pg_stat_database
          WHERE datname = current_database()
        `),
        // 3. Get deadlocks count
        client.unsafe(`
          SELECT deadlocks::int FROM pg_stat_database WHERE datname = current_database()
        `),
        // 4. Get cache hit rate
        client.unsafe(`
          SELECT
            COALESCE(round(sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0), 2), 100.0) as hit_ratio
          FROM pg_stat_database
          WHERE datname = current_database()
        `),
        // 5. Get database size in MB
        client.unsafe(`SELECT pg_database_size(current_database()) as size`),
        // 6. Get all databases size in MB
        client.unsafe(`
          SELECT sum(pg_database_size(datname))::bigint as all_dbs_size
          FROM pg_database
          WHERE datistemplate = false
        `),
        // 7. Get transaction commits and rollbacks
        client.unsafe(`
          SELECT
            COALESCE(xact_commit, 0)::bigint as commits,
            COALESCE(xact_rollback, 0)::bigint as rollbacks
          FROM pg_stat_database
          WHERE datname = current_database()
        `),
      ])

    const active = connRes[0]?.active || 0
    const idle = connRes[0]?.idle || 0
    const total = connRes[0]?.total || 0
    const waiting = connRes[0]?.waiting || 0
    const maxConns = Number(maxConnRes[0]?.max_connections || 100)
    const inserted = Number(rowsRes[0]?.inserted || 0)
    const updated = Number(rowsRes[0]?.updated || 0)
    const deleted = Number(rowsRes[0]?.deleted || 0)
    const deadlocks = deadlocksRes[0]?.deadlocks || 0
    const cacheHitRate = Number(cacheRes[0]?.hit_ratio || 100)
    const dbSizeBytes = Number(dbSizeRes[0]?.size || 0)
    const dbSizeMb = Number((dbSizeBytes / (1024 * 1024)).toFixed(2))
    const allDbsSizeBytes = Number(allDbsSizeRes[0]?.all_dbs_size || dbSizeBytes)
    const allDbsSizeMb = Number((allDbsSizeBytes / (1024 * 1024)).toFixed(2))
    const xactCommits = Number(xactRes[0]?.commits || 0)
    const xactRollbacks = Number(xactRes[0]?.rollbacks || 0)

    return {
      success: true,
      connections: { active, idle, total, max: maxConns, waiting },
      rows: { inserted, updated, deleted },
      deadlocks,
      cacheHitRate,
      dbSizeMb,
      allDbsSizeMb,
      transactions: { commits: xactCommits, rollbacks: xactRollbacks }
    }
  } catch (error: any) {
    console.error('Failed to fetch database metrics:', error)
    return { success: false, error: error.message || 'Failed to fetch metrics.' }
  }
}

// 12. Get Database Query Performance (querying pg_stat_statements or falling back to pg_stat_activity)
export async function getDatabaseQueryPerformance() {
  await ensureAdmin()
  try {
    // Check if pg_stat_statements extension is enabled
    const hasExtRes = await client.unsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
      ) as has_ext
    `)
    const hasExt = hasExtRes[0]?.has_ext ?? false

    if (hasExt) {
      try {
        // Query pg_stat_statements. Check column names first.
        const colsRes = await client.unsafe(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'pg_stat_statements' 
            AND column_name = 'total_exec_time'
          LIMIT 1
        `)
        const hasTotalExecTime = colsRes.length > 0
        const timeCol = hasTotalExecTime ? 'total_exec_time' : 'total_time'

        const result = await client.unsafe(`
          SELECT 
            pg_get_userbyid(userid) AS role,
            calls::int AS calls,
            round((${timeCol} / 1000)::numeric, 4) AS total_time_sec,
            round((${timeCol} / calls)::numeric, 2) AS average_time_ms,
            query
          FROM pg_stat_statements
          ORDER BY ${timeCol} DESC
          LIMIT 15
        `)

        return {
          success: true,
          performance: result.map((r: any) => ({
            role: r.role || 'postgres',
            calls: r.calls,
            averageTime: r.average_time_ms + ' ms',
            totalTime: r.total_time_sec + ' s',
            query: r.query
          }))
        }
      } catch (err: any) {
        console.error('Failed to query pg_stat_statements, falling back:', err)
      }
    }

    // Fallback: Query pg_stat_activity to get real-time running/recent queries
    const result = await client.unsafe(`
      SELECT 
        usename AS role,
        state,
        now() - query_start AS duration,
        query
      FROM pg_stat_activity
      WHERE query NOT LIKE '%pg_stat_activity%'
        AND query <> ''
        AND query NOT LIKE '%pg_stat_database%'
      ORDER BY query_start DESC
      LIMIT 15
    `)

    return {
      success: true,
      performance: result.map((r: any) => {
        let durationMs = 0
        if (r.duration) {
          durationMs = Math.round(Number(r.duration.seconds || 0) * 1000 + Number(r.duration.milliseconds || 0))
        }
        return {
          role: r.role || 'postgres',
          calls: 1,
          averageTime: (durationMs > 0 ? durationMs : 1) + ' ms',
          totalTime: (durationMs / 1000).toFixed(4) + ' s',
          query: r.query
        }
      })
    }
  } catch (error: any) {
    console.error('Failed to fetch query performance:', error)
    return { success: false, error: error.message || 'Failed to fetch query performance.' }
  }
}

// 13. Get Database advisors recommendations (dynamic security & index optimization advices)
export async function getDatabaseAdvisors() {
  await ensureAdmin()
  try {
    // All 5 queries below are independent reads describing different facets
    // of the schema — run them concurrently instead of one at a time.
    const [tablesRes, indexesRes, columnsRes, rlsRes, activeConnsRes] = await Promise.all([
      // 1. Fetch all user tables in public schema
      client.unsafe(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `),
      // 2. Fetch all indexes in public schema
      client.unsafe(`
        SELECT tablename, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
      `),
      // 3. Fetch all columns in public schema
      client.unsafe(`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
      `),
      // Security check source: RLS status per table
      client.unsafe(`
        SELECT relname as name, relrowsecurity as rls
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
      `),
      // Generic system health advisor source
      client.unsafe(`SELECT count(*)::int as count FROM pg_stat_activity`),
    ])

    const tables = tablesRes.map((t: any) => t.table_name as string)
    const indexes = indexesRes.map((idx: any) => ({
      table: idx.tablename as string,
      def: idx.indexdef as string
    }))

    const recommendations: Array<{
      id: string
      type: 'index' | 'security' | 'performance'
      title: string
      description: string
      sqlSuggestion?: string
    }> = []

    // Security check: Check if RLS is enabled on all tables
    for (const tableRow of rlsRes) {
      const name = tableRow.name as string
      const rls = tableRow.rls as boolean
      if (!rls && name !== 'waitlist_config') {
        recommendations.push({
          id: `rls_${name}`,
          type: 'security',
          title: `Row-level security not active on ${name}`,
          description: `The table '${name}' has no active RLS policy controls. Unauthenticated users or client-side bypasses could read all data if security rules are modified.`,
          sqlSuggestion: `ALTER TABLE public."${name}" ENABLE ROW LEVEL SECURITY;`
        })
      }
    }

    // Index advisor: Check for missing index on common foreign keys or query keys
    const commonKeys = ['email', 'userId', 'user_id', 'githubId', 'contactEmail']
    
    for (const table of tables) {
      const tableCols = columnsRes.filter((c: any) => c.table_name === table)
      const tableIndexes = indexes.filter(idx => idx.table === table)

      for (const col of tableCols) {
        const colName = col.column_name as string
        if (commonKeys.includes(colName)) {
          // Check if this column is indexed (definition contains the column name in parentheses)
          const isIndexed = tableIndexes.some(idx => {
            const match = idx.def.match(/\((.*?)\)/)
            if (match && match[1]) {
              const cols = match[1].split(',').map(s => s.trim().replace(/"/g, ''))
              return cols.includes(colName)
            }
            return false
          })

          if (!isIndexed) {
            const indexName = `idx_${table}_${colName.toLowerCase()}`
            recommendations.push({
              id: `index_${table}_${colName}`,
              type: 'index',
              title: `Missing index on ${table}.${colName}`,
              description: `A common lookup or foreign key column '${colName}' in table '${table}' has no corresponding database index. Query performance will degrade at scale.`,
              sqlSuggestion: `CREATE INDEX "${indexName}" ON public."${table}" ("${colName}");`
            })
          }
        }
      }
    }

    // Generic system health advisor:
    const activeConns = activeConnsRes[0]?.count || 0
    if (activeConns > 50) {
      recommendations.push({
        id: 'conn_warn',
        type: 'performance',
        title: 'High connection count detected',
        description: `Currently there are ${activeConns} open database connections. Consider setting up a connection pooler like pgBouncer or Neon connection pooling to prevent OOM.`,
      })
    }

    return {
      success: true,
      recommendations
    }
  } catch (error: any) {
    console.error('Failed to fetch database advisors:', error)
    return { success: false, error: error.message || 'Failed to fetch database advisors.' }
  }
}

// 14. Log database table export action
export async function logTableExportAction(tableName: string, format: string, count: number) {
  await ensureAdmin()
  await logAudit({
    category: 'db',
    action: `db.export_${format.toLowerCase()}`,
    target: `${tableName} (${count} row${count === 1 ? '' : 's'})`
  })
  return { success: true }
}

// 15. Submit SQL query request for Super Admin approval
export async function submitSQLQueryRequest(queryText: string) {
  await ensureAdmin()
  const admin = await getCurrentAdmin()
  if (!admin) throw new Error('Unauthorized')

  try {
    await db.execute(sql`
      INSERT INTO public.sql_query_requests (requester_id, query_text, status)
      VALUES (${admin.id}, ${queryText}, 'pending');
    `)

    // Log in audit log
    await logAudit({
      actorId: admin.id,
      actorName: admin.name,
      category: 'db',
      action: 'sql.request',
      target: 'sql_query_requests',
      metadata: { queryText: queryText.substring(0, 500) }
    })

    // Prune query requests older than 7 days in the background
    db.execute(sql`
      DELETE FROM public.sql_query_requests 
      WHERE created_at < now() - interval '7 days';
    `).catch(err => console.error('Failed to prune old SQL query requests:', err))

    return { success: true }
  } catch (error: any) {
    console.error('Failed to submit SQL request:', error)
    return { success: false, error: error.message || 'Failed to submit request.' }
  }
}

// 16. Fetch SQL query requests logs
export async function getSQLQueryRequests() {
  await ensureAdmin()
  const admin = await getCurrentAdmin()
  if (!admin) throw new Error('Unauthorized')

  try {
    let result: any[] = []
    if (admin.role === 'super_admin') {
      result = await db.execute(sql`
        SELECT 
          r.id,
          r.query_text as "queryText",
          r.status,
          r.created_at as "createdAt",
          r.reviewed_at as "reviewedAt",
          r.rejection_reason as "rejectionReason",
          r.execution_duration_ms as "executionDurationMs",
          r.execution_results as "executionResults",
          r.execution_error as "executionError",
          a.name as "requesterName",
          rev.name as "reviewerName"
        FROM public.sql_query_requests r
        JOIN public.admins a ON a.id = r.requester_id
        LEFT JOIN public.admins rev ON rev.id = r.reviewed_by
        ORDER BY r.created_at DESC;
      `)
    } else {
      result = await db.execute(sql`
        SELECT 
          r.id,
          r.query_text as "queryText",
          r.status,
          r.created_at as "createdAt",
          r.reviewed_at as "reviewedAt",
          r.rejection_reason as "rejectionReason",
          r.execution_duration_ms as "executionDurationMs",
          r.execution_results as "executionResults",
          r.execution_error as "executionError",
          a.name as "requesterName",
          rev.name as "reviewerName"
        FROM public.sql_query_requests r
        JOIN public.admins a ON a.id = r.requester_id
        LEFT JOIN public.admins rev ON rev.id = r.reviewed_by
        WHERE r.requester_id = ${admin.id}
        ORDER BY r.created_at DESC;
      `)
    }

    return {
      success: true,
      requests: result
    }
  } catch (error: any) {
    console.error('Failed to get SQL requests:', error)
    return { success: false, error: error.message || 'Failed to list requests.' }
  }
}

// 17. Review a pending SQL query request (approve and run, or reject)
export async function reviewSQLQueryRequest(requestId: string, action: 'approve' | 'reject', rejectionReason?: string) {
  await ensureSuperAdmin()
  const reviewer = await getCurrentAdmin()
  if (!reviewer) throw new Error('Unauthorized')

  try {
    const reqRes: any = await db.execute(sql`
      SELECT id, query_text as "queryText", status 
      FROM public.sql_query_requests 
      WHERE id = ${requestId} 
      LIMIT 1;
    `)
    if (reqRes.length === 0) {
      return { success: false, error: 'Request not found.' }
    }
    const request = reqRes[0]
    if (request.status !== 'pending') {
      return { success: false, error: 'Request is no longer pending.' }
    }

    if (action === 'reject') {
      await db.execute(sql`
        UPDATE public.sql_query_requests
        SET status = 'rejected',
            reviewed_by = ${reviewer.id},
            reviewed_at = now(),
            rejection_reason = ${rejectionReason || 'No reason provided'}
        WHERE id = ${requestId};
      `)

      await logAudit({
        actorId: reviewer.id,
        actorName: reviewer.name,
        category: 'db',
        action: 'sql.reject',
        target: 'sql_query_requests',
        metadata: { requestId }
      })

      return { success: true }
    }

    const queryToExecute = request.queryText
    const startTime = performance.now()
    let lastResult: any = null
    let totalAffectedRows = 0
    let durationMs = 0
    let success = true
    let executionError: string | null = null

    try {
      const statements = splitSqlStatements(queryToExecute)
      for (const stmt of statements) {
        lastResult = await client.unsafe(stmt)
        if (lastResult && lastResult.count !== undefined) {
          totalAffectedRows += lastResult.count
        }
      }
      const endTime = performance.now()
      durationMs = Math.round(endTime - startTime)
    } catch (err: any) {
      success = false
      executionError = err.message || 'Execution failed.'
      console.error('Approved SQL execution failed:', err)
    }

    if (success) {
      const rows = Array.isArray(lastResult) ? lastResult : []
      const headers = rows.length > 0 ? Object.keys(rows[0]) : []
      
      const cappedRows = rows.slice(0, 100)
      const resultsJson = JSON.stringify({
        headers,
        rows: cappedRows,
        rowCount: rows.length,
        affectedRows: lastResult?.count !== undefined ? lastResult.count : rows.length,
        wasCapped: rows.length > 100
      })

      await db.execute(sql`
        UPDATE public.sql_query_requests
        SET status = 'approved',
            reviewed_by = ${reviewer.id},
            reviewed_at = now(),
            execution_duration_ms = ${durationMs},
            execution_results = ${resultsJson}::jsonb,
            execution_error = NULL
        WHERE id = ${requestId};
      `)

      await logAudit({
        actorId: reviewer.id,
        actorName: reviewer.name,
        category: 'db',
        action: 'sql.approve',
        target: 'sql_query_requests',
        metadata: { requestId, durationMs }
      })
    } else {
      await db.execute(sql`
        UPDATE public.sql_query_requests
        SET status = 'approved',
            reviewed_by = ${reviewer.id},
            reviewed_at = now(),
            execution_error = ${executionError}
        WHERE id = ${requestId};
      `)

      await logAudit({
        actorId: reviewer.id,
        actorName: reviewer.name,
        category: 'db',
        action: 'sql.approve_failed',
        target: 'sql_query_requests',
        metadata: { requestId, error: executionError }
      })
    }

    // Prune query requests older than 7 days in the background
    db.execute(sql`
      DELETE FROM public.sql_query_requests 
      WHERE created_at < now() - interval '7 days';
    `).catch(err => console.error('Failed to prune old SQL query requests:', err))

    return { success: true }
  } catch (error: any) {
    console.error('Failed to review SQL request:', error)
    return { success: false, error: error.message || 'Failed to process request.' }
  }
}

/**
 * Generates CSV content for a single table in the public schema.
 */
async function getTableCsv(tableName: string): Promise<string> {
  const colsResult: any = await db.execute(sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = ${tableName}
    ORDER BY ordinal_position;
  `)
  const headers = colsResult.map((row: any) => row.column_name as string)
  if (headers.length === 0) return ''

  const rows: any = await db.execute(sql.raw(`SELECT * FROM public."${tableName}"`))

  const csvRows = [headers.join(',')]

  for (const row of rows) {
    const values = headers.map((header: string) => {
      const val = row[header]
      if (val === null || val === undefined) {
        return '""'
      }
      const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val)
      const escaped = valStr.replace(/"/g, '""')
      return `"${escaped}"`
    })
    csvRows.push(values.join(','))
  }

  return csvRows.join('\n')
}

/**
 * Server Action: Compiles all public tables into a ZIP archive,
 * uploads it to R2, generates a 12-hour presigned download URL,
 * and notifies active administrators.
 */
export async function generateDatabaseBackupAction(): Promise<{
  success: boolean
  url?: string
  error?: string
}> {
  await ensureAdmin()

  // Run cleanup of expired backups on-demand
  try {
    await cleanupExpiredBackups()
  } catch (cleanupErr) {
    console.error('Failed to run on-demand backup cleanup:', cleanupErr)
  }

  try {
    const tablesResult: any = await db.execute(sql`
      SELECT c.relname AS name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' 
        AND c.relkind = 'r'
      ORDER BY c.relname;
    `)
    const tableNames = tablesResult.map((row: any) => row.name as string)

    const zip = new AdmZip()
    for (const tableName of tableNames) {
      const csvContent = await getTableCsv(tableName)
      zip.addFile(`${tableName}.csv`, Buffer.from(csvContent, 'utf-8'))
    }
    const zipBuffer = zip.toBuffer()

    if (!isR2Configured()) {
      return {
        success: false,
        error: 'Cloudflare R2 is not configured. Cannot upload backup.'
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const key = `backups/db-backup-${timestamp}.zip`
    
    await uploadToR2(zipBuffer, key, 'application/zip')

    const downloadUrl = await getPresignedDownloadUrl(key, 43200)

    const expiryDate = new Date(Date.now() + 12 * 60 * 60 * 1000)
    const expiryTimeIST = expiryDate.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' IST'

    await sendDatabaseBackupNotification(downloadUrl, expiryTimeIST)

    await logAudit({
      category: 'db',
      action: 'database.backup_generated',
      target: `Full database ZIP backup generated and uploaded to R2. Key: ${key}. Notification sent to admins.`
    })

    return {
      success: true,
      url: downloadUrl
    }
  } catch (error: any) {
    console.error('Backup generation action failed:', error)
    return {
      success: false,
      error: error.message || 'Failed to generate backup.'
    }
  }
}

