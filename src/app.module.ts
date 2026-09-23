import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisService } from './redis/redis.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobController } from 'src/job/job.controller';
import { JobProducerService } from 'src/job/job.producer';
import { Job } from 'src/job/job.entity';
import { WorkerService } from './worker/worker.service';
import { HandlerModule } from './handler/handler.module';
import { DashboardController } from './dashboard/dashboard.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes the module available everywhere without re-importing
      envFilePath: '.env', // Optional: defaults to .env in project root
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    TypeOrmModule.forFeature([Job]),
    HandlerModule
  ],
  controllers: [AppController, JobController, DashboardController],
  providers: [AppService, RedisService, JobProducerService, WorkerService],
})
export class AppModule { }
