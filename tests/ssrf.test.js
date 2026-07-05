/**
 * SSRF guard unit tests.
 */

const { isPublicIp, normalizeAndParse, resolveToPublicIp } = require('../security/ssrf');
const { BlockedError, ValidationError } = require('../lib/errors');

describe('isPublicIp', () => {
    test.each([
        ['8.8.8.8', true],
        ['1.1.1.1', true],
        ['203.0.113.10', false], // TEST-NET-3 documentation range => reserved
        ['127.0.0.1', false],
        ['10.0.0.1', false],
        ['192.168.1.1', false],
        ['172.16.5.4', false],
        ['169.254.169.254', false], // cloud metadata (link-local)
        ['0.0.0.0', false],
        ['::1', false], // IPv6 loopback
        ['fe80::1', false], // IPv6 link-local
        ['fc00::1', false], // IPv6 unique-local
        ['::ffff:127.0.0.1', false], // IPv4-mapped loopback
        ['2606:4700:4700::1111', true], // Cloudflare IPv6 (public)
    ])('%s => %s', (ip, expected) => {
        expect(isPublicIp(ip)).toBe(expected);
    });
});

describe('normalizeAndParse', () => {
    test('prepends https when scheme missing', () => {
        expect(normalizeAndParse('example.com').href).toBe('https://example.com/');
    });

    test('rejects non-http protocols', () => {
        expect(() => normalizeAndParse('file:///etc/passwd')).toThrow(BlockedError);
        expect(() => normalizeAndParse('ftp://example.com')).toThrow(BlockedError);
    });

    test('rejects empty/invalid input', () => {
        expect(() => normalizeAndParse('')).toThrow(ValidationError);
        expect(() => normalizeAndParse('https://')).toThrow();
    });
});

describe('resolveToPublicIp', () => {
    test('rejects a literal private IP', async () => {
        await expect(resolveToPublicIp('127.0.0.1', false)).rejects.toThrow(BlockedError);
        await expect(resolveToPublicIp('169.254.169.254', false)).rejects.toThrow(BlockedError);
    });

    test('rejects localhost', async () => {
        await expect(resolveToPublicIp('localhost', false)).rejects.toThrow(BlockedError);
    });

    test('allows a literal public IP', async () => {
        await expect(resolveToPublicIp('8.8.8.8', false)).resolves.toMatchObject({ address: '8.8.8.8', family: 4 });
    });

    test('honours allowPrivate bypass', async () => {
        await expect(resolveToPublicIp('127.0.0.1', true)).resolves.toMatchObject({ address: '127.0.0.1' });
    });
});
