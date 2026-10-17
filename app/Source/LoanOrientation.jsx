import React from 'react';
import { validDate } from './loan.js';
import { dateLabel } from './loanDates.js';
const cash = n => Number(n).toLocaleString('en-US', {
  style: 'currency',
  currency: 'USD'
});
export default function LoanOrientation({
  loan,
  c,
  asOf,
  onDate
}) {
  return <section className="loan-orientation" aria-label="Repayment overview"><div className="loan-orientation-toolbar"><strong>Repayment overview</strong><div className="loan-orientation-actions"><label>As of<input type="date" value={asOf} onChange={e => {
            if (validDate(e.target.value)) onDate(e.target.value);
          }} /></label></div></div><div className="loan-balance-focus"><span>Remaining principal</span><strong>{cash(c.balance)}</strong><progress value={c.paid} max={loan.principal} aria-label="Loan repaid" /><p><strong>{(c.paid / loan.principal * 100).toFixed(1)}% repaid</strong> · {cash(loan.monthlyPayment)}/month · Due {loan.dueDay}th{loan.graceDays ? ` · ${loan.graceDays} grace days` : ''} · No interest</p></div><div className="loan-orientation-figures"><div><span>Original loan</span><strong>{cash(loan.principal)}</strong></div><div><span>Received to date</span><strong className="balance-positive">{cash(c.paid)}</strong></div><div><span>Expected after grace</span><strong>{cash(c.scheduledDue)}</strong></div><div><span>Amount to catch up</span><strong className={c.arrears ? 'balance-negative' : 'balance-positive'}>{cash(c.arrears)}</strong></div></div><div className="loan-orientation-footer"><details><summary>Details &amp; calculation</summary><p>As of {dateLabel(asOf)}. Expected includes scheduled payments whose due date and grace period have ended. Catch-up is expected minus received, with a minimum of $0, and is already part of the remaining balance.</p><p>Later receipts stay in the month received. Earlier missed months remain visible; their historical gaps must not be added to catch-up.</p><p>Scheduled final installment: {dateLabel(c.rows.at(-1).due)}. Late or partial payments can extend actual repayment.</p></details></div></section>;
}
