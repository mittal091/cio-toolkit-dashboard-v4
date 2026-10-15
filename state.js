/* Small per-browser store for decision statuses. Later this becomes a call to the action-tracking system. */
const KEY = 'cio-toolkit-action-status';
let memory = {};

function stored() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY));
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch (e) {
    return {};
  }
}

export const loadStatus = () => ({ ...stored(), ...memory });

/* Returns true when the value was also written to browser storage. */
export function saveStatus(id, status) {
  memory[id] = status;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...stored(), [id]: status }));
    return true;
  } catch (e) {
    return false;
  }
}

export function resetStatus() {
  memory = {};
  try { localStorage.removeItem(KEY); } catch (e) { /* storage unavailable */ }
}
