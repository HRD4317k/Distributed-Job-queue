import { Injectable } from "@nestjs/common";
import { JobHandler } from "./job-handler.interface";

@Injectable()
export class HandlerRegistry {
    private handlers = new Map<string, JobHandler>();

    register(type: string, handler: JobHandler): void {
        this.handlers.set(type, handler);
    }

    get(type: string): JobHandler | undefined {
        return this.handlers.get(type);
    }
}
