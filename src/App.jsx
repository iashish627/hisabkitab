import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import Tesseract from 'tesseract.js'
import {
  LayoutDashboard, Package, ShoppingBag, ArrowDownToLine, ArrowUpFromLine,
  ReceiptText, ChartNoAxesCombined, ScanLine, Search, Bell, Plus, ChevronDown,
  Menu, X, IndianRupee, TrendingUp, TrendingDown, Boxes, CircleAlert,
  MoreHorizontal, CalendarDays, Download, Filter, Camera, Keyboard, Check,
  Clock3, Truck, Wallet, ArrowUpRight, ArrowDownRight, Sparkles, Tag
} from 'lucide-react'

const money = n => '₹' + Number(n || 0).toLocaleString('en-IN')
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
    if (!String(code || '').trim()) { notify('Scan the parcel barcode first'); return }
    const entry = { id: Date.now(), code: String(code).trim(), customerName: String(customerName || '').trim() || 'Name not detected', mode, createdAt: new Date().toISOString() }
    setParcelLogs(prev => [entry, ...prev])
    notify(mode === 'dispatch' ? 'Outgoing parcel recorded' : mode === 'rto' ? 'RTO parcel recorded' : 'Customer return recorded')
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
        {page === 'Dashboard' && <Dashboard products={products} orders={orders} expenses={expenses} onNavigate={changePage} onAdd={() => setModal('order')}/>}
        {page === 'Inventory' && <Inventory products={filteredProducts} onAdd={() => setModal('product')} onScan={() => setModal('scanner')} onEdit={p => { setScanValue(p.barcode); setModal('movement') }}/>}
        {page === 'Orders' && <Orders orders={filteredOrders} onAdd={() => setModal('order')}/>}
        {page === 'Incoming' && <ParcelOperations page={page} onScan={mode => { setParcelMode(mode); setScanValue(''); setModal('parcel-scanner') }} parcelLogs={parcelLogs} />}
        {page === 'Outgoing' && <ParcelOperations page={page} onScan={mode => { setParcelMode(mode); setScanValue(''); setModal('parcel-scanner') }} parcelLogs={parcelLogs} />}
        {page === 'Expenses' && <Expenses expenses={expenses} onAdd={() => setModal('expense')}/>}
        {page === 'Reports' && <Reports products={products} orders={orders} expenses={expenses} parcelLogs={parcelLogs}/>}
      </div>
    </main>
    {modal && <Modal type={modal} products={products} scanValue={scanValue} setScanValue={setScanValue} onClose={() => setModal('')} onProduct={addProduct} onExpense={addExpense} onOrder={addOrder} onMovement={recordMovement} onParcelScan={processParcelScan} parcelMode={parcelMode} notify={notify}/>}
    {toast && <div className="toast"><Check size={17}/>{toast}</div>}
  </div>
}

