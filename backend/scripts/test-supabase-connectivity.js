#!/usr/bin/env node
/**
 * Supabase Connectivity Test Script
 * 
 * Checks:
 *  1. Environment variables loaded correctly
 *  2. DNS resolution of the DB host
 *  3. TCP port 5432 reachable
 *  4. Prisma can connect and query
 *  5. Supabase REST API reachable
 *  6. Supabase Auth API reachable
 * 
 * Usage:
 *   node backend/scripts/test-supabase-connectivity.js
 */

const path = require('path');
const dns = require('dns').promises;
const net = require('net');
const http = require('https');

// ─── Load .env ────────────────────────────────────────────────────────────────
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// ─── Colour helpers ───────────────────────────────────────────────────────────
const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

const ok = (msg) => console.log(`  ${c.green}✅ PASS${c.reset}  ${msg}`);
const fail = (msg) => console.log(`  ${c.red}❌ FAIL${c.reset}  ${msg}`);
const warn = (msg) => console.log(`  ${c.yellow}⚠️  WARN${c.reset}  ${msg}`);
const info = (msg) => console.log(`  ${c.cyan}ℹ️  INFO${c.reset}  ${msg}`);
const step = (msg) => console.log(`\n${c.bold}${c.cyan}▶  ${msg}${c.reset}`);
const hr = () => console.log(`${c.gray}${'─'.repeat(60)}${c.reset}`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Mask sensitive string — show first 8 chars then *** */
function mask(str) {
    if (!str) return '(not set)';
    return str.length > 8 ? str.slice(0, 8) + '***' : '***';
}

/** Extract hostname from a postgres:// connection string */
function extractHostFromDatabaseUrl(url) {
    try {
        // Strip protocol and split on @
        const withoutProto = url.replace(/^postgresql:\/\/|^postgres:\/\//, '');
        const atIdx = withoutProto.lastIndexOf('@');
        if (atIdx === -1) throw new Error('No @ found');
        const hostPart = withoutProto.slice(atIdx + 1).split('/')[0]; // host:port/db
        const [host, port = '5432'] = hostPart.split(':');
        return { host, port: parseInt(port, 10) };
    } catch (e) {
        return null;
    }
}

/** Test TCP connectivity */
function tcpCheck(host, port, timeoutMs = 5000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        const timer = setTimeout(() => {
            socket.destroy();
            resolve({ ok: false, error: `Timed out after ${timeoutMs}ms` });
        }, timeoutMs);

        socket.connect(port, host, () => {
            clearTimeout(timer);
            socket.destroy();
            resolve({ ok: true });
        });

        socket.on('error', (err) => {
            clearTimeout(timer);
            resolve({ ok: false, error: err.message });
        });
    });
}

