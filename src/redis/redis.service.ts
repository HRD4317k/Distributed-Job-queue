import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private client!: Redis;
    private logger: Logger = new Logger(RedisService.name);
    constructor(private configService: ConfigService) { }
    private sha!: {
        pickupJob: string;
        renewLock: string;
        handleFailure: string;
    }

    async onModuleInit() {
        this.client = new Redis({
            host: this.configService.get<string>('REDIS_HOST'),
            port: this.configService.get<number>('REDIS_PORT'),
            password: this.configService.get<string>('REDIS_PASSWORD')
        })
        this.client.on('connect', () => {
            this.logger.log("Redis connected")
        })

        this.client.on('error', (error) => {
            this.logger.error('Redis error: ', error)
        })

        await this.loadLuaScripts();
    }

    getClient() {
        return this.client;
    }

    onModuleDestroy() {
        this.client.quit();
    }


    hset(key: string, data: Record<string, string>) {
        return this.client.hset(key, data);
    }


    zadd(key: string, score: number, id: string) {
        return this.client.zadd(key, score, id);
    }

    releaseLock(jobId: string) {
        return this.client.del(`lock:${jobId}`);
    }

    async queueLength(queue: string): Promise<number> {
        return this.client.zcard(queue);
    }


    /** --------------- load lua scripts ---------------- */
    private async loadLuaScripts() {
        const luaDir = path.join(process.cwd(), 'lua');

        const load = (file: string) =>
            this.client.script(
                'LOAD',
                fs.readFileSync(path.join(luaDir, file), 'utf8'),
            ) as Promise<string>;

        this.sha = {
            pickupJob: await load('pickup_job.lua'),
            renewLock: await load('renew_lock.lua'),
            handleFailure: await load('handle_failure.lua'),
        };

    }


    async pickupJob(
        queue: string,
        workerId: string,
        lockTtlSec: number,
    ): Promise<string | null> {
        const result = await this.client.evalsha(
            this.sha.pickupJob,
            1,          // number of KEYS
            queue,      // KEYS[1]
            workerId,   // ARGV[1]
            String(lockTtlSec), // ARGV[2]
        );

        return result as string | null;
    }


    async renewLock(
        jobId: string,
        workerId: string,
        ttlSec: number,
    ): Promise<boolean> {
        const result = await this.client.evalsha(
            this.sha.renewLock,
            1,
            `lock:${jobId}`, // KEYS[1]
            String(workerId),        // ARGV[1]
            String(ttlSec),          // ARGV[2]
        );

        return result === 1;
    }

    async handleFailure(
        jobId: string,
        queue: string,
        dlq: string,
        maxRetries: number,
        error: string,
    ): Promise<'retry' | 'dlq'> {
        const now = Date.now();

        const result = await this.client.evalsha(
            this.sha.handleFailure,
            3,
            jobId, // KEYS[1]
            queue, // KEYS[2]
            dlq, // KEYS[3]
            String(maxRetries), // ARGV[1]
            String(now), // ARGV[2]
            error, // ARGV[3]
        );

        return result as 'retry' | 'dlq';
    }
}
