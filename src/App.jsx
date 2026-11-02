import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import Tesseract from 'tesseract.js'
import {
  LayoutDashboard, Package, ShoppingBag, ArrowDownToLine, ArrowUpFromLine,
  ReceiptText, ChartNoAxesCombined, ScanLine, Search, Bell, Plus, ChevronDown,
  Menu, X, IndianRupee, TrendingUp, TrendingDown, Boxes, CircleAlert,
  MoreHorizontal, CalendarDays, Download, Filter, Camera, Keyboard, Check,
  Clock3, Truck, Wallet, ArrowUpRight, ArrowDownRight, Sparkles, Tag, Trash2, Upload
} from 'lucide-react'

const money = n => '₹' + Number(n || 0).toLocaleString('en-IN')
const toInputDate = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const modeLabel = m => m === 'dispatch' ? 'Outgoing' : m === 'rto' ? 'RTO' : 'Customer Return'
const csvCell = v => '"' + String(v ?? '').replaceAll('"', '""') + '"'
const downloadFile = (name, text, type) => {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
const beep = ok => {
  try {
    navigator.vibrate?.(ok ? 60 : [80, 60, 80])
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx(), o = ctx.createOscillator(), g = ctx.createGain()
    o.frequency.value = ok ? 880 : 220; g.gain.value = 0.08
    o.connect(g); g.connect(ctx.destination); o.start()
    setTimeout(() => { o.stop(); ctx.close() }, ok ? 120 : 320)
  } catch (e) { /* sound is optional */ }
}
const nav = [
  { label: 'Overview', items: [{ name: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'Manage', items: [{ name: 'Orders', icon: ShoppingBag }, { name: 'Inventory', icon: Package }, { name: 'Incoming', icon: ArrowDownToLine }, { name: 'Outgoing', icon: ArrowUpFromLine }, { name: 'Barcode scanner', icon: ScanLine }] },
  { label: 'Business', items: [{ name: 'Expenses', icon: ReceiptText }, { name: 'Reports', icon: ChartNoAxesCombined }] }
]

function App() {
  const [page, setPage] = useState('Dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState(() => { if (localStorage.getItem('hk-data-version') !== '2') { localStorage.removeItem('hk-products'); localStorage.removeItem('hk-orders'); localStorage.removeItem('hk-expenses'); localStorage.setItem('hk-data-version', '2') } return JSON.parse(localStorage.getItem('hk-products') || '[]') })
  const [orders, setOrders] = useState(() => JSON.parse(localStorage.getItem('hk-orders') || '[]'))
  const [expenses, setExpenses] = useState(() => JSON.parse(localStorage.getItem('hk-expenses') || '[]'))
  const [modal, setModal] = useState('')
  const [toast, setToast] = useState('')
  const [scanValue, setScanValue] = useState('')
  const [parcelMode, setParcelMode] = useState('dispatch')
  const [parcelLogs, setParcelLogs] = useState(() => JSON.parse(localStorage.getItem('hk-parcel-logs') || '[]'))
  const parcelLogsRef = useRef(parcelLogs)
  parcelLogsRef.current = parcelLogs
  const [lastBackup, setLastBackup] = useState(() => localStorage.getItem('hk-last-backup') || '')
  useEffect(() => { navigator.storage?.persist?.() }, [])
  useEffect(() => localStorage.setItem('hk-products', JSON.stringify(products)), [products])
  useEffect(() => localStorage.setItem('hk-orders', JSON.stringify(orders)), [orders])
  useEffect(() => localStorage.setItem('hk-expenses', JSON.stringify(expenses)), [expenses])
  useEffect(() => localStorage.setItem('hk-parcel-logs', JSON.stringify(parcelLogs)), [parcelLogs])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t) }, [toast])
  const notify = msg => setToast(msg)
  const changePage = p => { setPage(p); setMobileOpen(false); setQuery('') }
  const filteredProducts = useMemo(() => products.filter(p => (p.name + p.sku + p.category + p.barcode).toLowerCase().includes(query.toLowerCase())), [products, query])
  const filteredOrders = useMemo(() => orders.filter(o => (o.id + o.customer + o.status + o.channel).toLowerCase().includes(query.toLowerCase())), [orders, query])
  const addProduct = data => {
    setProducts(prev => [{ ...data, id: Date.now(), stock: Number(data.stock), price: Number(data.price), cost: Number(data.cost) }, ...prev])
    setModal(''); notify('Product added to inventory')
  }
  const addExpense = data => {
    setExpenses(prev => [{ ...data, id: Date.now(), amount: Number(data.amount), date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }, ...prev])
    setModal(''); notify('Expense saved')
  }
  const addOrder = data => {
    setOrders(prev => [{ ...data, id: 'HK-' + (1050 + prev.length), qty: Number(data.qty || 1), productId: data.productId ? Number(data.productId) : null, awb: data.awb?.trim() || '', date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), items: 1, status: 'Processing' }, ...prev])
    setModal(''); notify('Order created')
  }
  const processParcelScan = (code, mode, customerName) => {
    const clean = String(code || '').trim()
    if (!clean) { notify('Scan the parcel barcode first'); return null }
    const logs = parcelLogsRef.current
    const isReturn = mode !== 'dispatch'
    const dup = logs.find(x => x.code === clean && (isReturn ? x.mode !== 'dispatch' : x.mode === 'dispatch'))
    if (dup) { notify('Duplicate: ' + clean + ' already scanned as ' + modeLabel(dup.mode)); return { duplicate: true } }
    const entry = { id: Date.now() + Math.random(), code: clean, customerName: String(customerName || '').trim() || 'Name not detected', mode, createdAt: new Date().toISOString() }
    parcelLogsRef.current = [entry, ...logs]
    setParcelLogs(prev => [entry, ...prev])
    const unmatched = isReturn && !logs.some(x => x.code === clean && x.mode === 'dispatch')
    notify(modeLabel(mode) + ' recorded' + (unmatched ? ' (no matching outgoing record found)' : ''))
    return { id: entry.id }
  }
  const updateParcelName = (id, name) => setParcelLogs(prev => prev.map(x => x.id === id ? { ...x, customerName: name } : x))
  const deleteParcel = id => { setParcelLogs(prev => prev.filter(x => x.id !== id)); notify('Scan deleted') }
  const exportParcelsCsv = () => {
    if (!parcelLogs.length) { notify('No parcel scans to export yet'); return }
    const rows = [['Date', 'Time', 'Type', 'AWB / Barcode', 'Customer name'], ...[...parcelLogs].reverse().map(x => { const d = new Date(x.createdAt); return [d.toLocaleDateString('en-IN'), d.toLocaleTimeString('en-IN'), modeLabel(x.mode), x.code, x.customerName] })]
    downloadFile('parcels-' + toInputDate(new Date()) + '.csv', '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8')
    notify('CSV downloaded')
  }
  const backupAll = () => {
    const stamp = new Date().toISOString()
    downloadFile('hisabkitab-backup-' + toInputDate(new Date()) + '.json', JSON.stringify({ app: 'hisabkitab', version: 1, exportedAt: stamp, products, orders, expenses, parcelLogs }, null, 2), 'application/json')
    localStorage.setItem('hk-last-backup', stamp); setLastBackup(stamp); notify('Backup downloaded')
  }
  const restoreAll = async file => {
    try {
      const data = JSON.parse(await file.text())
      if (data.app !== 'hisabkitab' || !Array.isArray(data.parcelLogs)) throw new Error('not a backup')
      if (!window.confirm('Restore this backup? Current data on this device will be replaced.')) return
      setProducts(data.products || []); setOrders(data.orders || []); setExpenses(data.expenses || []); setParcelLogs(data.parcelLogs)
      notify('Backup restored')
    } catch (e) { notify('This file is not a valid HisabKitab backup') }
  }
  const recordMovement = (kind, productId, qty) => {
    setProducts(prev => prev.map(p => p.id === Number(productId) ? { ...p, stock: Math.max(0, p.stock + (kind === 'Incoming' ? qty : -qty)) } : p))
    setModal(''); notify(kind + ' stock recorded')
  }
  return <div className="app-shell">
    <aside className={'sidebar ' + (mobileOpen ? 'sidebar-open' : '')}>
      <div className="brand"><div className="brand-mark"><Boxes size={21}/></div><div><strong>HisabKitab</strong><span>SELLER WORKSPACE</span></div><button className="icon-btn mobile-close" onClick={() => setMobileOpen(false)}><X size={18}/></button></div>
      <div className="store-switch"><div className="store-avatar">A</div><div><b>My Business</b><small>Seller account</small></div><ChevronDown size={15}/></div>
      <nav>{nav.map(group => <div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map(item => <button key={item.name} onClick={() => item.name === 'Barcode scanner' ? (setModal('scanner'), setMobileOpen(false)) : changePage(item.name)} className={'nav-item ' + (page === item.name ? 'active' : '')}><item.icon size={18}/><span>{item.name}</span>{item.name === 'Orders' && <em>{orders.length}</em>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><Sparkles size={17}/><b>Keep business in control</b><span>Track stock, orders and every rupee in one place.</span></div><div className="profile"><div className="profile-avatar">AM</div><div><b>Ashish Maurya</b><small>Administrator</small></div><MoreHorizontal size={18}/></div></div>
    </aside>
    {mobileOpen && <div className="scrim" onClick={() => setMobileOpen(false)} />}
    <main className="main-area">
      <header className="topbar"><div className="top-left"><button className="icon-btn mobile-menu" onClick={() => setMobileOpen(true)}><Menu/></button><div className="crumb">Workspace <span>/</span> <b>{page}</b></div></div><div className="top-actions"><label className="global-search"><Search size={17}/><input placeholder="Search anything..." value={query} onChange={e => setQuery(e.target.value)}/><kbd>⌘ K</kbd></label><button className="icon-btn notification"><Bell size={19}/><i/></button><div className="top-avatar">AM</div></div></header>
      <div className="page-wrap">
        {page === 'Dashboard' && <Dashboard parcelLogs={parcelLogs} onNavigate={changePage}/>}
        {page === 'Inventory' && <Inventory products={filteredProducts} onAdd={() => setModal('product')} onScan={() => setModal('scanner')} onEdit={p => { setScanValue(p.barcode); setModal('movement') }}/>}
        {page === 'Orders' && <Orders orders={filteredOrders} onAdd={() => setModal('order')}/>}
        {page === 'Incoming' && <ParcelOperations page={page} onScan={mode => { setParcelMode(mode); setScanValue(''); setModal('parcel-scanner') }} parcelLogs={parcelLogs} onDelete={deleteParcel} onExport={exportParcelsCsv} />}
        {page === 'Outgoing' && <ParcelOperations page={page} onScan={mode => { setParcelMode(mode); setScanValue(''); setModal('parcel-scanner') }} parcelLogs={parcelLogs} onDelete={deleteParcel} onExport={exportParcelsCsv} />}
        {page === 'Expenses' && <Expenses expenses={expenses} onAdd={() => setModal('expense')}/>}
        {page === 'Reports' && <Reports products={products} orders={orders} expenses={expenses} parcelLogs={parcelLogs} lastBackup={lastBackup} onBackup={backupAll} onRestore={restoreAll} onExportParcels={exportParcelsCsv}/>}
      </div>
    </main>
    {modal && <Modal type={modal} products={products} scanValue={scanValue} setScanValue={setScanValue} onClose={() => setModal('')} onProduct={addProduct} onExpense={addExpense} onOrder={addOrder} onMovement={recordMovement} onParcelScan={processParcelScan} onParcelName={updateParcelName} parcelMode={parcelMode} notify={notify}/>}
    {toast && <div className="toast"><Check size={17}/>{toast}</div>}
  </div>
}

function PageHeading({ eyebrow, title, desc, action, secondary }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{desc}</p></div><div className="heading-actions">{secondary}{action}</div></div>
}
function Button({ children, variant = 'primary', onClick, icon: Icon, type = 'button' }) { return <button type={type} className={'btn btn-' + variant} onClick={onClick}>{Icon && <Icon size={16}/ >}{children}</button> }
function Dashboard({ parcelLogs = [], onNavigate }) {
  const [period, setPeriod] = useState('day')
  const [from, setFrom] = useState(toInputDate(new Date()))
  const [to, setTo] = useState(toInputDate(new Date()))
  const now = new Date()
  const range = useMemo(() => {
    const end = new Date(now); end.setHours(23,59,59,999)
    const begin = new Date(now); begin.setHours(0,0,0,0)
    if (period === 'week') begin.setDate(begin.getDate() - 6)
    if (period === 'month') begin.setDate(1)
    if (period === 'custom') { begin.setTime(new Date(from + 'T00:00:00').getTime()); end.setTime(new Date(to + 'T23:59:59').getTime()) }
    return { begin, end }
  }, [period, from, to])
  const logs = parcelLogs.filter(x => { const d = new Date(x.createdAt); return d >= range.begin && d <= range.end })
  const outgoing = logs.filter(x => x.mode === 'dispatch').length
  const incoming = logs.filter(x => x.mode === 'rto' || x.mode === 'return').length
  const periodLabel = period === 'day' ? 'Today' : period === 'week' ? 'This week' : period === 'month' ? 'This month' : 'Custom dates'
  return <>
    <PageHeading eyebrow="PARCEL MOVEMENT" title="Parcel overview" desc="Track outgoing dispatches and incoming returns. No sales figures — just parcel activity."/>
    <div className="section-head"><div><h2>Parcel summary</h2><span>{periodLabel} · {range.begin.toLocaleDateString('en-IN')} – {range.end.toLocaleDateString('en-IN')}</span></div>
      <div className="toolbar-actions"><select className="select-chip" value={period} onChange={e=>setPeriod(e.target.value)}><option value="day">Today</option><option value="week">This week</option><option value="month">This month</option><option value="custom">Custom dates</option></select>
      {period==='custom'&&<><label className="date-pick">From <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="date-pick">To <input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></label></>}
    </div></div>
    <div className="stats-grid">
      <div className="stat-card parcel-dashboard-card"><div className="stat-top"><span>Outgoing parcels</span><div className="stat-icon blue"><ArrowUpFromLine size={18}/></div></div><strong>{outgoing}</strong><div className="stat-foot"><span>Parcels dispatched</span><button className="text-link" onClick={()=>onNavigate('Outgoing')}>View records <ArrowUpRight size={14}/></button></div></div>
      <div className="stat-card parcel-dashboard-card"><div className="stat-top"><span>Incoming parcels</span><div className="stat-icon green"><ArrowDownToLine size={18}/></div></div><strong>{incoming}</strong><div className="stat-foot"><span>RTO + customer returns</span><button className="text-link" onClick={()=>onNavigate('Incoming')}>View records <ArrowUpRight size={14}/></button></div></div>
    </div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-head"><div><h3>Outgoing activity</h3><p>Dispatches in selected period</p></div><button className="text-link" onClick={()=>onNavigate('Outgoing')}>Open outgoing <ArrowUpRight size={14}/></button></div><div className="parcel-summary-number">{outgoing}</div></section>
      <section className="panel"><div className="panel-head"><div><h3>Incoming activity</h3><p>RTO and customer returns in selected period</p></div><button className="text-link" onClick={()=>onNavigate('Incoming')}>Open incoming <ArrowUpRight size={14}/></button></div><div className="parcel-summary-number">{incoming}</div></section>
    </div>
  </>
}
function Stat({ label, value, change, trend, icon: Icon, tone, note }) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className={'stat-icon '+tone}><Icon size={18}/></div></div><strong>{value}</strong><div className="stat-foot"><span className={'trend '+trend}>{trend==='up'?<TrendingUp size={13}/>:trend==='down'?<CircleAlert size={13}/>:null}{change}</span><span>{note}</span></div></div> }
function Inventory({ products, onAdd, onScan, onEdit }) { return <>
  <PageHeading eyebrow="PRODUCT MANAGEMENT" title="Inventory" desc="Manage your products, stock levels and pricing." action={<><Button variant="outline" icon={ScanLine} onClick={onScan}>Scan barcode</Button><Button icon={Plus} onClick={onAdd}>Add product</Button></>}/>
  <div className="stats-grid compact-stats"><Stat label="Total products" value={products.length} change="Across categories" trend="neutral" icon={Package} tone="blue" note="active SKUs"/><Stat label="Units in stock" value={products.reduce((s,p)=>s+p.stock,0)} change="Available" trend="up" icon={Boxes} tone="violet" note="total quantity"/><Stat label="Low stock items" value={products.filter(p=>p.stock>0&&p.stock<=8).length} change="Needs attention" trend="down" icon={CircleAlert} tone="orange" note="8 units or less"/><Stat label="Out of stock" value={products.filter(p=>p.stock===0).length} change="Restock needed" trend="down" icon={Package} tone="green" note="unavailable items"/></div>
  <section className="panel table-panel"><div className="table-toolbar"><div><h3>All products <span className="count-pill">{products.length}</span></h3><p>Your product catalogue and stock status</p></div><div className="toolbar-actions"><button className="select-chip"><Filter size={14}/> Filter <ChevronDown size={14}/></button><button className="select-chip"><Download size={14}/> Export</button></div></div><ProductTable products={products} onEdit={onEdit}/></section>
</> }
function ParcelOperations({ onScan, parcelLogs, page, onDelete, onExport }) {
  const isOutgoing = page === 'Outgoing'
  const [period, setPeriod] = useState('day')
  const [from, setFrom] = useState(toInputDate(new Date()))
  const [to, setTo] = useState(toInputDate(new Date()))
  const modes = isOutgoing
    ? [{ id: 'dispatch', title: 'Outgoing parcels', desc: 'Scan each parcel label when handing shipments to the courier.', icon: ArrowUpFromLine }]
    : [{ id: 'rto', title: 'RTO received', desc: 'Scan parcels returned by the courier as Return to Origin.', icon: ArrowDownToLine }, { id: 'return', title: 'Customer returns', desc: 'Scan parcels sent back by customers.', icon: Package }]
  const now = new Date()
  const start = new Date(now); start.setHours(0,0,0,0)
  const end = new Date(now); end.setHours(23,59,59,999)
  if (period === 'week') start.setDate(start.getDate()-6)
  if (period === 'month') start.setDate(1)
  if (period === 'custom') { start.setTime(new Date(from+'T00:00:00').getTime()); end.setTime(new Date(to+'T23:59:59').getTime()) }
  const selectedLogs = parcelLogs.filter(x => { const d=new Date(x.createdAt); return d>=start && d<=end && modes.some(m=>m.id===x.mode) })
  const today = toInputDate(new Date())
  const periodLabel = period==='day'?'Today':period==='week'?'This week':period==='month'?'This month':'Custom dates'
  return <>
    <PageHeading eyebrow={isOutgoing ? 'PARCEL DISPATCH' : 'PARCEL RECEIPTS'} title={isOutgoing ? 'Outgoing parcels' : 'Incoming parcels'} desc={isOutgoing ? 'Scan parcels handed to the courier and review dispatch history.' : 'Record RTO and customer-return parcels as incoming.'} action={<Button variant="outline" icon={Download} onClick={onExport}>Export CSV</Button>}/>
    <div className="section-head"><div><h2>{periodLabel} summary</h2><span>{selectedLogs.length} parcel records</span></div><div className="toolbar-actions"><select className="select-chip" value={period} onChange={e=>setPeriod(e.target.value)}><option value="day">Today</option><option value="week">This week</option><option value="month">This month</option><option value="custom">Custom dates</option></select>{period==='custom'&&<><label className="date-pick">From <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="date-pick">To <input type="date" min={from} value={to} onChange={e=>setTo(e.target.value)}/></label></>}</div></div>
    <div className={'parcel-mode-grid '+(isOutgoing?'single-parcel-mode':'')}>
      {modes.map(m=>{const count=selectedLogs.filter(x=>x.mode===m.id).length;return <section className="panel parcel-mode-card" key={m.id}><div className="parcel-card-top"><div className="movement-icon"><m.icon size={21}/></div><span className="parcel-today">{periodLabel.toUpperCase()}</span></div><h3>{m.title}</h3><p>{m.desc}</p><div className="parcel-card-bottom"><div className="parcel-count">{count}<small> parcels in {periodLabel.toLowerCase()}</small></div><Button icon={ScanLine} onClick={()=>onScan(m.id)}>Open scanner</Button></div></section>})}
    </div>
    <section className="panel table-panel parcel-history"><div className="table-toolbar"><div><h3>{periodLabel} scan history</h3><p>{selectedLogs.length} parcel{selectedLogs.length===1?'':'s'} recorded</p></div><span className="parcel-total">{selectedLogs.length} TOTAL</span></div>
      <div className="table-scroll"><table><thead><tr><th>DATE & TIME</th><th>PARCEL TYPE</th><th>BARCODE / AWB</th><th>CUSTOMER NAME</th><th/></tr></thead><tbody>{[...selectedLogs].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(x=><tr key={x.id}><td>{new Date(x.createdAt).toLocaleString('en-IN')}</td><td><span className="channel-tag">{modeLabel(x.mode)}</span></td><td className="id-cell">{x.code}</td><td className="customer-cell">{x.customerName}</td><td><button className="row-action" title="Delete this scan" onClick={()=>{if(window.confirm('Delete this scan?'))onDelete(x.id)}}><Trash2 size={15}/></button></td></tr>)}</tbody></table>{!selectedLogs.length&&<Empty text="No parcels recorded in this date range yet."/>}</div>
    </section>
  </>
}
function BackupPanel({ lastBackup, parcelCount, onBackup, onRestore, onExportParcels }) {
  const fileRef = useRef(null)
  const stale = parcelCount > 0 && (!lastBackup || Date.now() - new Date(lastBackup).getTime() > 7 * 86400000)
  return <section className="panel backup-panel">
    <div><h3>Backup and record safety</h3><p>Your records are stored on this device's browser only. Download a backup regularly so nothing is lost if the phone or browser data is cleared, and to move data to another phone.</p></div>
    <div className="backup-meta"><span>Parcel scans saved: <b>{parcelCount}</b></span><span>Last backup: <b>{lastBackup ? new Date(lastBackup).toLocaleString('en-IN') : 'Never'}</b></span></div>
    {stale && <div className="backup-warn">{lastBackup ? 'Last backup is more than 7 days old. ' : 'No backup taken yet. '}Download one now.</div>}
    <div className="backup-actions"><Button icon={Download} onClick={onBackup}>Download full backup</Button><Button variant="outline" icon={Upload} onClick={() => fileRef.current?.click()}>Restore from backup</Button><Button variant="outline" icon={Download} onClick={onExportParcels}>Export parcels (CSV)</Button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onRestore(f); e.target.value = '' }}/></div>
  </section>
}
function Orders({ orders, onAdd }) { return <><PageHeading eyebrow="SALES MANAGEMENT" title="Orders" desc="Track orders from every selling channel." action={<Button icon={Plus} onClick={onAdd}>Create order</Button>}/><div className="stats-grid compact-stats"><Stat label="All orders" value={orders.length} change="All channels" trend="neutral" icon={ShoppingBag} tone="blue" note="in this workspace"/><Stat label="Processing" value={orders.filter(o=>o.status==='Processing').length} change="Action needed" trend="neutral" icon={Clock3} tone="orange" note="to be packed"/><Stat label="Shipped" value={orders.filter(o=>o.status==='Shipped').length} change="In transit" trend="neutral" icon={Truck} tone="violet" note="on the way"/><Stat label="Delivered" value={orders.filter(o=>o.status==='Delivered').length} change="Completed" trend="up" icon={Check} tone="green" note="successfully delivered"/></div><section className="panel table-panel"><div className="table-toolbar"><div><h3>All orders <span className="count-pill">{orders.length}</span></h3><p>Review and manage your recent orders</p></div><button className="select-chip"><Filter size={14}/> Filter</button></div><OrderTable orders={orders}/></section></> }
function OrderTable({ orders }) { return <div className="table-scroll"><table><thead><tr><th>ORDER ID</th><th>CUSTOMER</th><th>DATE</th><th>CHANNEL</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td className="id-cell">{o.id}</td><td><b className="customer-cell">{o.customer}</b></td><td>{o.date}</td><td><span className="channel-tag">{o.channel}</span></td><td className="amount-cell">{money(o.amount)}</td><td><Status status={o.status}/></td></tr>)}</tbody></table>{!orders.length&&<Empty text="No orders match your search."/>}</div> }
function ProductTable({ products, onEdit }) { return <div className="table-scroll"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>PRICE</th><th>STOCK</th><th>STOCK STATUS</th><th/></tr></thead><tbody>{products.map(p=><tr key={p.id}><td><div className="product-cell"><div className="product-thumb"><Package size={17}/></div><b>{p.name}</b></div></td><td className="id-cell">{p.sku}</td><td>{p.category}</td><td className="amount-cell">{money(p.price)}</td><td><b>{p.stock}</b></td><td><StockStatus stock={p.stock}/></td><td><button className="row-action" onClick={()=>onEdit(p)} title="Adjust stock"><MoreHorizontal size={18}/></button></td></tr>)}</tbody></table>{!products.length&&<Empty text="No products found. Try another search."/>}</div> }
function Status({ status }) { return <span className={'status status-'+status.toLowerCase().replaceAll(' ','-')}><i/>{status}</span> }
function StockStatus({ stock }) { return <span className={'status '+(stock===0?'status-cancelled':stock<=8?'status-processing':'status-delivered')}><i/>{stock===0?'Out of stock':stock<=8?'Low stock':'In stock'}</span> }
function Empty({ text }) { return <div className="empty-state"><Package size={24}/>{text}</div> }
function Movement({ products, kind, onAdd }) { return <><PageHeading eyebrow="STOCK MOVEMENT" title={kind+' stock'} desc={kind==='Incoming'?'Record purchases, returns and restocked products.':'Record sales, damaged items and stock dispatched.'} action={<Button icon={Plus} onClick={onAdd}>Record {kind.toLowerCase()}</Button>}/><div className="movement-banner"><div className="movement-icon"><KindIcon kind={kind}/></div><div><b>{kind==='Incoming'?'Stock coming into your business':'Stock leaving your business'}</b><span>{kind==='Incoming'?'Keep purchase and restock quantities up to date.':'Keep sales, dispatches and damaged stock accounted for.'}</span></div></div><section className="panel table-panel"><div className="table-toolbar"><div><h3>Current stock</h3><p>Select a product to review its available quantity</p></div></div><ProductTable products={products} onEdit={p=>onAdd(p)}/></section></> }
function KindIcon({kind}) { return kind==='Incoming'?<ArrowDownToLine size={20}/>:<ArrowUpFromLine size={20}/> }
function Expenses({ expenses, onAdd }) { return <><PageHeading eyebrow="COST MANAGEMENT" title="Expenses" desc="Record business spending and keep costs under control." action={<Button icon={Plus} onClick={onAdd}>Add expense</Button>}/><div className="stats-grid compact-stats"><Stat label="Total expenses" value={money(expenses.reduce((s,e)=>s+e.amount,0))} change="Recorded" trend="neutral" icon={IndianRupee} tone="blue" note="all recorded expenses"/><Stat label="Transactions" value={expenses.length} change="Entries" trend="neutral" icon={ReceiptText} tone="violet" note="expense records"/><Stat label="Largest expense" value={money(Math.max(0,...expenses.map(e=>e.amount)))} change="Single entry" trend="neutral" icon={Wallet} tone="orange" note="highest amount"/><Stat label="Categories" value={new Set(expenses.map(e=>e.category)).size} change="Expense types" trend="neutral" icon={Tag} tone="green" note="being tracked"/></div><section className="panel table-panel"><div className="table-toolbar"><div><h3>Expense history</h3><p>All recorded business expenses</p></div><button className="select-chip"><Download size={14}/> Export</button></div><div className="table-scroll"><table><thead><tr><th>DESCRIPTION</th><th>CATEGORY</th><th>DATE</th><th>AMOUNT</th></tr></thead><tbody>{expenses.map(e=><tr key={e.id}><td><b className="customer-cell">{e.title}</b></td><td><span className="channel-tag">{e.category}</span></td><td>{e.date}</td><td className="amount-cell">{money(e.amount)}</td></tr>)}</tbody></table></div></section></> }
function Reports({ products, orders, expenses, parcelLogs = [], lastBackup, onBackup, onRestore, onExportParcels }) {
  const [period, setPeriod] = useState('day')
  const now = new Date()
  const start = new Date(now)
  if (period === 'day') start.setHours(0,0,0,0)
  if (period === 'week') { start.setDate(now.getDate()-6); start.setHours(0,0,0,0) }
  if (period === 'month') { start.setDate(now.getDate()-29); start.setHours(0,0,0,0) }
  const logs = parcelLogs.filter(x => new Date(x.createdAt) >= start && new Date(x.createdAt) <= now)
  const outgoing = logs.filter(x => x.mode === 'dispatch').length
  const rto = logs.filter(x => x.mode === 'rto').length
  const customerReturns = logs.filter(x => x.mode === 'return').length
  const returns = rto + customerReturns
  const returnRate = outgoing ? Math.round(returns / outgoing * 100) : 0
  const days = period === 'day' ? 1 : period === 'week' ? 7 : 30
  const buckets = Array.from({length:days},(_,idx) => {
    const d = new Date(start); d.setDate(start.getDate()+idx)
    const key = d.toDateString()
    return { label: period === 'day' ? 'Today' : d.toLocaleDateString('en-IN',{day:'numeric',month:period==='month'?'short':undefined,weekday:period==='week'?'short':undefined}), count: logs.filter(x=>new Date(x.createdAt).toDateString()===key).length }
  })
  const maxBucket = Math.max(1,...buckets.map(x=>x.count))
  const sales=orders.reduce((sum,o)=>sum+o.amount,0), costs=expenses.reduce((sum,e)=>sum+e.amount,0)
  return <>
    <PageHeading eyebrow="BUSINESS INTELLIGENCE" title="Reports & analysis" desc="Daily, weekly and monthly parcel activity with business performance." action={<Button variant="outline" icon={Download} onClick={()=>window.print()}>Print report</Button>}/>
    <section className="panel parcel-analytics">
      <div className="analytics-heading"><div><h3>Parcel performance</h3><p>Dispatch and return activity for the selected period</p></div><div className="period-switch">{[['day','Daily'],['week','Weekly'],['month','Monthly']].map(([id,label])=><button key={id} className={period===id?'selected':''} onClick={()=>setPeriod(id)}>{label}</button>)}</div></div>
      <div className="analytics-range">{period==='day'?'Today':period==='week'?'Last 7 days':'Last 30 days'} · {start.toLocaleDateString('en-IN')} – {now.toLocaleDateString('en-IN')}</div>
      <div className="analytics-stats">
        <div><span>Total parcels</span><strong>{logs.length}</strong><small>All scanned parcels</small></div>
        <div><span>Outgoing</span><strong>{outgoing}</strong><small>Sent to customers</small></div>
        <div><span>RTO received</span><strong>{rto}</strong><small>Returned by courier</small></div>
        <div><span>Customer returns</span><strong>{customerReturns}</strong><small>Returned by customers</small></div>
        <div><span>Return ratio</span><strong>{returnRate}%</strong><small>Returns ÷ outgoing</small></div>
      </div>
      <div className="analytics-chart-head"><div><h4>Parcel activity trend</h4><span>{period==='day'?'Scans today':period==='week'?'Daily scans · 7 days':'Daily scans · 30 days'}</span></div><b>{logs.length} scans</b></div>
      <div className={'analytics-bars '+(period==='month'?'month-bars':'')}>{buckets.map((b,idx)=><div className="analytics-bar-col" key={idx} title={b.label+': '+b.count+' parcels'}><div className="analytics-bar-track"><i style={{height:(b.count/maxBucket*100)+'%'}}/></div><small>{period==='month'?(idx%5===0?b.label:''):b.label}</small></div>)}</div>
      <div className="analytics-legend"><i/> Scanned parcels</div>
      <div className="analytics-breakdown"><div><span className="break-dot outgoing-dot"/>Outgoing <b>{outgoing}</b></div><div><span className="break-dot rto-dot"/>RTO <b>{rto}</b></div><div><span className="break-dot return-dot"/>Customer returns <b>{customerReturns}</b></div></div>
      {!logs.length&&<div className="analytics-empty">No parcel scans recorded in this period yet. Scan parcels in Outgoing or Incoming to build your reports.</div>}
    </section>
    <BackupPanel lastBackup={lastBackup} parcelCount={parcelLogs.length} onBackup={onBackup} onRestore={onRestore} onExportParcels={onExportParcels}/>
    <div className="stats-grid compact-stats"><Stat label="Order value" value={money(sales)} change="All orders" trend="up" icon={IndianRupee} tone="blue" note="gross order value"/><Stat label="Expenses" value={money(costs)} change="Recorded" trend="neutral" icon={ReceiptText} tone="orange" note="business costs"/><Stat label="Net order value*" value={money(sales-costs)} change="Estimate" trend={sales>=costs?'up':'down'} icon={TrendingUp} tone="green" note="sales less expenses"/><Stat label="Stock at cost" value={money(products.reduce((sum,p)=>sum+p.stock*p.cost,0))} change="Current" trend="neutral" icon={Boxes} tone="violet" note="inventory valuation"/></div>
    <div className="report-note">*Indicative calculation only. Taxes, marketplace fees, refunds and cost of goods sold are not included. Return ratio is a simple operational indicator, not a final return rate for a matched order cohort.</div>
    <section className="panel report-panel"><h3>Inventory health</h3><p>Current product availability</p>{[['Healthy stock',products.filter(p=>p.stock>8).length,'#2caa78'],['Low stock',products.filter(p=>p.stock>0&&p.stock<=8).length,'#e5a13b'],['Out of stock',products.filter(p=>p.stock===0).length,'#e16b6b']].map(([label,n,color])=><div className="report-row" key={label}><span>{label}</span><div className="report-track"><i style={{width:(products.length?n/products.length*100:0)+'%',background:color}}/></div><b>{n}</b></div>)}</section>
  </>
}
function Modal({ type, products, scanValue, setScanValue, onClose, onProduct, onExpense, onOrder, onMovement, onParcelScan, onParcelName, parcelMode, notify }) {
  const [form,setForm]=useState({name:'',sku:'',category:'General',stock:'10',price:'199',cost:'50',barcode:scanValue,customer:'',amount:'',channel:'Direct',title:'',expenseCategory:'Packaging',productId:products[0]?.id||'',qty:'1',awb:''})
  const [scanning,setScanning]=useState(false), [session,setSession]=useState([]), [readName,setReadName]=useState(true), videoRef=useRef(null), controlsRef=useRef(null), lockRef=useRef(false), lastRef=useRef({code:'',t:0}), ocrChain=useRef(Promise.resolve()), parcelRef=useRef({})
  parcelRef.current={onParcelScan,onParcelName,parcelMode,readName}
  const captureFrame=()=>{const v=videoRef.current; if(!v||!v.videoWidth) return null; const c=document.createElement('canvas'); c.width=v.videoWidth; c.height=v.videoHeight; c.getContext('2d')?.drawImage(v,0,0,c.width,c.height); return c.toDataURL('image/png')}
  const saveParcel=(code,frame)=>{
    const {onParcelScan:save,onParcelName:rename,parcelMode:mode,readName:wantName}=parcelRef.current
    const res=save(code,mode,'')
    if(!res) return
    beep(!res.duplicate)
    if(res.duplicate){setSession(s=>[{key:Math.random(),code,state:'duplicate'},...s]);return}
    setSession(s=>[{key:res.id,code,state:'saved',name:''},...s])
    if(wantName&&frame){ocrChain.current=ocrChain.current.then(()=>Tesseract.recognize(frame,'eng')).then(({data})=>{const lines=(data.text||'').split('\n').map(x=>x.trim()).filter(Boolean);const candidate=lines.find(x=>/^[A-Z][A-Z .'-]{4,}$/.test(x)&&!/(SHIP|DELIVER|RETURN|ADDRESS|MOBILE|PHONE|PINCODE|AWB|ORDER)/i.test(x));if(candidate){rename(res.id,candidate);setSession(s=>s.map(x=>x.key===res.id?{...x,name:candidate}:x))}}).catch(()=>{})}
  }
  const saveManual=()=>{const c=String(scanValue||'').trim(); if(!c){notify('Enter or scan a barcode first');return} saveParcel(c,null); setScanValue('')}
  useEffect(()=>{ if(type!=='scanner' && type!=='parcel-scanner') return; let active=true; const start=async()=>{try{const reader=new BrowserMultiFormatReader();const controls=await reader.decodeFromVideoDevice(undefined,videoRef.current,(result)=>{if(!result||!active||lockRef.current) return;const code=result.getText();if(type==='parcel-scanner'){const now=Date.now();if(lastRef.current.code===code&&now-lastRef.current.t<6000){lastRef.current.t=now;return};lastRef.current={code,t:now};lockRef.current=true;saveParcel(code,parcelRef.current.readName?captureFrame():null);setTimeout(()=>{lockRef.current=false},1200)}else{lockRef.current=true;setScanValue(code);setForm(f=>({...f,barcode:code}));notify('Barcode detected: '+code)}});if(!active){controls.stop();return};controlsRef.current=controls;setScanning(true)}catch(e){notify('Camera unavailable. Enter barcode manually.')}}; start(); return()=>{active=false;controlsRef.current?.stop() }},[type])
  const update=(k,v)=>setForm(f=>({...f,[k]:v}))
  const title=type==='parcel-scanner'?(parcelMode==='dispatch'?'Scan outgoing parcel':parcelMode==='rto'?'Scan RTO parcel':'Scan customer return'):type==='product'?'Add new product':type==='expense'?'Add business expense':type==='order'?'Create new order':type==='scanner'?'Scan product barcode':type==='movement-in'?'Record incoming stock':type==='movement-out'?'Record outgoing stock':'Adjust stock'
  const submit=e=>{e.preventDefault(); if(type==='product')onProduct(form); if(type==='expense')onExpense({title:form.title,category:form.expenseCategory,amount:form.amount}); if(type==='order')onOrder({customer:form.customer,amount:Number(form.amount),channel:form.channel,awb:form.awb,productId:form.productId,qty:form.qty}); if(type.startsWith('movement'))onMovement(type==='movement-out'?'Outgoing':'Incoming',form.productId,Number(form.qty))}
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-head"><div><span className="eyebrow">HISABKITAB WORKSPACE</span><h2>{title}</h2></div><button className="icon-btn" onClick={onClose}><X size={19}/></button></div>
    {(type==='scanner'||type==='parcel-scanner')?<div className="scanner-body"><div className="camera-box"><video ref={videoRef} muted playsInline/><div className="scan-frame"><i/></div>{!scanning&&<div className="camera-overlay"><Camera size={25}/><span>Starting camera…</span></div>}</div>
      {type==='parcel-scanner'?<>
        <div className="session-bar"><div className="session-count"><b>{session.filter(x=>x.state==='saved').length}</b><span>saved in this session</span></div><label className="ocr-toggle"><input type="checkbox" checked={readName} onChange={e=>setReadName(e.target.checked)}/> Read customer name (slower)</label></div>
        <p className="form-hint">Each parcel is saved automatically as soon as its barcode is detected. Show the next parcel — the scanner stays on. Tap Done when finished.</p>
        <label className="field-label">Barcode / AWB (manual entry)<input value={scanValue} onChange={e=>setScanValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveManual()}}} placeholder="Type or paste AWB, press Enter"/></label>
        <div className="session-actions"><Button variant="outline" onClick={saveManual}>Add manually</Button><Button onClick={onClose}>Done</Button></div>
        {session.length>0&&<div className="session-list">{session.slice(0,8).map(x=><div key={x.key} className={'session-row '+x.state}><b>{x.code}</b><span>{x.state==='duplicate'?'Duplicate - not added':(x.name||'Saved')}</span></div>)}</div>}
      </>:<>
        <p className="form-hint">Hold the product barcode in front of the camera.</p>
        <label className="field-label">Barcode<input value={scanValue} onChange={e=>setScanValue(e.target.value)} placeholder="Scan or enter barcode"/></label>
        <Button onClick={()=>{onClose();notify(scanValue?'Barcode saved for lookup':'Scanner closed')}}>Use this barcode</Button>
      </>}</div>
    :<form className="modal-form" onSubmit={submit}>
      {type==='product'&&<><Field label="Product name" value={form.name} onChange={v=>update('name',v)} required/><div className="form-row"><Field label="SKU" value={form.sku} onChange={v=>update('sku',v)} required/><Field label="Category" value={form.category} onChange={v=>update('category',v)}/></div><div className="form-row"><Field label="Selling price (₹)" value={form.price} onChange={v=>update('price',v)} type="number" required/><Field label="Cost price (₹)" value={form.cost} onChange={v=>update('cost',v)} type="number" required/></div><div className="form-row"><Field label="Opening stock" value={form.stock} onChange={v=>update('stock',v)} type="number" required/><Field label="Barcode" value={form.barcode} onChange={v=>update('barcode',v)}/></div></>}
      {type==='expense'&&<><Field label="Expense description" value={form.title} onChange={v=>update('title',v)} placeholder="e.g. Packaging material" required/><div className="form-row"><Field label="Amount (₹)" value={form.amount} onChange={v=>update('amount',v)} type="number" required/><label className="field-label">Category<select value={form.expenseCategory} onChange={e=>update('expenseCategory',e.target.value)}><option>Packaging</option><option>Shipping</option><option>Raw material</option><option>Marketing</option><option>Other</option></select></label></div></>}
      {type==='order'&&<><Field label="Customer name" value={form.customer} onChange={v=>update('customer',v)} required/><div className="form-row"><Field label="Order amount (₹)" value={form.amount} onChange={v=>update('amount',v)} type="number" required/><label className="field-label">Sales channel<select value={form.channel} onChange={e=>update('channel',e.target.value)}><option>Direct</option><option>Meesho</option><option>Flipkart</option><option>Amazon</option></select></label></div><Field label="Courier AWB / parcel barcode" value={form.awb} onChange={v=>update('awb',v)} placeholder="Enter AWB from shipping label"/><div className="form-row"><label className="field-label">Product linked to order<select value={form.productId} onChange={e=>update('productId',e.target.value)}><option value="">No product linked</option>{products.map(p=><option value={p.id} key={p.id}>{p.name} ({p.stock} in stock)</option>)}</select></label><Field label="Quantity" value={form.qty} onChange={v=>update('qty',v)} type="number" required/></div></>}
      {(type==='movement-in'||type==='movement-out'||type==='movement')&&<><label className="field-label">Select product<select value={form.productId} onChange={e=>update('productId',e.target.value)}>{products.map(p=><option value={p.id} key={p.id}>{p.name} — {p.stock} available</option>)}</select></label><Field label="Quantity" value={form.qty} onChange={v=>update('qty',v)} type="number" required/></>}
      <div className="modal-actions"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{type==='product'?'Add product':type==='expense'?'Save expense':type==='order'?'Create order':'Save stock movement'}</Button></div>
    </form>}
  </div></div>
}
function Field({label,value,onChange,type='text',placeholder='',required=false}) { return <label className="field-label">{label}<input type={type} value={value} placeholder={placeholder} required={required} min={type==='number'?0:undefined} onChange={e=>onChange(e.target.value)}/></label> }

export default App