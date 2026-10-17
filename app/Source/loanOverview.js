export function loanOverview(calculation, today) {
  const month = today.slice(0, 7),
    current = calculation.rows.find(r => r.month === month);
  if (calculation.balance === 0) return {
    current,
    next: null,
    label: 'Loan paid in full',
    tone: 'green'
  };
  const next = current?.missing > 0 ? current : calculation.rows.find(r => r.month > month && r.missing > 0) || null;
  const monthName = current ? new Date(current.due + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long'
  }) : '';
  const status = current?.status;
  const wording = status === 'On time' ? 'paid on time' : status === 'Paid late' ? 'paid late' : status === 'Received · date unverified' ? 'received · date unverified' : status;
  return {
    current,
    next,
    label: current ? monthName + ' installment · ' + wording : calculation.arrears > 0 ? 'Outstanding shortfall · review loan schedule' : 'No installment scheduled this month',
    tone: !current ? calculation.arrears > 0 ? 'red' : 'neutral' : status === 'On time' ? 'green' : ['No payment received', 'Partial · below expected'].includes(status) ? 'red' : 'amber'
  };
}
