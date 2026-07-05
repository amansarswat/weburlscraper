/**
 * Throttled request queue.
 *
 * Caps concurrent scrapes both globally and per-target-domain, with an optional
 * politeness delay between consecutive requests to the same domain. This keeps
 * the process from opening unbounded sockets/browser pages and avoids hammering
 * a single origin (which gets you blocked and is rude).
 *
 * Behaviour:
 *   - A task only starts when BOTH a global slot and a per-domain slot are free
 *     AND the per-domain delay since the last start has elapsed.
 *   - A blocked domain never head-of-line-blocks tasks for other domains.
 *   - When more than `maxQueue` tasks are waiting, new tasks are rejected
 *     immediately (503 QUEUE_FULL) rather than growing unbounded.
 *   - A task that waits longer than `queueTimeoutMs` is rejected (503 QUEUE_TIMEOUT).
 */

const { AppError } = require('./errors');

class ThrottleQueue {
    constructor(cfg) {
        this.enabled = cfg.enabled;
        this.globalConcurrency = cfg.globalConcurrency;
        this.perDomainConcurrency = cfg.perDomainConcurrency;
        this.perDomainDelayMs = cfg.perDomainDelayMs;
        this.maxQueue = cfg.maxQueue;
        this.queueTimeoutMs = cfg.queueTimeoutMs;

        this.pending = []; // FIFO list of waiting tasks
        this.globalActive = 0;
        this.domainActive = new Map(); // domain -> running count
        this.domainLastStart = new Map(); // domain -> ts of last start
        this.domainWake = new Map(); // domain -> timer awaiting delay expiry
    }

    /** Current queue/concurrency snapshot (for /health and analytics). */
    stats() {
        return {
            enabled: this.enabled,
            globalActive: this.globalActive,
            queued: this.pending.length,
            busyDomains: this.domainActive.size,
            limits: {
                global: this.globalConcurrency,
                perDomain: this.perDomainConcurrency,
                perDomainDelayMs: this.perDomainDelayMs,
                maxQueue: this.maxQueue,
            },
        };
    }

    /**
     * Run `fn` under the queue's concurrency/politeness limits.
     * @param {string} domain  Grouping key (typically the target hostname).
     * @param {() => Promise<any>} fn
     */
    run(domain, fn) {
        if (!this.enabled) return Promise.resolve().then(fn);

        if (this.pending.length >= this.maxQueue) {
            return Promise.reject(new AppError('Server busy: scrape queue is full', 503, 'QUEUE_FULL'));
        }

        return new Promise((resolve, reject) => {
            const task = { domain: domain || '_', fn, resolve, reject, timer: null };
            task.timer = setTimeout(() => {
                const idx = this.pending.indexOf(task);
                if (idx !== -1) {
                    this.pending.splice(idx, 1);
                    reject(new AppError('Queued request timed out waiting for a slot', 503, 'QUEUE_TIMEOUT'));
                }
            }, this.queueTimeoutMs);
            this.pending.push(task);
            this._pump();
        });
    }

    _canStart(domain) {
        if (this.globalActive >= this.globalConcurrency) return false;
        if ((this.domainActive.get(domain) || 0) >= this.perDomainConcurrency) return false;
        if (this.perDomainDelayMs > 0) {
            const wait = this.perDomainDelayMs - (Date.now() - (this.domainLastStart.get(domain) || 0));
            if (wait > 0) {
                this._scheduleWake(domain, wait);
                return false;
            }
        }
        return true;
    }

    _scheduleWake(domain, wait) {
        if (this.domainWake.has(domain)) return; // one wake per domain is enough
        const timer = setTimeout(() => {
            this.domainWake.delete(domain);
            this._pump();
        }, wait);
        if (timer.unref) timer.unref();
        this.domainWake.set(domain, timer);
    }

    _pump() {
        for (let i = 0; i < this.pending.length; ) {
            const task = this.pending[i];
            if (this._canStart(task.domain)) {
                this.pending.splice(i, 1);
                clearTimeout(task.timer);
                this._start(task);
            } else {
                i += 1;
            }
        }
    }

    _start(task) {
        const { domain } = task;
        this.globalActive += 1;
        this.domainActive.set(domain, (this.domainActive.get(domain) || 0) + 1);
        this.domainLastStart.set(domain, Date.now());

        Promise.resolve()
            .then(task.fn)
            .then(task.resolve, task.reject)
            .finally(() => {
                this.globalActive -= 1;
                const remaining = (this.domainActive.get(domain) || 1) - 1;
                if (remaining <= 0) this.domainActive.delete(domain);
                else this.domainActive.set(domain, remaining);
                this._pump();
            });
    }

    /** Clear pending delay timers (used on shutdown). */
    close() {
        for (const timer of this.domainWake.values()) clearTimeout(timer);
        this.domainWake.clear();
    }
}

module.exports = { ThrottleQueue };
