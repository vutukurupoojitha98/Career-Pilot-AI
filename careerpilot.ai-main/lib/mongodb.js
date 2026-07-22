import { MongoClient } from 'mongodb'

let client
let db
let connectingPromise

async function ensureIndexes(db) {
  // Fire-and-forget index creation. Don't block requests.
  const ops = [
    () => db.collection('users').createIndex({ email: 1 }, { unique: true }),
    () => db.collection('sessions').createIndex({ token: 1 }, { unique: true }),
    () => db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    () => db.collection('resumes').createIndex({ userId: 1, createdAt: -1 }),
    () => db.collection('resume_versions').createIndex({ resumeId: 1, createdAt: -1 }),
    () => db.collection('jobs').createIndex({ userId: 1, createdAt: -1 }),
    () => db.collection('applications').createIndex({ userId: 1, status: 1 }),
    () => db.collection('interviews').createIndex({ userId: 1, createdAt: -1 }),
    () => db.collection('contacts').createIndex({ userId: 1 }),
    () => db.collection('notifications').createIndex({ userId: 1, createdAt: -1 }),
    () => db.collection('audit_logs').createIndex({ at: -1 }),
    () => db.collection('discovered_jobs').createIndex({ userId: 1, discoveredAt: -1 }),
    () => db.collection('feature_flags').createIndex({ key: 1 }, { unique: true }),
  ]
  for (const op of ops) {
    try { await op() } catch (e) { /* index may exist or collection empty */ }
  }
}

async function connect() {
  if (client && db) return db
  if (!process.env.MONGO_URL) throw new Error('MONGO_URL is not configured')
  client = new MongoClient(process.env.MONGO_URL, {
    maxPoolSize: 20,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 8000,
  })
  await client.connect()
  db = client.db(process.env.DB_NAME || 'careerpilot_ai')
  // Kick off index creation in background — DO NOT AWAIT so first request isn't slow
  ensureIndexes(db).catch(e => console.warn('Index setup warning:', e?.message))
  return db
}

export async function getDb() {
  if (db) return db
  if (!connectingPromise) connectingPromise = connect().catch(e => { connectingPromise = null; throw e })
  return connectingPromise
}

export function clean(doc) {
  if (!doc) return doc
  const { _id, passwordHash, ...rest } = doc
  return rest
}

export function cleanArray(arr) {
  return (arr || []).map(clean)
}
