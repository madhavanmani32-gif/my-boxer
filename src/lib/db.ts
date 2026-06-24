import { VaultImage, VaultNote, VaultLink, VaultPassword } from '../types';

const DB_NAME = 'MyBoxerDB';
const DB_VERSION = 1;

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open database: ' + request.error?.message));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;

      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('links')) {
        db.createObjectStore('links', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('passwords')) {
        db.createObjectStore('passwords', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

// Helper generic store actions
export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as T[]);
    };

    request.onerror = () => {
      reject(new Error(`Failed to get items from ${storeName}`));
    };
  });
}

export async function addToStore<T>(storeName: string, item: Omit<T, 'id'>): Promise<number> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(item);

    request.onsuccess = () => {
      resolve(request.result as number);
    };

    request.onerror = () => {
      reject(new Error(`Failed to add item to ${storeName}`));
    };
  });
}

export async function updateInStore<T>(storeName: string, item: T): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to update item in ${storeName}`));
    };
  });
}

export async function deleteFromStore(storeName: string, id: number): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to delete item from ${storeName}`));
    };
  });
}

// Settings store helpers
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await initDB();
  return new Promise((resolve) => {
    const transaction = db.transaction('settings', 'readonly');
    const store = transaction.objectStore('settings');
    const request = store.get(key);

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.value as T);
      } else {
        resolve(defaultValue);
      }
    };

    request.onerror = () => {
      resolve(defaultValue);
    };
  });
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('settings', 'readwrite');
    const store = transaction.objectStore('settings');
    const request = store.put({ key, value });

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to save setting ${key}`));
    };
  });
}

// Backup Export function
export interface VaultBackup {
  version: number;
  exportedAt: number;
  images: VaultImage[];
  notes: VaultNote[];
  links: VaultLink[];
  passwords: VaultPassword[];
}

export async function exportVaultData(): Promise<string> {
  const images = await getAllFromStore<VaultImage>('images');
  const notes = await getAllFromStore<VaultNote>('notes');
  const links = await getAllFromStore<VaultLink>('links');
  const passwords = await getAllFromStore<VaultPassword>('passwords');

  const backup: VaultBackup = {
    version: 1,
    exportedAt: Date.now(),
    images,
    notes,
    links,
    passwords,
  };

  return JSON.stringify(backup, null, 2);
}

// Backup Import function
export async function importVaultData(backupJson: string): Promise<void> {
  const backup = JSON.parse(backupJson) as VaultBackup;
  if (!backup.version || !Array.isArray(backup.images) || !Array.isArray(backup.notes) || !Array.isArray(backup.links) || !Array.isArray(backup.passwords)) {
    throw new Error('Invalid backup file structure');
  }

  const db = await initDB();

  // Helper to clear and restore a store
  const restoreStore = async (storeName: string, items: any[]) => {
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const clearRequest = store.clear();
      clearRequest.onerror = () => reject(new Error(`Failed to clear store ${storeName}`));
      
      clearRequest.onsuccess = () => {
        if (items.length === 0) {
          resolve();
          return;
        }

        let addedCount = 0;
        let failed = false;

        items.forEach((item) => {
          // Remove ID to let it re-increment or keep if desired. We can keep it to preserve links or strip it.
          // Let's strip or preserve based on if id exists. Since it's a restore, keeping original IDs is best
          const req = store.add(item);
          req.onerror = () => {
            if (!failed) {
              failed = true;
              reject(new Error(`Failed to restore item in ${storeName}`));
            }
          };
          req.onsuccess = () => {
            addedCount++;
            if (addedCount === items.length) {
              resolve();
            }
          };
        });
      };
    });
  };

  await restoreStore('images', backup.images);
  await restoreStore('notes', backup.notes);
  await restoreStore('links', backup.links);
  await restoreStore('passwords', backup.passwords);
}

// Storage Calculator (in Bytes, and formatted string)
export interface StorageDetails {
  totalBytes: number;
  formattedSize: string;
  imagesBytes: number;
  notesBytes: number;
  linksBytes: number;
  passwordsBytes: number;
  itemCounts: {
    images: number;
    notes: number;
    links: number;
    passwords: number;
  };
}

export async function calculateStorageUsage(): Promise<StorageDetails> {
  const images = await getAllFromStore<VaultImage>('images');
  const notes = await getAllFromStore<VaultNote>('notes');
  const links = await getAllFromStore<VaultLink>('links');
  const passwords = await getAllFromStore<VaultPassword>('passwords');

  let imagesBytes = 0;
  images.forEach(img => {
    // Approx length of Base64 is about 4/3 of actual size
    imagesBytes += img.base64.length;
  });

  let notesBytes = 0;
  notes.forEach(note => {
    notesBytes += (note.title.length + note.content.length) * 2; // ~2 bytes per UTF-16 char
  });

  let linksBytes = 0;
  links.forEach(lnk => {
    linksBytes += (lnk.title.length + lnk.url.length) * 2;
  });

  let passwordsBytes = 0;
  passwords.forEach(pw => {
    passwordsBytes += (pw.service.length + pw.username.length + pw.password.length) * 2;
  });

  const totalBytes = imagesBytes + notesBytes + linksBytes + passwordsBytes;

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return {
    totalBytes,
    formattedSize: formatSize(totalBytes),
    imagesBytes,
    notesBytes,
    linksBytes,
    passwordsBytes,
    itemCounts: {
      images: images.length,
      notes: notes.length,
      links: links.length,
      passwords: passwords.length
    }
  };
}
