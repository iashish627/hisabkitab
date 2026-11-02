import express from 'express'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

const app = express()
const { Pool } = pg
const PORT = process.env.PORT || 10000
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
})

app.set('trust proxy', 1)
app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(express.json({ limit: '2mb' }))
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }))

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS parcel_logs (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      customer_name TEXT NOT NULL DEFAULT 'Name not detected',
      mode TEXT NOT NULL CHECK (mode IN ('dispatch','rto','return')),
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS parcel_logs_created_at_idx ON parcel_logs(created_at);
    CREATE INDEX IF NOT EXISTS parcel_logs_code_idx ON parcel_logs(code);
  `)
}

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token || !process.env.JWT_SECRET) return res.status(401).json({ error: 'Please sign in.' })
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next() }
  catch { return res.status(401).json({ error: 'Session expired. Please sign in again.' }) }
}

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, database: 'connected' }) }
  catch { res.status(503).json({ ok: false, database: 'unavailable' }) }
})

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {}
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD_HASH || !process.env.JWT_SECRET) {
    return res.status(503).json({ error: 'Admin login is not configured yet.' })
  }
  const valid = username === process.env.ADMIN_USERNAME &&
    typeof password === 'string' &&
    await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH)
  if (!valid) return res.status(401).json({ error: 'Incorrect username or password.' })
  const token = jwt.sign({ sub: process.env.ADMIN_USERNAME }, process.env.JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, username: process.env.ADMIN_USERNAME })
})

app.get('/api/parcels', requireAuth, async (req, res) => {
  const { from, to, mode } = req.query
  const where = [], values = []
  if (from) { values.push(from); where.push('created_at >=  }
  if (to) { values.push(to); where.push('created_at < ( }
  if (mode && ['dispatch','rto','return'].includes(mode)) { values.push(mode); where.push('mode =  }
  const sql = 'SELECT id, code, customer_name AS "customerName", mode, created_at AS "createdAt" FROM parcel_logs ' +
    (where.length ? 'WHERE ' + where.join(' AND ') : '') + ' ORDER BY created_at DESC LIMIT 20000'
  const { rows } = await pool.query(sql, values)
  res.json({ parcels: rows })
})

app.post('/api/parcels', requireAuth, async (req, res) => {
  const { id, code, customerName, mode, createdAt } = req.body || {}
  if (!id || !String(code || '').trim() || !['dispatch','rto','return'].includes(mode)) return res.status(400).json({ error: 'Invalid parcel record.' })
  try {
    const { rows } = await pool.query(
      'INSERT INTO parcel_logs (id,code,customer_name,mode,created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id,code,customer_name AS "customerName",mode,created_at AS "createdAt"',
      [String(id), String(code).trim(), String(customerName || 'Name not detected').trim(), mode, createdAt || new Date().toISOString()]
    )
    res.status(201).json({ parcel: rows[0] })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'This parcel record already exists.' })
    throw error
  }
})

app.post('/api/parcels/import', requireAuth, async (req, res) => {
  const parcels = req.body?.parcels
  if (!Array.isArray(parcels) || parcels.length > 10000) return res.status(400).json({ error: 'Invalid import batch.' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let imported = 0
    for (const p of parcels) {
      if (!p?.id || !String(p.code || '').trim() || !['dispatch','rto','return'].includes(p.mode)) continue
      const result = await client.query(
        'INSERT INTO parcel_logs (id,code,customer_name,mode,created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
        [String(p.id), String(p.code).trim(), String(p.customerName || 'Name not detected').trim(), p.mode, p.createdAt || new Date().toISOString()]
      )
      imported += result.rowCount
    }
    await client.query('COMMIT')
    res.json({ imported })
  } catch (error) {
    await client.query('ROLLBACK'); throw error
  } finally { client.release() }
})

app.patch('/api/parcels/:id', requireAuth, async (req, res) => {
  const { customerName } = req.body || {}
  const { rows } = await pool.query(
    'UPDATE parcel_logs SET customer_name=$1, updated_at=NOW() WHERE id=$2 RETURNING id',
    [String(customerName || '').trim() || 'Name not detected', req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: 'Parcel not found.' })
  res.json({ ok: true })
})

app.delete('/api/parcels/:id', requireAuth, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM parcel_logs WHERE id=$1', [req.params.id])
  if (!rowCount) return res.status(404).json({ error: 'Parcel not found.' })
  res.json({ ok: true })
})

app.use((error, _req, res, _next) => {
  console.error('API error:', error.message)
  res.status(500).json({ error: 'Server error. Please retry.' })
})

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`HisabKitab API listening on ${PORT}`))
}).catch(error => {
  console.error('Database initialization failed:', error)
  process.exit(1)
})
 + values.length + '::date') }
  if (to) { values.push(to); where.push(`created_at < ($\u007bvalues.length\u007d::date + INTERVAL '1 day')`) }
  if (mode && ['dispatch','rto','return'].includes(mode)) { values.push(mode); where.push(`mode = $\u007bvalues.length\u007d`) }
  const sql = 'SELECT id, code, customer_name AS "customerName", mode, created_at AS "createdAt" FROM parcel_logs ' +
    (where.length ? 'WHERE ' + where.join(' AND ') : '') + ' ORDER BY created_at DESC LIMIT 20000'
  const { rows } = await pool.query(sql, values)
  res.json({ parcels: rows })
})

app.post('/api/parcels', requireAuth, async (req, res) => {
  const { id, code, customerName, mode, createdAt } = req.body || {}
  if (!id || !String(code || '').trim() || !['dispatch','rto','return'].includes(mode)) return res.status(400).json({ error: 'Invalid parcel record.' })
  try {
    const { rows } = await pool.query(
      'INSERT INTO parcel_logs (id,code,customer_name,mode,created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id,code,customer_name AS "customerName",mode,created_at AS "createdAt"',
      [String(id), String(code).trim(), String(customerName || 'Name not detected').trim(), mode, createdAt || new Date().toISOString()]
    )
    res.status(201).json({ parcel: rows[0] })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'This parcel record already exists.' })
    throw error
  }
})

app.post('/api/parcels/import', requireAuth, async (req, res) => {
  const parcels = req.body?.parcels
  if (!Array.isArray(parcels) || parcels.length > 10000) return res.status(400).json({ error: 'Invalid import batch.' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let imported = 0
    for (const p of parcels) {
      if (!p?.id || !String(p.code || '').trim() || !['dispatch','rto','return'].includes(p.mode)) continue
      const result = await client.query(
        'INSERT INTO parcel_logs (id,code,customer_name,mode,created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
        [String(p.id), String(p.code).trim(), String(p.customerName || 'Name not detected').trim(), p.mode, p.createdAt || new Date().toISOString()]
      )
      imported += result.rowCount
    }
    await client.query('COMMIT')
    res.json({ imported })
  } catch (error) {
    await client.query('ROLLBACK'); throw error
  } finally { client.release() }
})

app.patch('/api/parcels/:id', requireAuth, async (req, res) => {
  const { customerName } = req.body || {}
  const { rows } = await pool.query(
    'UPDATE parcel_logs SET customer_name=$1, updated_at=NOW() WHERE id=$2 RETURNING id',
    [String(customerName || '').trim() || 'Name not detected', req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: 'Parcel not found.' })
  res.json({ ok: true })
})

app.delete('/api/parcels/:id', requireAuth, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM parcel_logs WHERE id=$1', [req.params.id])
  if (!rowCount) return res.status(404).json({ error: 'Parcel not found.' })
  res.json({ ok: true })
})

app.use((error, _req, res, _next) => {
  console.error('API error:', error.message)
  res.status(500).json({ error: 'Server error. Please retry.' })
})

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`HisabKitab API listening on ${PORT}`))
}).catch(error => {
  console.error('Database initialization failed:', error)
  process.exit(1)
})
 + values.length + '::date + INTERVAL \'1 day\')') }
  if (mode && ['dispatch','rto','return'].includes(mode)) { values.push(mode); where.push(`mode = $\u007bvalues.length\u007d`) }
  const sql = 'SELECT id, code, customer_name AS "customerName", mode, created_at AS "createdAt" FROM parcel_logs ' +
    (where.length ? 'WHERE ' + where.join(' AND ') : '') + ' ORDER BY created_at DESC LIMIT 20000'
  const { rows } = await pool.query(sql, values)
  res.json({ parcels: rows })
})

app.post('/api/parcels', requireAuth, async (req, res) => {
  const { id, code, customerName, mode, createdAt } = req.body || {}
  if (!id || !String(code || '').trim() || !['dispatch','rto','return'].includes(mode)) return res.status(400).json({ error: 'Invalid parcel record.' })
  try {
    const { rows } = await pool.query(
      'INSERT INTO parcel_logs (id,code,customer_name,mode,created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id,code,customer_name AS "customerName",mode,created_at AS "createdAt"',
      [String(id), String(code).trim(), String(customerName || 'Name not detected').trim(), mode, createdAt || new Date().toISOString()]
    )
    res.status(201).json({ parcel: rows[0] })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'This parcel record already exists.' })
    throw error
  }
})

app.post('/api/parcels/import', requireAuth, async (req, res) => {
  const parcels = req.body?.parcels
  if (!Array.isArray(parcels) || parcels.length > 10000) return res.status(400).json({ error: 'Invalid import batch.' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let imported = 0
    for (const p of parcels) {
      if (!p?.id || !String(p.code || '').trim() || !['dispatch','rto','return'].includes(p.mode)) continue
      const result = await client.query(
        'INSERT INTO parcel_logs (id,code,customer_name,mode,created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
        [String(p.id), String(p.code).trim(), String(p.customerName || 'Name not detected').trim(), p.mode, p.createdAt || new Date().toISOString()]
      )
      imported += result.rowCount
    }
    await client.query('COMMIT')
    res.json({ imported })
  } catch (error) {
    await client.query('ROLLBACK'); throw error
  } finally { client.release() }
})

app.patch('/api/parcels/:id', requireAuth, async (req, res) => {
  const { customerName } = req.body || {}
  const { rows } = await pool.query(
    'UPDATE parcel_logs SET customer_name=$1, updated_at=NOW() WHERE id=$2 RETURNING id',
    [String(customerName || '').trim() || 'Name not detected', req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: 'Parcel not found.' })
  res.json({ ok: true })
})

app.delete('/api/parcels/:id', requireAuth, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM parcel_logs WHERE id=$1', [req.params.id])
  if (!rowCount) return res.status(404).json({ error: 'Parcel not found.' })
  res.json({ ok: true })
})

app.use((error, _req, res, _next) => {
  console.error('API error:', error.message)
  res.status(500).json({ error: 'Server error. Please retry.' })
})

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`HisabKitab API listening on ${PORT}`))
}).catch(error => {
  console.error('Database initialization failed:', error)
  process.exit(1)
})
 + values.length + '::date') }
  if (to) { values.push(to); where.push(`created_at < ($\u007bvalues.length\u007d::date + INTERVAL '1 day')`) }
  if (mode && ['dispatch','rto','return'].includes(mode)) { values.push(mode); where.push(`mode = $\u007bvalues.length\u007d`) }
  const sql = 'SELECT id, code, customer_name AS "customerName", mode, created_at AS "createdAt" FROM parcel_logs ' +
    (where.length ? 'WHERE ' + where.join(' AND ') : '') + ' ORDER BY created_at DESC LIMIT 20000'
  const { rows } = await pool.query(sql, values)
  res.json({ parcels: rows })
})

app.post('/api/parcels', requireAuth, async (req, res) => {
  const { id, code, customerName, mode, createdAt } = req.body || {}
  if (!id || !String(code || '').trim() || !['dispatch','rto','return'].includes(mode)) return res.status(400).json({ error: 'Invalid parcel record.' })
  try {
    const { rows } = await pool.query(
      'INSERT INTO parcel_logs (id,code,customer_name,mode,created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id,code,customer_name AS "customerName",mode,created_at AS "createdAt"',
      [String(id), String(code).trim(), String(customerName || 'Name not detected').trim(), mode, createdAt || new Date().toISOString()]
    )
    res.status(201).json({ parcel: rows[0] })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'This parcel record already exists.' })
    throw error
  }
})

app.post('/api/parcels/import', requireAuth, async (req, res) => {
  const parcels = req.body?.parcels
  if (!Array.isArray(parcels) || parcels.length > 10000) return res.status(400).json({ error: 'Invalid import batch.' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let imported = 0
    for (const p of parcels) {
      if (!p?.id || !String(p.code || '').trim() || !['dispatch','rto','return'].includes(p.mode)) continue
      const result = await client.query(
        'INSERT INTO parcel_logs (id,code,customer_name,mode,created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
        [String(p.id), String(p.code).trim(), String(p.customerName || 'Name not detected').trim(), p.mode, p.createdAt || new Date().toISOString()]
      )
      imported += result.rowCount
    }
    await client.query('COMMIT')
    res.json({ imported })
  } catch (error) {
    await client.query('ROLLBACK'); throw error
  } finally { client.release() }
})

app.patch('/api/parcels/:id', requireAuth, async (req, res) => {
  const { customerName } = req.body || {}
  const { rows } = await pool.query(
    'UPDATE parcel_logs SET customer_name=$1, updated_at=NOW() WHERE id=$2 RETURNING id',
    [String(customerName || '').trim() || 'Name not detected', req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: 'Parcel not found.' })
  res.json({ ok: true })
})

app.delete('/api/parcels/:id', requireAuth, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM parcel_logs WHERE id=$1', [req.params.id])
  if (!rowCount) return res.status(404).json({ error: 'Parcel not found.' })
  res.json({ ok: true })
})

app.use((error, _req, res, _next) => {
  console.error('API error:', error.message)
  res.status(500).json({ error: 'Server error. Please retry.' })
})

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`HisabKitab API listening on ${PORT}`))
}).catch(error => {
  console.error('Database initialization failed:', error)
  process.exit(1)
})
 + values.length) }
  const sql = 'SELECT id, code, customer_name AS "customerName", mode, created_at AS "createdAt" FROM parcel_logs ' +
    (where.length ? 'WHERE ' + where.join(' AND ') : '') + ' ORDER BY created_at DESC LIMIT 20000'
  const { rows } = await pool.query(sql, values)
  res.json({ parcels: rows })
})

app.post('/api/parcels', requireAuth, async (req, res) => {
  const { id, code, customerName, mode, createdAt } = req.body || {}
  if (!id || !String(code || '').trim() || !['dispatch','rto','return'].includes(mode)) return res.status(400).json({ error: 'Invalid parcel record.' })
  try {
    const { rows } = await pool.query(
      'INSERT INTO parcel_logs (id,code,customer_name,mode,created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id,code,customer_name AS "customerName",mode,created_at AS "createdAt"',
      [String(id), String(code).trim(), String(customerName || 'Name not detected').trim(), mode, createdAt || new Date().toISOString()]
    )
    res.status(201).json({ parcel: rows[0] })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'This parcel record already exists.' })
    throw error
  }
})

app.post('/api/parcels/import', requireAuth, async (req, res) => {
  const parcels = req.body?.parcels
  if (!Array.isArray(parcels) || parcels.length > 10000) return res.status(400).json({ error: 'Invalid import batch.' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let imported = 0
    for (const p of parcels) {
      if (!p?.id || !String(p.code || '').trim() || !['dispatch','rto','return'].includes(p.mode)) continue
      const result = await client.query(
        'INSERT INTO parcel_logs (id,code,customer_name,mode,created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
        [String(p.id), String(p.code).trim(), String(p.customerName || 'Name not detected').trim(), p.mode, p.createdAt || new Date().toISOString()]
      )
      imported += result.rowCount
    }
    await client.query('COMMIT')
    res.json({ imported })
  } catch (error) {
    await client.query('ROLLBACK'); throw error
  } finally { client.release() }
})

app.patch('/api/parcels/:id', requireAuth, async (req, res) => {
  const { customerName } = req.body || {}
  const { rows } = await pool.query(
    'UPDATE parcel_logs SET customer_name=$1, updated_at=NOW() WHERE id=$2 RETURNING id',
    [String(customerName || '').trim() || 'Name not detected', req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: 'Parcel not found.' })
  res.json({ ok: true })
})

app.delete('/api/parcels/:id', requireAuth, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM parcel_logs WHERE id=$1', [req.params.id])
  if (!rowCount) return res.status(404).json({ error: 'Parcel not found.' })
  res.json({ ok: true })
})

app.use((error, _req, res, _next) => {
  console.error('API error:', error.message)
  res.status(500).json({ error: 'Server error. Please retry.' })
})

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`HisabKitab API listening on ${PORT}`))
}).catch(error => {
  console.error('Database initialization failed:', error)
  process.exit(1)
})
 + values.length + '::date') }
  if (to) { values.push(to); where.push(`created_at < ($\u007bvalues.length\u007d::date + INTERVAL '1 day')`) }
  if (mode && ['dispatch','rto','return'].includes(mode)) { values.push(mode); where.push(`mode = $\u007bvalues.length\u007d`) }
  const sql = 'SELECT id, code, customer_name AS "customerName", mode, created_at AS "createdAt" FROM parcel_logs ' +
    (where.length ? 'WHERE ' + where.join(' AND ') : '') + ' ORDER BY created_at DESC LIMIT 20000'
  const { rows } = await pool.query(sql, values)
  res.json({ parcels: rows })
})

app.post('/api/parcels', requireAuth, async (req, res) => {
  const { id, code, customerName, mode, createdAt } = req.body || {}
  if (!id || !String(code || '').trim() || !['dispatch','rto','return'].includes(mode)) return res.status(400).json({ error: 'Invalid parcel record.' })
  try {
    const { rows } = await pool.query(
      'INSERT INTO parcel_logs (id,code,customer_name,mode,created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id,code,customer_name AS "customerName",mode,created_at AS "createdAt"',
      [String(id), String(code).trim(), String(customerName || 'Name not detected').trim(), mode, createdAt || new Date().toISOString()]
    )
    res.status(201).json({ parcel: rows[0] })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'This parcel record already exists.' })
    throw error
  }
})

app.post('/api/parcels/import', requireAuth, async (req, res) => {
  const parcels = req.body?.parcels
  if (!Array.isArray(parcels) || parcels.length > 10000) return res.status(400).json({ error: 'Invalid import batch.' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let imported = 0
    for (const p of parcels) {
      if (!p?.id || !String(p.code || '').trim() || !['dispatch','rto','return'].includes(p.mode)) continue
      const result = await client.query(
        'INSERT INTO parcel_logs (id,code,customer_name,mode,created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
        [String(p.id), String(p.code).trim(), String(p.customerName || 'Name not detected').trim(), p.mode, p.createdAt || new Date().toISOString()]
      )
      imported += result.rowCount
    }
    await client.query('COMMIT')
    res.json({ imported })
  } catch (error) {
    await client.query('ROLLBACK'); throw error
  } finally { client.release() }
})

app.patch('/api/parcels/:id', requireAuth, async (req, res) => {
  const { customerName } = req.body || {}
  const { rows } = await pool.query(
    'UPDATE parcel_logs SET customer_name=$1, updated_at=NOW() WHERE id=$2 RETURNING id',
    [String(customerName || '').trim() || 'Name not detected', req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: 'Parcel not found.' })
  res.json({ ok: true })
})

app.delete('/api/parcels/:id', requireAuth, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM parcel_logs WHERE id=$1', [req.params.id])
  if (!rowCount) return res.status(404).json({ error: 'Parcel not found.' })
  res.json({ ok: true })
})

app.use((error, _req, res, _next) => {
  console.error('API error:', error.message)
  res.status(500).json({ error: 'Server error. Please retry.' })
})

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`HisabKitab API listening on ${PORT}`))
}).catch(error => {
  console.error('Database initialization failed:', error)
  process.exit(1)
})
 + values.length + '::date + INTERVAL \'1 day\')') }
  if (mode && ['dispatch','rto','return'].includes(mode)) { values.push(mode); where.push(`mode = $\u007bvalues.length\u007d`) }
  const sql = 'SELECT id, code, customer_name AS "customerName", mode, created_at AS "createdAt" FROM parcel_logs ' +
    (where.length ? 'WHERE ' + where.join(' AND ') : '') + ' ORDER BY created_at DESC LIMIT 20000'
  const { rows } = await pool.query(sql, values)
  res.json({ parcels: rows })
})

app.post('/api/parcels', requireAuth, async (req, res) => {
  const { id, code, customerName, mode, createdAt } = req.body || {}
  if (!id || !String(code || '').trim() || !['dispatch','rto','return'].includes(mode)) return res.status(400).json({ error: 'Invalid parcel record.' })
  try {
    const { rows } = await pool.query(
      'INSERT INTO parcel_logs (id,code,customer_name,mode,created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id,code,customer_name AS "customerName",mode,created_at AS "createdAt"',
      [String(id), String(code).trim(), String(customerName || 'Name not detected').trim(), mode, createdAt || new Date().toISOString()]
    )
    res.status(201).json({ parcel: rows[0] })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'This parcel record already exists.' })
    throw error
  }
})

app.post('/api/parcels/import', requireAuth, async (req, res) => {
  const parcels = req.body?.parcels
  if (!Array.isArray(parcels) || parcels.length > 10000) return res.status(400).json({ error: 'Invalid import batch.' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let imported = 0
    for (const p of parcels) {
      if (!p?.id || !String(p.code || '').trim() || !['dispatch','rto','return'].includes(p.mode)) continue
      const result = await client.query(
        'INSERT INTO parcel_logs (id,code,customer_name,mode,created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
        [String(p.id), String(p.code).trim(), String(p.customerName || 'Name not detected').trim(), p.mode, p.createdAt || new Date().toISOString()]
      )
      imported += result.rowCount
    }
    await client.query('COMMIT')
    res.json({ imported })
  } catch (error) {
    await client.query('ROLLBACK'); throw error
  } finally { client.release() }
})

app.patch('/api/parcels/:id', requireAuth, async (req, res) => {
  const { customerName } = req.body || {}
  const { rows } = await pool.query(
    'UPDATE parcel_logs SET customer_name=$1, updated_at=NOW() WHERE id=$2 RETURNING id',
    [String(customerName || '').trim() || 'Name not detected', req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: 'Parcel not found.' })
  res.json({ ok: true })
})

app.delete('/api/parcels/:id', requireAuth, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM parcel_logs WHERE id=$1', [req.params.id])
  if (!rowCount) return res.status(404).json({ error: 'Parcel not found.' })
  res.json({ ok: true })
})

app.use((error, _req, res, _next) => {
  console.error('API error:', error.message)
  res.status(500).json({ error: 'Server error. Please retry.' })
})

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`HisabKitab API listening on ${PORT}`))
}).catch(error => {
  console.error('Database initialization failed:', error)
  process.exit(1)
})
 + values.length + '::date') }
  if (to) { values.push(to); where.push(`created_at < ($\u007bvalues.length\u007d::date + INTERVAL '1 day')`) }
  if (mode && ['dispatch','rto','return'].includes(mode)) { values.push(mode); where.push(`mode = $\u007bvalues.length\u007d`) }
  const sql = 'SELECT id, code, customer_name AS "customerName", mode, created_at AS "createdAt" FROM parcel_logs ' +
    (where.length ? 'WHERE ' + where.join(' AND ') : '') + ' ORDER BY created_at DESC LIMIT 20000'
  const { rows } = await pool.query(sql, values)
  res.json({ parcels: rows })
})

app.post('/api/parcels', requireAuth, async (req, res) => {
  const { id, code, customerName, mode, createdAt } = req.body || {}
  if (!id || !String(code || '').trim() || !['dispatch','rto','return'].includes(mode)) return res.status(400).json({ error: 'Invalid parcel record.' })
  try {
    const { rows } = await pool.query(
      'INSERT INTO parcel_logs (id,code,customer_name,mode,created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id,code,customer_name AS "customerName",mode,created_at AS "createdAt"',
      [String(id), String(code).trim(), String(customerName || 'Name not detected').trim(), mode, createdAt || new Date().toISOString()]
    )
    res.status(201).json({ parcel: rows[0] })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'This parcel record already exists.' })
    throw error
  }
})

app.post('/api/parcels/import', requireAuth, async (req, res) => {
  const parcels = req.body?.parcels
  if (!Array.isArray(parcels) || parcels.length > 10000) return res.status(400).json({ error: 'Invalid import batch.' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let imported = 0
    for (const p of parcels) {
      if (!p?.id || !String(p.code || '').trim() || !['dispatch','rto','return'].includes(p.mode)) continue
      const result = await client.query(
        'INSERT INTO parcel_logs (id,code,customer_name,mode,created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
        [String(p.id), String(p.code).trim(), String(p.customerName || 'Name not detected').trim(), p.mode, p.createdAt || new Date().toISOString()]
      )
      imported += result.rowCount
    }
    await client.query('COMMIT')
    res.json({ imported })
  } catch (error) {
    await client.query('ROLLBACK'); throw error
  } finally { client.release() }
})

app.patch('/api/parcels/:id', requireAuth, async (req, res) => {
  const { customerName } = req.body || {}
  const { rows } = await pool.query(
    'UPDATE parcel_logs SET customer_name=$1, updated_at=NOW() WHERE id=$2 RETURNING id',
    [String(customerName || '').trim() || 'Name not detected', req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: 'Parcel not found.' })
  res.json({ ok: true })
})

app.delete('/api/parcels/:id', requireAuth, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM parcel_logs WHERE id=$1', [req.params.id])
  if (!rowCount) return res.status(404).json({ error: 'Parcel not found.' })
  res.json({ ok: true })
})

app.use((error, _req, res, _next) => {
  console.error('API error:', error.message)
  res.status(500).json({ error: 'Server error. Please retry.' })
})

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`HisabKitab API listening on ${PORT}`))
}).catch(error => {
  console.error('Database initialization failed:', error)
  process.exit(1)
})
