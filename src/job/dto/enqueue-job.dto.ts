export class EnqueueJobDto {
    type: string;
    payload: Record<string, any>;
    priority?: 'high' | 'default';
    maxRetries?: number;
    timeoutMs?: number;
}