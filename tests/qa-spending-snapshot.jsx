import React from 'react';
import { createRoot } from 'react-dom/client';
import YearSummary from '../app/Source/YearSummary.jsx';
const row = (id, month, amount, subCategory) => ({
  id,
  month,
  amount,
  subCategory,
  description: subCategory,
  kind: 'expense',
  scope: 'residence',
  category: 'Residence',
  state: 'recorded',
  sheet: month
});
const b = {
  year: 2026,
  records: [row('a', 'September', 100, 'Food'), row('b', 'October', 150, 'Food'), row('c', 'October', 20, 'Fuel')],
  notes: []
};
const old = {
  year: 2025,
  records: [row('d', 'September', 50, 'Food')],
  notes: []
};
window.fail = false;
window.reads = [];
window.print = () => {
  window.printed = true;
};
createRoot(document.getElementById('root')).render(<YearSummary book={b} reporting={{}} onSaveReporting={async () => {}} links={{
  2025: {
    path: 'old'
  },
  2026: {
    path: 'current'
  }
}} api={async path => {
  window.reads.push(path);
  if (path.endsWith('2025') && window.fail) throw Error('Synthetic unavailable workbook');
  return {
    base64: path.endsWith('2025') ? 'old' : 'current'
  };
}} readBook={value => value === 'old' ? old : b} />);
