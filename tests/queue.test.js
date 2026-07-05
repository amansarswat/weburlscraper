/**
 * ThrottleQueue unit tests.
 */

const { ThrottleQueue } = require('../lib/queue');

const defer = () => {
    let resolve;
    const promise = new Promise((r) => {
        resolve = r;
    });
    return { promise, resolve };
};

const flush = () => new Promise((r) => setImmediate(r));

describe('ThrottleQueue', () => {
    test('passes through when disabled', async () => {
        const q = new ThrottleQueue({ enabled: false });
        await expect(q.run('a.com', () => Promise.resolve(42))).resolves.toBe(42);
    });

    test('enforces global concurrency', async () => {
        const q = new ThrottleQueue({
            enabled: true, globalConcurrency: 2, perDomainConcurrency: 5,
            perDomainDelayMs: 0, maxQueue: 100, queueTimeoutMs: 5000,
        });

        const d1 = defer(); const d2 = defer(); const d3 = defer();
        let running = 0; let maxRunning = 0;
        const task = (d) => () => { running += 1; maxRunning = Math.max(maxRunning, running); return d.promise.then(() => { running -= 1; }); };

        // different domains so only the global cap applies
        const p1 = q.run('a.com', task(d1));
        const p2 = q.run('b.com', task(d2));
        const p3 = q.run('c.com', task(d3));
        await flush();

        expect(maxRunning).toBe(2); // 3rd is queued
        expect(q.stats().queued).toBe(1);

        d1.resolve(); await flush();
        expect(running).toBeGreaterThan(0); // 3rd started after a slot freed

        d2.resolve(); d3.resolve();
        await Promise.all([p1, p2, p3]);
        expect(maxRunning).toBe(2);
    });

    test('enforces per-domain concurrency', async () => {
        const q = new ThrottleQueue({
            enabled: true, globalConcurrency: 10, perDomainConcurrency: 1,
            perDomainDelayMs: 0, maxQueue: 100, queueTimeoutMs: 5000,
        });
        const order = [];
        const d1 = defer();
        const p1 = q.run('same.com', () => { order.push('start1'); return d1.promise; });
        const p2 = q.run('same.com', () => { order.push('start2'); return Promise.resolve(); });
        await flush();
        expect(order).toEqual(['start1']); // second blocked by per-domain cap
        d1.resolve();
        await Promise.all([p1, p2]);
        expect(order).toEqual(['start1', 'start2']);
    });

    test('rejects when the queue is full', async () => {
        const q = new ThrottleQueue({
            enabled: true, globalConcurrency: 1, perDomainConcurrency: 1,
            perDomainDelayMs: 0, maxQueue: 1, queueTimeoutMs: 5000,
        });
        const d = defer();
        const running = q.run('a.com', () => d.promise); // occupies the slot
        const queued = q.run('b.com', () => Promise.resolve()); // fills the 1-deep queue
        await flush();
        await expect(q.run('c.com', () => Promise.resolve())).rejects.toMatchObject({ code: 'QUEUE_FULL', statusCode: 503 });
        d.resolve();
        await Promise.all([running, queued]);
    });

    test('times out a task that waits too long', async () => {
        const q = new ThrottleQueue({
            enabled: true, globalConcurrency: 1, perDomainConcurrency: 1,
            perDomainDelayMs: 0, maxQueue: 10, queueTimeoutMs: 30,
        });
        const d = defer();
        const running = q.run('a.com', () => d.promise);
        const waiter = q.run('b.com', () => Promise.resolve('ok'));
        await expect(waiter).rejects.toMatchObject({ code: 'QUEUE_TIMEOUT' });
        d.resolve();
        await running;
    });

    test('applies a per-domain delay between starts', async () => {
        const q = new ThrottleQueue({
            enabled: true, globalConcurrency: 10, perDomainConcurrency: 1,
            perDomainDelayMs: 60, maxQueue: 10, queueTimeoutMs: 5000,
        });
        const starts = [];
        await q.run('a.com', () => { starts.push(Date.now()); return Promise.resolve(); });
        await q.run('a.com', () => { starts.push(Date.now()); return Promise.resolve(); });
        expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(50);
        q.close();
    });
});
