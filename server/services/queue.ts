import { redisGet, redisSet, redisDel } from '../redis.js';
import { logger } from '../logger.js';

export interface Job<T = unknown> {
  id: string;
  name: string;
  data: T;
  attempts: number;
  maxAttempts: number;
  failedReason?: string;
  createdAt: number;
}

class BackgroundQueue {
  private queue: Job[] = [];
  private processing = false;

  async add<T>(name: string, data: T, maxAttempts = 3): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const job: Job<T> = {
      id: jobId,
      name,
      data,
      attempts: 0,
      maxAttempts,
      createdAt: Date.now(),
    };

    this.queue.push(job);
    logger.info(`[Queue] Added job ${jobId} (${name})`);
    
    // Trigger processing asynchronously
    this.processQueue().catch((err) => logger.error('[Queue] Error processing queue:', err));
    return jobId;
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      job.attempts++;
      try {
        logger.info(`[Queue] Processing job ${job.id} (${job.name}), attempt ${job.attempts}/${job.maxAttempts}`);
        await this.executeJob(job);
        logger.info(`[Queue] Completed job ${job.id} (${job.name}) successfully.`);
      } catch (err) {
        job.failedReason = (err as Error).message;
        logger.error(`[Queue] Job ${job.id} (${job.name}) failed on attempt ${job.attempts}:`, err);

        if (job.attempts < job.maxAttempts) {
          const delay = Math.pow(2, job.attempts) * 1000;
          logger.info(`[Queue] Retrying job ${job.id} in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          this.queue.push(job); // Re-enqueue for retry
        } else {
          logger.error(`[Queue] Job ${job.id} (${job.name}) permanently failed after ${job.maxAttempts} attempts.`);
        }
      }
    }

    this.processing = false;
  }

  private async executeJob(job: Job) {
    switch (job.name) {
      case 'generate-card':
        // Simulate heavy image generation task (Satori / Canvas)
        await new Promise((res) => setTimeout(res, 500));
        logger.info(`[Queue] Executed image card generation for data:`, job.data);
        break;
      case 'send-bulk-notifications':
        // Simulate bulk push notifications
        await new Promise((res) => setTimeout(res, 300));
        logger.info(`[Queue] Sent bulk notifications for data:`, job.data);
        break;
      case 'calculate-metrics':
        // Simulate heavy analytics aggregation
        await new Promise((res) => setTimeout(res, 200));
        logger.info(`[Queue] Calculated daily platform metrics.`);
        break;
      default:
        logger.warn(`[Queue] Unknown job type: ${job.name}`);
    }
  }

  getQueueStatus() {
    return {
      pendingJobs: this.queue.length,
      isProcessing: this.processing,
    };
  }
}

export const backgroundQueue = new BackgroundQueue();
