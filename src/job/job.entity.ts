import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('jobs')
export class Job {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    type: string; // e.g. "SEND_PAYMENT_SMS"

    @Column({ type: 'jsonb' })
    payload: Record<string, any>;

    @Column()
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'RETRYING' | 'FAILED';

    @Column({ default: 'default' })
    priority: 'high' | 'default';

    @Column({ default: 0 })
    attempts: number;

    @Column({ default: 3 })
    maxRetries: number;

    @Column({ default: 300000 })
    timeoutMs: number;

    @Column({ nullable: true, type: 'text' })
    lastError?: string;

    @Column({ nullable: true })
    workerId?: string;

    @Column({ type: 'timestamp', nullable: true })
    completedAt?: Date;

    @Column({ nullable: true })
    durationMs?: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}