import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

// Connection pool tuning. DATABASE_URL points at Supabase's Supavisor pooler
// (transaction mode, port 6543), which caps the free tier at a small pool, so we
// keep each serverless instance well below it to avoid "too many clients".
// This only changes connection management — schema, queries and table views
// are completely unaffected.
const connectionOptions: postgres.Options<{}> = {
  max: 10,            // max connections held by this client
  idle_timeout: 20,   // close idle connections after 20s (frees pooler slots)
  connect_timeout: 10, // fail fast if the pooler can't be reached in 10s
  prepare: false,      // required: transaction-mode pooling can't reuse prepared statements
}

export let client: postgres.Sql;

if (process.env.NODE_ENV === 'production') {
  client = postgres(process.env.DATABASE_URL, connectionOptions)
} else {
  if (!(global as any).postgresClient) {
    (global as any).postgresClient = postgres(process.env.DATABASE_URL, connectionOptions)
  }
  client = (global as any).postgresClient
}

export const db = drizzle(client, { schema })
export * from './schema'
