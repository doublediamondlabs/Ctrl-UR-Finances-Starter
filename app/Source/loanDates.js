const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function monthLabel(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value || '')) return value || '';
  return `${months[Number(value.slice(5)) - 1]} ${value.slice(0, 4)}`;
}
export function dateLabel(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return monthLabel(value);
  return `${months[Number(value.slice(5, 7)) - 1]} ${Number(value.slice(8))}, ${value.slice(0, 4)}`;
}
