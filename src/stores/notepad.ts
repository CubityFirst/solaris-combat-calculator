// Free-text scratch notes, persisted to localStorage as they are typed.
import { ref, watch } from "vue";

const STORAGE_KEY = "solaris-combat-calculator:notes";

/** Guards against a runaway paste filling the storage quota. */
export const NOTES_LIMIT = 20_000;

const load = (): string => {
  try {
    return (localStorage.getItem(STORAGE_KEY) || "").slice(0, NOTES_LIMIT);
  } catch {
    return "";
  }
};

export const notes = ref<string>(load());

watch(notes, (value) => {
  if (value.length > NOTES_LIMIT) {
    notes.value = value.slice(0, NOTES_LIMIT);
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage unavailable (private mode, quota) - notes just won't persist.
  }
});
