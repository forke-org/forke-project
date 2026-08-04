import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

// Connection pool tuning. RDS db.t3.micro allows ~35 total connections, so we
// cap each serverless instance well below that to avoid "too many clients".
// This only changes connection management — schema, queries and table views
// are completely unaffected.
const connectionOptions: postgres.Options<{}> = {
  max: 10,            // max connections held by this client
  idle_timeout: 20,   // close idle connections after 20s (frees RDS slots)
  connect_timeout: 10, // fail fast if RDS can't be reached in 10s
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
