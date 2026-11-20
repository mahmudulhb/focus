/**
 * Local-only daily counters. Nothing leaves the browser.
 */
(function () {
  'use strict';

  const { MINUTES_PER_INTERRUPTION, STATS_RETENTION_DAYS } = globalThis.FocusConfig;
  const STORAGE_KEY = 'stats';

  function dateKey(date) {
    const value = date instanceof Date ? date : new Date();
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function dayKeyDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return dateKey(date);
  }

  async function read() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const value = stored[STORAGE_KEY];
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function normalizeRecord(record) {
    const count = Number(record && record.reelsBlocked);
    return { reelsBlocked: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0 };
  }

  async function addReelBlocked(amount) {
    const increment = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 1;
    const stats = await read();
    const key = dateKey();
    stats[key] = normalizeRecord(stats[key]);
    stats[key].reelsBlocked += increment;

    const cutoff = dayKeyDaysAgo(STATS_RETENTION_DAYS);
    for (const existing of Object.keys(stats)) {
      if (existing < cutoff) delete stats[existing];
    }

    await chrome.storage.local.set({ [STORAGE_KEY]: stats });
    return todayFrom(stats);
  }

  function todayFrom(stats) {
    const key = dateKey();
    const record = normalizeRecord(stats[key]);
    return {
      date: key,
      reelsBlocked: record.reelsBlocked,
      minutes: record.reelsBlocked * MINUTES_PER_INTERRUPTION,
    };
  }

  async function today() {
    return todayFrom(await read());
  }

  async function resetToday() {
    const stats = await read();
    delete stats[dateKey()];
    await chrome.storage.local.set({ [STORAGE_KEY]: stats });
    return todayFrom(stats);
  }

  globalThis.FocusStats = {
    dateKey,
    read,
    today,
    addReelBlocked,
    resetToday,
  };
})();
