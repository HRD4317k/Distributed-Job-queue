import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Job } from "src/job/job.entity";
import { RedisService } from "src/redis/redis.service";
import { HandlerRegistry } from "src/handler/handler.registry";
import { Repository } from "typeorm";
import { v4 as uuidv4 } from 'uuid';


@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
    private readonly workerId = `worker-${uuidv4().slice(0, 8)}`;
    private running = false;
    private readonly queues = ['queue:high', 'queue:default'];
    private readonly logger = new Logger(WorkerService.name);


    constructor(
        private readonly redisService: RedisService,
        private readonly handlerRegistry: HandlerRegistry,
        @InjectRepository(Job)
        private readonly jobRepo: Repository<Job>,
    ) { }

    onModuleInit() {
        this.running = true;
        const concurrency = 10; // spin up 10 parallel slots

        for (let i = 0; i < concurrency; i++) {
            setTimeout(() => this.scheduleNextPoll(), i * 100);
        }
    }

    onModuleDestroy() {
        this.running = false;
    }

    private async pollOnce() {
        for (const queue of this.queues) {
            const jobId = await this.redisService.pickupJob(queue, this.workerId, 30);

            if (jobId) {
                this.logger.log(`Picked up job: ${jobId} from ${queue}`);
                this.processJob(jobId, queue);
                this.scheduleNextPoll();
                return;
            }
        }

        this.scheduleNextPoll();
    }

    private scheduleNextPoll() {
        if (!this.running) return;
        setTimeout(() => this.pollOnce(), 500);
    }

    private async processJob(jobId: string, queue: string) {

        const jobData = await this.redisService.getClient().hgetall(`job:${jobId}`);

        await this.jobRepo.update({
            id: jobId
        }, {
            status: 'PROCESSING'
        })

        const heartbeat = setInterval(async () => {
            const renewed = await this.redisService.renewLock(jobId, this.workerId, 30);
            if (!renewed) {
                this.logger.warn(`Lost lock for job ${jobId} — another worker took over`);
                clearInterval(heartbeat);
            }
        }, 10_000);

        try {

            await Promise.race([
                this.runHandler(jobData),
                this.timeoutPromise(parseInt(jobData.timeoutMs || '300_000'), jobId)
            ])
            clearInterval(heartbeat);
            await this.redisService.releaseLock(jobId)
            await this.jobRepo.update({ id: jobId }, { status: 'COMPLETED' })
            this.logger.log(`Job ${jobId} is complete`)
        } catch (error) {
            clearInterval(heartbeat);
            await this.redisService.releaseLock(jobId)

            const maxRetries = parseInt(jobData.maxRetries || '3');
            const result = await this.redisService.handleFailure(
                jobId, queue, 'queue:dlq', maxRetries, error.message
            )
            await this.jobRepo.update({ id: jobId }, {
                status: result == 'dlq' ? 'FAILED' : 'RETRYING',
                lastError: error.message
            })

            this.logger.log(`Job ${jobId} -> ${result.toUpperCase()}`)
        }
    }

    private async runHandler(jobData: Record<string, string>) {
        const payload = JSON.parse(jobData.payload);
        const handler = this.handlerRegistry.get(jobData.type);

        if (!handler) {
            throw new Error(`No handler registered for job type: ${jobData.type}`);
        }

        await handler(payload);
    }

    private timeoutPromise(ms: number, jobId: string): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Job ${jobId} exceeded timeout of ${ms}ms`));
            }, ms);
        });
    }
}