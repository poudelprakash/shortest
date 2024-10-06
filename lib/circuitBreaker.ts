// lib/circuitBreaker.ts

export class CircuitBreaker {
    private failureCount = 0;
    private maxFailures: number;
    private retryAttempts: number;
    private timeout: number;
    private lastFailureTime: number | null = null;
  
    constructor(maxFailures = 5, retryAttempts = 3, timeout = 30000) {
      this.maxFailures = maxFailures;
      this.retryAttempts = retryAttempts;
      this.timeout = timeout;
    }
  
    async execute(fn: Function): Promise<any> {
      if (this.failureCount >= this.maxFailures && Date.now() - (this.lastFailureTime || 0) < this.timeout) {
        throw new Error('Circuit breaker is open, try again later');
      }
  
      return this.withRetries(fn);
    }
  
    private async withRetries(fn: Function) {
      let attempts = 0;
  
      while (attempts < this.retryAttempts) {
        try {
          const result = await fn();
          this.reset();
          return result;
        } catch (error) {
          attempts++;
          if (attempts >= this.retryAttempts) {
            this.recordFailure();
            throw new Error(`Failed after ${this.retryAttempts} retry attempts`);
          } else {
            await this.delay(attempts);
          }
        }
      }
    }
  
    private recordFailure() {
      this.failureCount++;
      this.lastFailureTime = Date.now();
    }
  
    private reset() {
      this.failureCount = 0;
      this.lastFailureTime = null;
    }
  
    private delay(attempt: number) {
      return new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  