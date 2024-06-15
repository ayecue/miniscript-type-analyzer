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

  constructor(values?: readonly T[] | null) {
    this._map = new Map(values?.map((value) => [hash(value), value]));
  }

  [Symbol.iterator](): ObjectSetIterator<T> {
    return new ObjectSetIterator(Array.from(this._map.values()));
  }

  first(): T {
    return this._map.values().next().value;
  }

  add(value: T): this {
    const key = hash(value);
    this._map.set(key, value);
    return this;
  }

  delete(value: T): boolean {
    const key = hash(value);
    return this._map.delete(key);
  }

  extend(value: ObjectSet<T>): this {
    for (const keyPair of value._map) {
      this._map.set(...keyPair);
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
