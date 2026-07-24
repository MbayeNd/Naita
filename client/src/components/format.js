const dateFmt = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

export const formatDate = (value) => (value ? dateFmt.format(new Date(value)) : '—');
export const formatTime = (value) => (value ? timeFmt.format(new Date(value)) : '—');
export const formatDateTime = (value) => (value ? `${formatDate(value)} · ${formatTime(value)}` : '—');
export const formatMark = (value) => (typeof value === 'number' ? value.toFixed(2) : '—');

/** Value for a datetime-local input, in the browser's own timezone. */
export function toLocalInputValue(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const BAND_LABELS = {
  excellent: 'Excellent',
  very_good: 'Very Good',
  good: 'Good',
  average: 'Average',
  below_average: 'Below Average',
};
