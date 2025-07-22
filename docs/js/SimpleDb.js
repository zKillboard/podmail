class SimpleDB {
  constructor(dbName = 'podmail', storeName = 'evemails', version = 1) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.version = version;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  async add(data) {
    return this._withStore('readwrite', store => store.add(data));
  }

  async get(id) {
    return this._withStore('readonly', store => store.get(id));
  }

  async getAll() {
    return this._withStore('readonly', store => store.getAll());
  }

  async update(data) {
    return this._withStore('readwrite', store => store.put(data));
  }

  async delete(id) {
    return this._withStore('readwrite', store => store.delete(id));
  }

  async clear() {
    return this._withStore('readwrite', store => store.clear());
  }

  async _withStore(mode, callback) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, mode);
      const store = tx.objectStore(this.storeName);
      const request = callback(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

window.SimpleDB = SimpleDB;