function PageHeading({ eyebrow, title, desc, action, secondary }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{desc}</p></div><div className="heading-actions">{secondary}{action}</div></div>
}
function Button({ children, variant = 'primary', onClick, icon: Icon, type = 'button' }) { return <button type={type} className={'btn btn-' + variant} onClick={onClick}>{Icon && <Icon size={16}/ >}{children}</button> }
function Dashboard({ products, orders, expenses, onNavigate, onAdd }) {
  const stockValue = products.reduce((s,p) => s + p.stock*p.cost, 0)
  const low = products.filter(p => p.stock > 0 && p.stock <= 8).length
  const delivered = orders.reduce((s,o) => s+o.amount,0)
  const spent = expenses.reduce((s,e) => s+e.amount,0)
  return <>
    <PageHeading eyebrow="MONDAY, 02 NOVEMBER 2026" title="Your business overview" desc="Here's what's happening with your business today." action={<Button icon={Plus} onClick={onAdd}>Create order</Button>}/>
    <div className="welcome-strip"><div className="welcome-icon"><Sparkles size={19}/></div><div><b>Your business, at a glance.</b><span>Keep orders moving and stock levels healthy. Add your products, orders and expenses to start tracking your business.</span></div><button onClick={() => onNavigate('Reports')}>View business report <ArrowUpRight size={15}/></button></div>
    <div className="section-head"><div><h2>Business overview</h2><span>Performance snapshot</span></div><button className="date-chip"><CalendarDays size={15}/> This month <ChevronDown size={14}/></button></div>
    <div className="stats-grid">
      <Stat label="Total sales" value={money(delivered)} change="Recorded order value" trend="up" icon={IndianRupee} tone="blue" note="vs. last month"/>
      <Stat label="Orders received" value={orders.length} change="Recorded orders" trend="up" icon={ShoppingBag} tone="violet" note="vs. last month"/>
      <Stat label="Inventory value" value={money(stockValue)} change={low + ' low stock'} trend="down" icon={Boxes} tone="orange" note="at cost price"/>
      <Stat label="Total expenses" value={money(spent)} change="This month" trend="neutral" icon={ReceiptText} tone="green" note="recorded expenses"/>
    </div>
    <div className="dashboard-grid"><section className="panel sales-panel"><div className="panel-head"><div><h3>Sales overview</h3><p>Revenue performance over time</p></div><button className="select-chip">Last 7 days <ChevronDown size={14}/></button></div><div className="empty-state">Sales trend will appear here after you record orders.</div></section>
      <section className="panel channel-panel"><div className="panel-head"><div><h3>Order channels</h3><p>Where orders come from</p></div><MoreHorizontal size={19}/></div><div className="empty-state">Channel breakdown will appear after you record orders.</div></section></div>
    <div className="bottom-grid"><section className="panel"><div className="panel-head"><div><h3>Recent orders</h3><p>Latest activity from your store</p></div><button className="text-link" onClick={() => onNavigate('Orders')}>View all <ArrowUpRight size={14}/></button></div><OrderTable orders={orders.slice(0,4)}/></section><section className="panel stock-panel"><div className="panel-head"><div><h3>Stock alerts</h3><p>Products that need attention</p></div><button className="text-link" onClick={() => onNavigate('Inventory')}>Inventory <ArrowUpRight size={14}/></button></div>{products.filter(p=>p.stock<=8).slice(0,4).map(p=><div className="stock-alert" key={p.id}><div className="product-thumb"><Package size={17}/></div><div className="stock-name"><b>{p.name}</b><span>{p.sku}</span></div><span className={'stock-count ' + (p.stock===0?'zero':'')}>{p.stock===0?'Out of stock':p.stock+' left'}</span></div>)}</section></div>
  </>
}
function Stat({ label, value, change, trend, icon: Icon, tone, note }) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className={'stat-icon '+tone}><Icon size={18}/></div></div><strong>{value}</strong><div className="stat-foot"><span className={'trend '+trend}>{trend==='up'?<TrendingUp size={13}/>:trend==='down'?<CircleAlert size={13}/>:null}{change}</span><span>{note}</span></div></div> }
function Inventory({ products, onAdd, onScan, onEdit }) { return <>
  <PageHeading eyebrow="PRODUCT MANAGEMENT" title="Inventory" desc="Manage your products, stock levels and pricing." action={<><Button variant="outline" icon={ScanLine} onClick={onScan}>Scan barcode</Button><Button icon={Plus} onClick={onAdd}>Add product</Button></>}/>
  <div className="stats-grid compact-stats"><Stat label="Total products" value={products.length} change="Across categories" trend="neutral" icon={Package} tone="blue" note="active SKUs"/><Stat label="Units in stock" value={products.reduce((s,p)=>s+p.stock,0)} change="Available" trend="up" icon={Boxes} tone="violet" note="total quantity"/><Stat label="Low stock items" value={products.filter(p=>p.stock>0&&p.stock<=8).length} change="Needs attention" trend="down" icon={CircleAlert} tone="orange" note="8 units or less"/><Stat label="Out of stock" value={products.filter(p=>p.stock===0).length} change="Restock needed" trend="down" icon={Package} tone="green" note="unavailable items"/></div>
  <section className="panel table-panel"><div className="table-toolbar"><div><h3>All products <span className="count-pill">{products.length}</span></h3><p>Your product catalogue and stock status</p></div><div className="toolbar-actions"><button className="select-chip"><Filter size={14}/> Filter <ChevronDown size={14}/></button><button className="select-chip"><Download size={14}/> Export</button></div></div><ProductTable products={products} onEdit={onEdit}/></section>
</> }
function ParcelOperations({ onScan, parcelLogs, page }) {
  const isOutgoing = page === 'Outgoing'
  const modes = isOutgoing
    ? [{ id: 'dispatch', title: 'Outgoing parcels', desc: 'Scan each parcel label when handing shipments to the courier.', icon: ArrowUpFromLine }]
    : [{ id: 'rto', title: 'RTO received', desc: 'Scan parcels returned by the courier as Return to Origin.', icon: ArrowDownToLine }, { id: 'return', title: 'Customer returns', desc: 'Scan parcels sent back by customers.', icon: Package }]
  const today = new Date().toDateString()
  const todayLogs = parcelLogs.filter(x => new Date(x.createdAt).toDateString() === today && modes.some(m => m.id === x.mode))
  return <>
    <PageHeading eyebrow={isOutgoing ? 'PARCEL DISPATCH' : 'PARCEL RETURNS'} title={isOutgoing ? 'Outgoing parcels' : 'Incoming returns'} desc={isOutgoing ? 'Scan parcels sent out to customers and keep a daily dispatch count.' : 'Record returned parcels separately as RTO or customer returns.'}/>
    <div className={'parcel-mode-grid ' + (isOutgoing ? 'single-parcel-mode' : '')}>
      {modes.map(m => {
        const count = todayLogs.filter(x => x.mode === m.id).length
        return <section className="panel parcel-mode-card" key={m.id}>
          <div className="parcel-card-top"><div className="movement-icon"><m.icon size={21}/></div><span className="parcel-today">TODAY</span></div>
          <h3>{m.title}</h3><p>{m.desc}</p>
          <div className="parcel-card-bottom"><div className="parcel-count">{count}<small> parcels scanned today</small></div><Button icon={ScanLine} onClick={() => onScan(m.id)}>Open scanner</Button></div>
        </section>
      })}
    </div>
    <section className="panel table-panel parcel-history">
      <div className="table-toolbar"><div><h3>Today's scan history</h3><p>{todayLogs.length} parcel{todayLogs.length===1?'':'s'} recorded today</p></div><span className="parcel-total">{todayLogs.length} TOTAL</span></div>
      <div className="table-scroll"><table><thead><tr><th>TIME</th><th>PARCEL TYPE</th><th>BARCODE / AWB</th><th>CUSTOMER NAME</th></tr></thead><tbody>
        {todayLogs.map(x=><tr key={x.id}><td>{new Date(x.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</td><td><span className="channel-tag">{x.mode==='dispatch'?'Outgoing':x.mode==='rto'?'RTO':'Customer Return'}</span></td><td className="id-cell">{x.code}</td><td className="customer-cell">{x.customerName}</td></tr>)}
      </tbody></table>{!todayLogs.length&&<Empty text="No parcels scanned today yet."/>}</div>
    </section>
  </>
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
function Reports({ products, orders, expenses, parcelLogs = [] }) {
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
    <div className="stats-grid compact-stats"><Stat label="Order value" value={money(sales)} change="All orders" trend="up" icon={IndianRupee} tone="blue" note="gross order value"/><Stat label="Expenses" value={money(costs)} change="Recorded" trend="neutral" icon={ReceiptText} tone="orange" note="business costs"/><Stat label="Net order value*" value={money(sales-costs)} change="Estimate" trend={sales>=costs?'up':'down'} icon={TrendingUp} tone="green" note="sales less expenses"/><Stat label="Stock at cost" value={money(products.reduce((sum,p)=>sum+p.stock*p.cost,0))} change="Current" trend="neutral" icon={Boxes} tone="violet" note="inventory valuation"/></div>
    <div className="report-note">*Indicative calculation only. Taxes, marketplace fees, refunds and cost of goods sold are not included. Return ratio is a simple operational indicator, not a final return rate for a matched order cohort.</div>
    <section className="panel report-panel"><h3>Inventory health</h3><p>Current product availability</p>{[['Healthy stock',products.filter(p=>p.stock>8).length,'#2caa78'],['Low stock',products.filter(p=>p.stock>0&&p.stock<=8).length,'#e5a13b'],['Out of stock',products.filter(p=>p.stock===0).length,'#e16b6b']].map(([label,n,color])=><div className="report-row" key={label}><span>{label}</span><div className="report-track"><i style={{width:(products.length?n/products.length*100:0)+'%',background:color}}/></div><b>{n}</b></div>)}</section>
  </>
}
function Modal({ type, products, scanValue, setScanValue, onClose, onProduct, onExpense, onOrder, onMovement, onParcelScan, parcelMode, notify }) {
  const [form,setForm]=useState({name:'',sku:'',category:'General',stock:'10',price:'199',cost:'50',barcode:scanValue,customer:'',amount:'',channel:'Direct',title:'',expenseCategory:'Packaging',productId:products[0]?.id||'',qty:'1',awb:''})
  const [scanning,setScanning]=useState(false), [ocrName,setOcrName]=useState(''), [ocrBusy,setOcrBusy]=useState(false), videoRef=useRef(null), controlsRef=useRef(null)
  useEffect(()=>{ if(type!=='scanner' && type!=='parcel-scanner') return; let active=true; const start=async()=>{try{const reader=new BrowserMultiFormatReader();const controls=await reader.decodeFromVideoDevice(undefined,videoRef.current,(result)=>{if(result&&active){const code=result.getText();setScanValue(code);setForm(f=>({...f,barcode:code}));setScanning(false);if(type==='parcel-scanner'){const video=videoRef.current;const canvas=document.createElement('canvas');canvas.width=video?.videoWidth||640;canvas.height=video?.videoHeight||480;canvas.getContext('2d')?.drawImage(video,0,0,canvas.width,canvas.height);setOcrBusy(true);Tesseract.recognize(canvas.toDataURL('image/png'),'eng').then(({data})=>{const lines=(data.text||'').split('\\n').map(x=>x.trim()).filter(Boolean);const candidate=lines.find(x=>/^[A-Z][A-Z .'-]{4,}$/.test(x)&&!/(SHIP|DELIVER|RETURN|ADDRESS|MOBILE|PHONE|PINCODE|AWB|ORDER)/i.test(x));setOcrName(candidate||'')}).catch(()=>notify('Name could not be read. Enter it manually.')).finally(()=>setOcrBusy(false))}else{notify('Barcode detected: '+code)}}});controlsRef.current=controls;setScanning(true)}catch(e){notify('Camera unavailable. Enter barcode manually.')}}; start(); return()=>{active=false;controlsRef.current?.stop() }},[type])
  const update=(k,v)=>setForm(f=>({...f,[k]:v}))
  const title=type==='parcel-scanner'?(parcelMode==='dispatch'?'Scan outgoing parcel':parcelMode==='rto'?'Scan RTO parcel':'Scan customer return'):type==='product'?'Add new product':type==='expense'?'Add business expense':type==='order'?'Create new order':type==='scanner'?'Scan product barcode':type==='movement-in'?'Record incoming stock':type==='movement-out'?'Record outgoing stock':'Adjust stock'
  const submit=e=>{e.preventDefault(); if(type==='product')onProduct(form); if(type==='expense')onExpense({title:form.title,category:form.expenseCategory,amount:form.amount}); if(type==='order')onOrder({customer:form.customer,amount:Number(form.amount),channel:form.channel,awb:form.awb,productId:form.productId,qty:form.qty}); if(type.startsWith('movement'))onMovement(type==='movement-out'?'Outgoing':'Incoming',form.productId,Number(form.qty))}
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-head"><div><span className="eyebrow">HISABKITAB WORKSPACE</span><h2>{title}</h2></div><button className="icon-btn" onClick={onClose}><X size={19}/></button></div>
    {(type==='scanner'||type==='parcel-scanner')?<div className="scanner-body"><div className="camera-box"><video ref={videoRef}/><div className="scan-frame"><i/></div>{!scanning&&<div className="camera-overlay"><Camera size={25}/><span>Starting camera…</span></div>}</div><p className="form-hint">Keep the full courier label in view. Barcode is scanned and OCR tries to read the printed customer name. Verify it before saving.</p><label className="field-label">Barcode / AWB<input value={scanValue} onChange={e=>setScanValue(e.target.value)} placeholder="Scan or enter barcode"/></label>{type==='parcel-scanner'&&<><label className="field-label">Customer name {ocrBusy?'— reading label…':''}<input value={ocrName} onChange={e=>setOcrName(e.target.value)} placeholder="Name detected by OCR; edit if needed"/></label><p className="form-hint">OCR may not identify every label correctly. Verify the name before saving.</p></>}<Button onClick={()=>{if(type==='parcel-scanner'){onParcelScan(scanValue,parcelMode,ocrName);onClose()}else{onClose();notify(scanValue?'Barcode saved for lookup':'Scanner closed')}}}> {type==='parcel-scanner'?'Save parcel':'Use this barcode'}</Button></div>
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
