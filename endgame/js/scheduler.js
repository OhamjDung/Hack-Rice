/* Fires a random event from a weighted, no-repeat pool on a randomized
   interval. Crisis-tier events use a low weight so they stay rare. */
class EventScheduler {
  constructor(events, onFire, opts = {}) {
    this.events = events;
    this.onFire = onFire;
    this.minMs = opts.minMs ?? 8000;
    this.maxMs = opts.maxMs ?? 20000;
    this.queue = [];
    this.timer = null;
    this.active = false;
    this._refill();
  }

  // Weighted, no-repeat draw order for one full pass of the pool: repeat
  // each id by its weight, shuffle, then dedupe keeping first occurrence.
  _refill() {
    const pool = [];
    for (const e of this.events) {
      const w = Math.max(1, e.weight || 1);
      for (let i = 0; i < w; i++) pool.push(e.id);
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const seen = new Set();
    const order = [];
    for (const id of pool) {
      if (!seen.has(id)) { seen.add(id); order.push(id); }
    }
    this.queue = order;
  }

  _next() {
    if (this.queue.length === 0) this._refill();
    const id = this.queue.shift();
    return this.events.find(e => e.id === id) || null;
  }

  start() {
    if (this.active) return;
    this.active = true;
    this._scheduleNext();
  }

  stop() {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  _scheduleNext() {
    if (!this.active) return;
    const delay = this.minMs + Math.random() * (this.maxMs - this.minMs);
    this.timer = setTimeout(() => {
      if (!this.active) return;
      const event = this._next();
      if (event) this.onFire(event);
      this._scheduleNext();
    }, delay);
  }
}
