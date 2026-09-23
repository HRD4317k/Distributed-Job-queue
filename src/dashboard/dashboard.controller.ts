import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from '../job/job.entity';
import { RedisService } from '../redis/redis.service';

@Controller('dashboard')
export class DashboardController {
    constructor(
        @InjectRepository(Job)
        private readonly jobRepo: Repository<Job>,
        private readonly redis: RedisService,
    ) { }

    @Get('stats')
    async getStats() {
        const [pending, processing, completed, retrying, failed] =
            await Promise.all([
                this.jobRepo.count({
                    where: { status: 'PENDING' },
                }),

                this.jobRepo.count({
                    where: { status: 'PROCESSING' },
                }),

                this.jobRepo.count({
                    where: { status: 'COMPLETED' },
                }),

                this.jobRepo.count({
                    where: { status: 'RETRYING' },
                }),

                this.jobRepo.count({
                    where: { status: 'FAILED' },
                }),
            ]);

        const [highDepth, defaultDepth, dlqDepth] = await Promise.all([
            this.redis.queueLength('queue:high'),
            this.redis.queueLength('queue:default'),
            this.redis.queueLength('queue:dlq'),
        ]);

        return {
            jobs: {
                pending,
                processing,
                completed,
                retrying,
                failed,
            },

            queues: {
                high: highDepth,
                default: defaultDepth,
                dlq: dlqDepth,
            },
        };
    }

    @Get('recent')
    async getRecent() {
        return this.jobRepo.find({
            order: {
                createdAt: 'DESC',
            },
            take: 20,
        });
    }
}