/** Simple HTTPS GET — returns { status, ok, body } */
function httpsGet(url, headers = {}) {
    return new Promise((resolve) => {
        const req = http.get(url, { headers, timeout: 8000 }, (res) => {
            let body = '';
            res.on('data', (d) => (body += d));
            res.on('end', () =>
                resolve({ status: res.statusCode, ok: res.statusCode < 500, body })
            );
        });
        req.on('error', (err) => resolve({ status: 0, ok: false, body: err.message }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, ok: false, body: 'Request timed out' }); });
    });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n${c.bold}${c.cyan}╔════════════════════════════════════════════════════════╗`);
    console.log(`║        Supabase Connectivity Test                      ║`);
    console.log(`╚════════════════════════════════════════════════════════╝${c.reset}\n`);

    let allPassed = true;

    // ── 1. Environment Variables ───────────────────────────────────────────────
    step('1. Environment Variables');
    hr();

    const DATABASE_URL = process.env.DATABASE_URL;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (DATABASE_URL) {
        ok(`DATABASE_URL is set  (${mask(DATABASE_URL)})`);
    } else {
        fail('DATABASE_URL is NOT set'); allPassed = false;
    }

    if (SUPABASE_URL) {
        ok(`SUPABASE_URL is set  (${SUPABASE_URL})`);
    } else {
        fail('SUPABASE_URL is NOT set'); allPassed = false;
    }

    if (SUPABASE_SERVICE_ROLE) {
        ok(`SUPABASE_SERVICE_ROLE_KEY is set  (${mask(SUPABASE_SERVICE_ROLE)})`);
    } else {
        warn('SUPABASE_SERVICE_ROLE_KEY is NOT set (optional but recommended)');
    }

    // Validate DATABASE_URL format
    if (DATABASE_URL) {
        const parsed = extractHostFromDatabaseUrl(DATABASE_URL);
        if (parsed) {
            info(`Parsed DB host: ${c.bold}${parsed.host}:${parsed.port}${c.reset}`);
        } else {
            fail('DATABASE_URL format is invalid — could not parse host/port'); allPassed = false;
        }
    }

    // ── 2. DNS Resolution ──────────────────────────────────────────────────────
    step('2. DNS Resolution');
    hr();

    const parsed = DATABASE_URL ? extractHostFromDatabaseUrl(DATABASE_URL) : null;

    if (parsed) {
        try {
            const addresses = await dns.resolve4(parsed.host).catch(() => dns.resolve6(parsed.host));
            ok(`Resolved ${parsed.host} → ${addresses.slice(0, 3).join(', ')}`);
        } catch (e) {
            fail(`DNS resolution failed for ${parsed.host}: ${e.message}`);
            allPassed = false;
            warn('This usually means the Supabase project is PAUSED or the hostname is wrong.');
            warn('Go to https://supabase.com/dashboard and check project status.');
        }
    } else {
        warn('Skipping DNS check — DATABASE_URL not parseable');
    }

    if (SUPABASE_URL) {
        try {
            const supahost = new URL(SUPABASE_URL).hostname;
            const addrs = await dns.resolve4(supahost).catch(() => dns.resolve6(supahost));
            ok(`Resolved ${supahost} → ${addrs.slice(0, 2).join(', ')}`);
        } catch (e) {
            fail(`DNS resolution failed for SUPABASE_URL host: ${e.message}`); allPassed = false;
        }
    }

    // ── 3. TCP Port 5432 ───────────────────────────────────────────────────────
    step('3. TCP Port Connectivity (port 5432)');
    hr();

    if (parsed) {
        info(`Attempting TCP connection to ${parsed.host}:${parsed.port} ...`);
        const tcp = await tcpCheck(parsed.host, parsed.port);
        if (tcp.ok) {
            ok(`TCP connection to ${parsed.host}:${parsed.port} succeeded`);
        } else {
            fail(`TCP connection to ${parsed.host}:${parsed.port} failed — ${tcp.error}`);
            allPassed = false;
            warn('Port 5432 is blocked or the server is not accepting connections.');
            warn('Check: firewall rules, VPN, or whether the Supabase project is paused.');
        }
    } else {
        warn('Skipping TCP check — DATABASE_URL not parseable');
    }

    // ── 4. Prisma DB Connection ────────────────────────────────────────────────
    step('4. Prisma Database Connection');
    hr();

    try {
        // Dynamically require Prisma client so the script doesn't hard-fail on import
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient({
            log: [],
            datasources: { db: { url: DATABASE_URL } },
        });

        info('Connecting via Prisma...');
        await prisma.$connect();
        ok('Prisma connected successfully');

        // Run a lightweight query
        const result = await prisma.$queryRaw`SELECT current_database(), version()`;
        ok(`Query OK — database: ${result[0].current_database}`);
        info(`PostgreSQL version: ${result[0].version.split(' ').slice(0, 2).join(' ')}`);

        await prisma.$disconnect();
        ok('Prisma disconnected cleanly');
    } catch (e) {
        fail(`Prisma connection failed: ${e.message}`);
        allPassed = false;
        if (e.message.includes("Can't reach database server")) {
            warn('→ Network cannot reach the DB server. See DNS/TCP checks above.');
        } else if (e.message.includes('password') || e.message.includes('authentication')) {
            warn('→ Credentials look wrong. Check DATABASE_URL username/password.');
        }
    }

    // ── 5. Supabase REST API ───────────────────────────────────────────────────
    step('5. Supabase REST API');
    hr();

    if (SUPABASE_URL) {
        const restUrl = `${SUPABASE_URL}/rest/v1/`;
        info(`GET ${restUrl}`);
        const res = await httpsGet(restUrl, {
            apikey: SUPABASE_SERVICE_ROLE || '',
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE || ''}`,
        });

        if (res.status === 200 || res.status === 400) {
            // 400 = bad request but server responded = reachable
            ok(`REST API responded (HTTP ${res.status})`);
        } else if (res.status === 401) {
            warn(`REST API reachable but returned 401 Unauthorized — check SUPABASE_SERVICE_ROLE_KEY`);
        } else {
            fail(`REST API not reachable (HTTP ${res.status}): ${res.body.slice(0, 120)}`);
            allPassed = false;
        }
    } else {
        warn('Skipping REST API check — SUPABASE_URL not set');
    }

    // ── 6. Supabase Auth API ───────────────────────────────────────────────────
    step('6. Supabase Auth API');
    hr();

    if (SUPABASE_URL) {
        const authUrl = `${SUPABASE_URL}/auth/v1/health`;
        info(`GET ${authUrl}`);
        const res = await httpsGet(authUrl, {
            apikey: SUPABASE_SERVICE_ROLE || '',
        });

        if (res.ok) {
            ok(`Auth API healthy (HTTP ${res.status})`);
        } else {
            fail(`Auth API returned HTTP ${res.status}: ${res.body.slice(0, 120)}`);
            allPassed = false;
        }
    } else {
        warn('Skipping Auth check — SUPABASE_URL not set');
    }

    // ── Summary ────────────────────────────────────────────────────────────────
    console.log(`\n${c.bold}${c.cyan}${'═'.repeat(60)}${c.reset}`);
    if (allPassed) {
        console.log(`${c.bold}${c.green}  ✅  ALL CHECKS PASSED — Supabase is fully reachable!${c.reset}`);
    } else {
        console.log(`${c.bold}${c.red}  ❌  SOME CHECKS FAILED — see details above${c.reset}`);
        console.log(`
  Common fixes:
  ${c.yellow}•${c.reset} Supabase project paused  →  https://supabase.com/dashboard → Restore
  ${c.yellow}•${c.reset} Wrong DATABASE_URL        →  copy from Supabase: Settings > Database
  ${c.yellow}•${c.reset} Bad password encoding     →  @ in password must be %40 in the URL
  ${c.yellow}•${c.reset} VPN / firewall blocking   →  disable VPN or whitelist port 5432
`);
    }
    console.log(`${c.bold}${c.cyan}${'═'.repeat(60)}${c.reset}\n`);

    process.exit(allPassed ? 0 : 1);
}

main().catch((e) => {
    console.error('\nUnexpected error running connectivity test:', e);
    process.exit(1);
});
