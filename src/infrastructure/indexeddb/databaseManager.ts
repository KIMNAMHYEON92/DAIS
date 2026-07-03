import { DATABASE_STORES, type DatabaseStoreName } from '@app-types/database';

const DATABASE_NAME = 'interrogation_station_db';
const DATABASE_VERSION = 1;

export class DatabaseManager {
  private db: IDBDatabase | null = null;

  public open(): Promise<DatabaseManager> {
    if (this.db) {
      return Promise.resolve(this);
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onerror = (): void => reject(request.error ?? new Error('Failed to open IndexedDB.'));
      request.onblocked = (): void => reject(new Error('IndexedDB upgrade was blocked.'));
      request.onupgradeneeded = (): void => {
        const database = request.result;

        if (!database.objectStoreNames.contains(DATABASE_STORES.userProfile)) {
          database.createObjectStore(DATABASE_STORES.userProfile, { keyPath: 'user_id' });
        }
        if (!database.objectStoreNames.contains(DATABASE_STORES.characterProgress)) {
          database.createObjectStore(DATABASE_STORES.characterProgress, { keyPath: 'character_id' });
        }
        if (!database.objectStoreNames.contains(DATABASE_STORES.offlineTelemetryQueue)) {
          database.createObjectStore(DATABASE_STORES.offlineTelemetryQueue, {
            keyPath: 'queue_id',
            autoIncrement: true,
          });
        }
      };
      request.onsuccess = (): void => {
        this.db = request.result;
        this.db.onversionchange = (): void => this.close();
        resolve(this);
      };
    });
  }

  public close(): void {
    this.db?.close();
    this.db = null;
  }

  public put<T>(storeName: DatabaseStoreName, value: T): Promise<void> {
    return this.runWrite(storeName, (store) => store.put(value));
  }

  public get<T>(storeName: DatabaseStoreName, key: IDBValidKey): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const request = this.getDatabase().transaction(storeName, 'readonly').objectStore(storeName).get(key);
      request.onerror = (): void => reject(request.error ?? new Error('IndexedDB read failed.'));
      request.onsuccess = (): void => resolve((request.result as T | undefined) ?? null);
    });
  }

  public getAll<T>(storeName: DatabaseStoreName): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const request = this.getDatabase().transaction(storeName, 'readonly').objectStore(storeName).getAll();
      request.onerror = (): void => reject(request.error ?? new Error('IndexedDB read failed.'));
      request.onsuccess = (): void => resolve(request.result as T[]);
    });
  }

  public delete(storeName: DatabaseStoreName, key: IDBValidKey): Promise<void> {
    return this.runWrite(storeName, (store) => store.delete(key));
  }

  private getDatabase(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database is not initialized.');
    }
    return this.db;
  }

  private runWrite(
    storeName: DatabaseStoreName,
    operation: (store: IDBObjectStore) => IDBRequest,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(storeName, 'readwrite');
      transaction.oncomplete = (): void => resolve();
      transaction.onerror = (): void =>
        reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
      transaction.onabort = (): void =>
        reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
      operation(transaction.objectStore(storeName));
    });
  }
}
