import { hash } from 'object-code';

export class ObjectSetIterator<T extends object> implements Iterator<T> {
  value: T[];
  index: number;

  constructor(value: T[]) {
    const me = this;
    me.value = value;
    me.index = 0;
  }

  next(): IteratorResult<T> {
    const me = this;

    if (me.index >= me.value.length) {
      return {
        value: null,
        done: true
      };
    }

    return {
      value: me.value[me.index++],
      done: false
    };
  }
}

export class ObjectSet<T extends object> {
  private _map: Map<number, T>;
  private _first: number | null;
  private _last: number | null;

  constructor(values?: readonly T[] | null) {
    const items = values ? Array.from(values) : [];
    const entries: [number, T][] = items.map((value) => [hash(value), value]);

    this._map = new Map(entries);
    this._first = null;
    this._last = null;

    if (entries.length > 0) {
      this._first = entries[0][0]!;
      this._last = entries[entries.length - 1][0]!;
    }
  }

  [Symbol.iterator](): ObjectSetIterator<T> {
    return new ObjectSetIterator(Array.from(this._map.values()));
  }

  first(): T {
    if (this._first != null) return this._map.get(this._first) ?? null;
    return null;
  }

  last(): T {
    if (this._last != null) return this._map.get(this._last) ?? null;
    return null;
  }

  toArray(): T[] {
    return Array.from(this._map.values());
  }

  add(value: T): this {
    const key = hash(value);
    this._map.set(key, value);
    this._first ??= key;
    this._last = key;
    return this;
  }

  delete(value: T): boolean {
    const key = hash(value);
    return this._map.delete(key);
  }

  extend(value: ObjectSet<T>): this {
    for (const [h, v] of value._map) {
      this._map.set(h, v);
      this._first ??= h;
      this._last = h;
    }
    return this;
  }

  toJSON(): object {
    return Array.from(this._map.values());
  }

  clear(): void {
    this._map.clear();
  }
}
