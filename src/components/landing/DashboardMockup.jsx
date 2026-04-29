export default function DashboardMockup() {
  const invoices = [
    ['INV-1043', 'Northstar Studio', '$3,420', 'Paid'],
    ['INV-1044', 'Blue Peak Labs', '$1,280', 'Pending'],
    ['INV-1045', 'Atlas Commerce', '$2,940', 'Overdue'],
    ['INV-1046', 'Nova Retail', '$4,300', 'Paid']
  ];

  const clients = [
    ['Acme Corp', '$24,850'],
    ['Vertex Studio', '$18,400'],
    ['Prime Dynamics', '$13,620'],
    ['Bright Solutions', '$11,980']
  ];

  return (
    <div className="dashboard-ui">
      <div className="dashboard-topbar">
        <div className="dashboard-brand">Zenqar</div>
        <div className="dashboard-search">Search transactions, invoices, clients…</div>
        <div className="dashboard-top-meta">
          <span className="dot" />
          <span className="dot" />
          <span className="avatar">A</span>
        </div>
      </div>

      <div className="dashboard-body">
        <aside className="dashboard-sidebar">
          {['Overview', 'Invoices', 'Expenses', 'Transactions', 'Cash Flow', 'Reports', 'Team', 'Settings'].map((item, i) => (
            <div key={item} className={`sidebar-item ${i === 0 ? 'active' : ''}`}>{item}</div>
          ))}
        </aside>

        <div className="dashboard-main">
          <div className="stat-grid">
            <div className="stat-card"><span>Total Revenue</span><strong>$128,540</strong><em>+12.6% this month</em></div>
            <div className="stat-card"><span>Outstanding</span><strong>$32,850</strong><em>-8.3% this month</em></div>
            <div className="stat-card"><span>Expenses</span><strong>$45,230</strong><em>+4.2% this month</em></div>
            <div className="stat-card"><span>Net Profit</span><strong>$83,310</strong><em>+15.7% this month</em></div>
          </div>

          <div className="chart-row">
            <div className="panel revenue-panel">
              <div className="panel-head"><span>Revenue Overview</span><b>This month</b></div>
              <div className="line-chart">
                <svg viewBox="0 0 420 180" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="lineGlow" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#8b7dff" />
                      <stop offset="100%" stopColor="#ff66d9" />
                    </linearGradient>
                  </defs>
                  <path d="M0 130 C40 110, 60 120, 90 96 S140 55, 180 84 S240 140, 280 94 S350 56, 420 32" fill="none" stroke="url(#lineGlow)" strokeWidth="4" strokeLinecap="round" />
                  <path d="M0 145 C40 126, 60 132, 90 108 S140 67, 180 94 S240 152, 280 110 S350 80, 420 50" fill="url(#lineArea)" opacity="0.1" />
                </svg>
                <div className="chart-axis"><span>May 1</span><span>May 8</span><span>May 15</span><span>May 22</span><span>May 29</span></div>
              </div>
            </div>

            <div className="panel donut-panel">
              <div className="panel-head"><span>Invoice Status</span><b>Live</b></div>
              <div className="donut-wrap">
                <div className="donut" />
                <ul>
                  <li><span className="paid" /> Paid 62%</li>
                  <li><span className="pending" /> Pending 24%</li>
                  <li><span className="overdue" /> Overdue 14%</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bottom-row">
            <div className="panel invoice-panel">
              <div className="panel-head"><span>Recent Invoices</span><b>View all</b></div>
              <div className="invoice-table">
                {invoices.map(([id, client, amount, status]) => (
                  <div key={id} className="invoice-row">
                    <span>{id}</span>
                    <span>{client}</span>
                    <span>{amount}</span>
                    <span className={`status ${status.toLowerCase()}`}>{status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel cash-panel">
              <div className="panel-head"><span>Cash Flow</span><b>$83,310</b></div>
              <div className="bars">
                {[42, 72, 58, 95, 61, 88, 74, 106].map((h, i) => (
                  <span key={i} style={{ height: `${h}px` }} />
                ))}
              </div>
            </div>

            <div className="panel clients-panel">
              <div className="panel-head"><span>Top Clients</span><b>Revenue</b></div>
              <div className="client-list">
                {clients.map(([name, amount], i) => (
                  <div key={name} className="client-row">
                    <div>
                      <span>{name}</span>
                      <div className="progress"><i style={{ width: `${88 - i * 16}%` }} /></div>
                    </div>
                    <strong>{amount}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
