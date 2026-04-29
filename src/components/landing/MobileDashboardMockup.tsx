'use client';

export default function MobileDashboardMockup() {
  const invoices = [
    ['INV-1044', '$1,280', 'Pending'],
    ['INV-1046', '$4,300', 'Paid'],
    ['INV-1045', '$2,940', 'Overdue']
  ];

  return (
    <div className="mobile-dashboard-ui">
      <div className="mobile-dashboard-topbar">
        <div className="mobile-dashboard-brand">Zenqar</div>
        <div className="mobile-dashboard-avatar">A</div>
      </div>

      <div className="mobile-dashboard-search">Search invoices or clients…</div>

      <div className="mobile-stat-grid">
        <div className="mobile-stat-card">
          <span>Revenue</span>
          <strong>$128.5K</strong>
        </div>
        <div className="mobile-stat-card">
          <span>Outstanding</span>
          <strong>$32.8K</strong>
        </div>
        <div className="mobile-stat-card">
          <span>Profit</span>
          <strong>$83.3K</strong>
        </div>
      </div>

      <div className="mobile-panel mobile-chart-panel">
        <div className="mobile-panel-head">
          <span>Cash flow</span>
          <b>Live</b>
        </div>
        <div className="mobile-bars">
          {[48, 76, 60, 92, 66, 100, 84].map((h, i) => (
            <span key={i} style={{ height: `${h}px` }} />
          ))}
        </div>
      </div>

      <div className="mobile-panel">
        <div className="mobile-panel-head">
          <span>Invoices</span>
          <b>3 items</b>
        </div>
        <div className="mobile-invoice-list">
          {invoices.map(([id, amount, status]) => (
            <div key={id} className="mobile-invoice-row">
              <div>
                <strong>{id}</strong>
                <small>{amount}</small>
              </div>
              <span className={`status ${status.toLowerCase()}`}>{status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
