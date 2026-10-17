/** Local recording survives refresh/upload failure; removed after confirmed upload. No external AI. */
export async function recordingCache(
  key: string,
  value?: { blob: Blob; duration: number } | null,
): Promise<{ blob: Blob; duration: number } | undefined> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("classbank-homework-audio", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("recordings");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(
        "recordings",
        value === undefined ? "readonly" : "readwrite",
      );
      const store = tx.objectStore("recordings");
      const req =
        value === undefined
          ? store.get(key)
          : value === null
            ? store.delete(key)
            : store.put(value, key);
      tx.oncomplete = () =>
        resolve(value === undefined ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
