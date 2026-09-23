#!/usr/bin/env node

// monitor.js
// Run this BEFORE k6 in a separate terminal:
//   Terminal 1: node monitor.js
//   Terminal 2: k6 run load-test.js

const http = require('http');

const CONFIG = {
    appUrl: 'http://localhost:3000',
    pollIntervalMs: 2000,
    idleThresholdMs: 15000, // stop if no progress for 15s
};

function httpGet(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let raw = '';
            res.on('data', (c) => (raw += c));
            res.on('end', () => resolve(JSON.parse(raw)));
        }).on('error', reject);
    });
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function time() {
    return new Date().toISOString().slice(11, 19);
}

function printStats(stats, elapsed) {
    const { jobs, queues } = stats;
    const jobsPerMin = elapsed > 0
        ? ((jobs.completed / elapsed) * 60).toFixed(0)
        : 0;

    process.stdout.write('\x1Bc'); // clear terminal
    console.log(`Job Queue Monitor — press Ctrl+C to stop\n`);
    console.log(`  Elapsed       : ${elapsed.toFixed(1)}s`);
    console.log(`  Throughput    : ${jobsPerMin} jobs/min\n`);
    console.log(`  ┌─────────────────────────────┐`);
    console.log(`  │ PENDING      ${String(jobs.pending).padEnd(16)}│`);
    console.log(`  │ PROCESSING   ${String(jobs.processing).padEnd(16)}│`);
    console.log(`  │ COMPLETED    ${String(jobs.completed).padEnd(16)}│`);
    console.log(`  │ RETRYING     ${String(jobs.retrying).padEnd(16)}│`);
    console.log(`  │ FAILED       ${String(jobs.failed).padEnd(16)}│`);
    console.log(`  ├─────────────────────────────┤`);
    console.log(`  │ queue:high   ${String(queues.high).padEnd(16)}│`);
    console.log(`  │ queue:def    ${String(queues.default).padEnd(16)}│`);
    console.log(`  │ queue:dlq    ${String(queues.dlq).padEnd(16)}│`);
    console.log(`  └─────────────────────────────┘`);
}

function printReport(snapshots, startTime) {
    const totalElapsed = (Date.now() - startTime) / 1000;
    const last = snapshots[snapshots.length - 1];

    if (!last) return;

    const jobsPerMin = ((last.completed / totalElapsed) * 60).toFixed(0);
    const total = last.completed + last.failed + last.retrying;
    const successRate = total > 0
        ? ((last.completed / total) * 100).toFixed(1)
        : '0.0';

    // find p95 throughput from snapshots
    const rates = snapshots
        .filter((_, i) => i > 0)
        .map((s, i) => {
            const prev = snapshots[i];
            const dt = s.elapsed - prev.elapsed;
            return dt > 0 ? ((s.completed - prev.completed) / dt) * 60 : 0;
        })
        .sort((a, b) => a - b);

    const p95rate = rates[Math.floor(rates.length * 0.95)]?.toFixed(0) ?? jobsPerMin;

    console.log(`\n`);
    console.log(`╔══════════════════════════════════════════════╗`);
    console.log(`║           BENCHMARK FINAL REPORT             ║`);
    console.log(`╠══════════════════════════════════════════════╣`);
    console.log(`║  Total time      : ${String(totalElapsed.toFixed(2) + 's').padEnd(26)}║`);
    console.log(`║  Completed       : ${String(last.completed).padEnd(26)}║`);
    console.log(`║  Retrying        : ${String(last.retrying).padEnd(26)}║`);
    console.log(`║  Failed (DLQ)    : ${String(last.failed).padEnd(26)}║`);
    console.log(`║  Throughput      : ${String(jobsPerMin + ' jobs/min').padEnd(26)}║`);
    console.log(`║  Success rate    : ${String(successRate + '%').padEnd(26)}║`);
    console.log(`╚══════════════════════════════════════════════╝`);
}

async function main() {
    console.log(`Starting monitor — run k6 in another terminal now\n`);

    const startTime = Date.now();
    let lastCompleted = 0;
    let lastProgressTime = Date.now();
    const snapshots = [];

    process.on('SIGINT', () => {
        printReport(snapshots, startTime);
        process.exit(0);
    });

    while (true) {
        await sleep(CONFIG.pollIntervalMs);

        const stats = await httpGet(`${CONFIG.appUrl}/dashboard/stats`).catch(() => null);
        if (!stats) continue;

        const elapsed = (Date.now() - startTime) / 1000;
        snapshots.push({ elapsed, ...stats.jobs, ...stats.queues });
        printStats(stats, elapsed);

        // track progress
        if (stats.jobs.completed > lastCompleted) {
            lastCompleted = stats.jobs.completed;
            lastProgressTime = Date.now();
        }

        // auto-stop when queue is empty and nothing processing
        const done =
            stats.queues.high === 0 &&
            stats.queues.default === 0 &&
            stats.jobs.processing === 0 &&
            stats.jobs.completed > 0;

        if (done) {
            printReport(snapshots, startTime);
            process.exit(0);
        }

        // idle timeout
        if (Date.now() - lastProgressTime > CONFIG.idleThresholdMs) {
            console.log(`\nNo progress for ${CONFIG.idleThresholdMs / 1000}s — stopping.`);
            printReport(snapshots, startTime);
            process.exit(0);
        }
    }
}

main().catch(console.error);