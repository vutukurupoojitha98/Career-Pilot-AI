import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { getDb } from './mongodb'
import { v4 as uuidv4 } from 'uuid'

const COOKIE_NAME = 'cpai_token'
const SECRET = process.env.JWT_SECRET || 'dev_secret'
const TTL_DAYS = 30

export async function hashPassword(password) {
  return bcrypt.hash(password, 10)
}
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: `${TTL_DAYS}d` })
}
export function verifyToken(token) {
  try { return jwt.verify(token, SECRET) } catch { return null }
}

export async function createUser({ email, password, name, provider = 'password', picture = null }) {
  const db = await getDb()
  const existing = await db.collection('users').findOne({ email: email.toLowerCase() })
  if (existing) throw new Error('User with this email already exists')
  const passwordHash = password ? await hashPassword(password) : null
  const isAdmin = email.toLowerCase() === (process.env.ADMIN_EMAIL || '').toLowerCase()
  const user = {
    id: uuidv4(),
    email: email.toLowerCase(),
    name: name || email.split('@')[0],
    picture,
    passwordHash,
    provider,
    role: isAdmin ? 'admin' : 'user',
    plan: 'free',
    settings: { theme: 'system', aiProvider: 'openai', aiModel: 'gpt-5', notifyEmail: true, locationPref: '' },
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await db.collection('users').insertOne(user)
  return user
}

export async function findUserByEmail(email) {
  const db = await getDb()
  return db.collection('users').findOne({ email: email.toLowerCase() })
}
export async function findUserById(id) {
  const db = await getDb()
  return db.collection('users').findOne({ id })
}

export async function setAuthCookie(userId) {
  const token = signToken({ userId })
  const expires = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000)
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires,
  })
  const db = await getDb()
  await db.collection('sessions').insertOne({ token, userId, createdAt: new Date(), expiresAt: expires })
  return token
}

export async function clearAuthCookie() {
  const store = await cookies()
  const t = store.get('cpai_token')?.value
  store.delete('cpai_token')
  if (t) {
    const db = await getDb()
    await db.collection('sessions').deleteOne({ token: t })
  }
}

export async function getCurrentUser(request) {
  let token = null
  if (request) {
    const cookieHeader = request.headers.get('cookie') || ''
    const m = cookieHeader.split(';').map(s => s.trim()).find(s => s.startsWith('cpai_token='))
    if (m) token = m.split('=')[1]
  } else {
    try {
      const store = await cookies()
      token = store.get('cpai_token')?.value
    } catch {}
  }
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload?.userId) return null
  const user = await findUserById(payload.userId)
  return user
}
