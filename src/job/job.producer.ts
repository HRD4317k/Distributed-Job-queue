import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Job } from './job.entity';
import { EnqueueJobDto } from './dto/enqueue-job.dto';
import { RedisService } from 'src/redis/redis.service';
import Redis from 'ioredis';

@Injectable()
export class JobProducerService {
    private readonly logger = new Logger(JobProducerService.name);
    constructor(
        @InjectRepository(Job)
        private readonly jobRepo: Repository<Job>,
        private readonly redis: RedisService,
    ) {
    }

    async enqueue(jobData: EnqueueJobDto): Promise<Job> {
        const id = uuidv4();
        const queue = jobData.priority === 'high' ? 'queue:high' : 'queue:default';
        const score = jobData.priority === 'high' ? Date.now() - 1_000_000 : Date.now();

        const job = await this.jobRepo.save({
            id: id,
            type: jobData.type,
            payload: jobData.payload,
            status: 'PENDING',
            priority: jobData.priority,
            maxRetries: jobData.maxRetries,
            timeoutMs: jobData.timeoutMs
        })

        await this.redis.hset(`job:${id}`, {
            id,
            type: jobData.type,
            payload: JSON.stringify(jobData.payload),
            status: 'PENDING',
            attempts: '0',
            maxRetries: String(jobData.maxRetries ?? 3),
            timeoutMs: String(jobData.timeoutMs ?? 300_000),
            queue,
        });

        await this.redis.zadd(queue, score, id);

        return job;
    }
}