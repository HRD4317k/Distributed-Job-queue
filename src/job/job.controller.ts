import { Body, Controller, Post } from "@nestjs/common";
import { EnqueueJobDto } from "./dto/enqueue-job.dto";
import { JobProducerService } from "./job.producer";

@Controller('jobs')
export class JobController {
    constructor(private readonly producer: JobProducerService) { }

    @Post()
    async enqueue(@Body() dto: EnqueueJobDto) {
        try {
            const data = await this.producer.enqueue(dto);
            return {
                jobId: data.id,
                status: data.status
            }
        } catch (error) {
            console.error('Something went wrong: ', error);
            throw error;
        }
    }
}