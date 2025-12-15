// Utility helpers for reading/writing current user study data
export function getCurrentUserStudyData() {
  try {
    const raw = localStorage.getItem('userStudyData');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse userStudyData from localStorage', e);
    return null;
  }
}

export function saveUserStudyData(data) {
  try {
    localStorage.setItem('userStudyData', JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save userStudyData to localStorage', e);
  }
}

export function clearUserStudyData() {
  try {
    localStorage.removeItem('userStudyData');
  } catch (e) {
    console.warn('Failed to clear userStudyData from localStorage', e);
  }
}

export function getCurrentUserId() {
  const d = getCurrentUserStudyData();
  return d?.userId || null;
}

export default {
  getCurrentUserStudyData,
  saveUserStudyData,
  clearUserStudyData,
  getCurrentUserId
};
