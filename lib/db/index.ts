import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

// Connection pool tuning. PgBouncer's default_pool_size is 50 against Postgres'
// max_connections of 200, so we cap each serverless instance well below that to
// avoid exhausting the pool under concurrent cold starts.
// This only changes connection management — schema, queries and table views
// are completely unaffected.
const connectionOptions: postgres.Options<{}> = {
  max: 10,            // max connections held by this client
  idle_timeout: 20,   // close idle connections after 20s (frees pool slots)
  connect_timeout: 10, // fail fast if the DB can't be reached in 10s
  prepare: false,      // disable prepared statements for pgBouncer compatibility
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
