export class CacheNode<K, V> {
  key: K;
  value: V;
  prev: CacheNode<K, V> | null = null;
  next: CacheNode<K, V> | null = null;

  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
  }
}

export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, CacheNode<K, V>>;
  private head: CacheNode<K, V> | null = null;
  private tail: CacheNode<K, V> | null = null;

  constructor(capacity: number = 50) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  private removeNode(node: CacheNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private addNodeToFront(node: CacheNode<K, V>): void {
    node.next = this.head;
    node.prev = null;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  get(key: K): V | null {
    const node = this.cache.get(key);

    if (node == null) {
      return null;
    }

    this.removeNode(node);
    this.addNodeToFront(node);

    return node.value;
  }

  set(key: K, value: V): void {
    const node = this.cache.get(key);

    if (node != null) {
      this.removeNode(node);
      node.value = value;
      this.addNodeToFront(node);
      return;
    }

    if (this.cache.size > this.capacity) {
      if (this.tail) {
        this.cache.delete(this.tail.key);
        this.removeNode(this.tail);
      }
    }

    const newNode = new CacheNode(key, value);
    this.cache.set(key, newNode);
    this.addNodeToFront(newNode);
  }
}
