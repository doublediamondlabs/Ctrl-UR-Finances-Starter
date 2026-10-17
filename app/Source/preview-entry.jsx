import React from 'react';
import { createRoot } from 'react-dom/client';
import PrivateForwarding from './PrivateForwarding.jsx';
const loan = {
  principal: 17000,
  start: '2026-01',
  initialPayment: 316,
  rateChange: '2026-01',
  monthlyPayment: 316,
  dueDay: 16,
  openingForwarded: 0,
  openingForwardedDate: '2026-01-01',
  receipts: [{
    id: 'a',
    month: '2026-01',
    date: '2026-01-16',
    amount: 316,
    note: 'Example receipt note'
  }, {
    id: 'b',
    month: '2026-02',
    date: '2026-02-16',
    amount: 316
  }, {
    id: 'c',
    month: '2026-03',
    date: '2026-03-16',
    amount: 316
  }],
  remittances: [{
    id: 'sent',
    date: '2026-03-25',
    amount: 632,
    reference: 'Example bank reference',
    note: 'Example forwarding note',
    allocations: [{
      receiptId: 'a',
      amount: 316
    }, {
      receiptId: 'b',
      amount: 316
    }]
  }]
};
createRoot(document.getElementById('root')).render(<section className="panel loan-workspace"><h2>Layout preview · Illustrative amounts only</h2><p>This is a demonstration, not your loan data. Tabs and details work; saving is disabled.</p><section className="catchup-summary"><div className="forwarding-pane-heading"><h3>Payment position</h3><small>As of April 17, 2026</small></div><div className="loan-compact-totals"><span>Expected before this date<strong>$1,264.00</strong></span><span>Received through this date<strong>$948.00</strong></span><span>Amount to catch up<strong className="balance-negative">$316.00</strong></span></div><p className="hint">Catch-up is part of the remaining balance. Monthly gaps are history, not extra debt.</p><details><summary>How this is calculated</summary><p>Scheduled payments due before the as-of date, minus money received through that date, floored at zero. Payments due today are not overdue.</p></details></section><PrivateForwarding loan={loan} asOf="2026-04-17" busy={true} onDirty={() => {}} onSave={async () => false} /></section>);
