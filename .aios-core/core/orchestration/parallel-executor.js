/**
 * Parallel Executor - Executes multiple phases concurrently
 *
 * Handles parallel execution of workflow phases that don't have
 * dependencies on each other (e.g., phases 1-3 in brownfield discovery).
 *
 * @module core/orchestration/parallel-executor
 * @version 1.0.0
 */

const chalk = require('chalk');

/**
 * Manages parallel execution of workflow phases
 */
class ParallelExecutor {
  constructor() {
    this.maxConcurrency = 3; // Default max parallel executions
    this.runningTasks = new Map();
  }

  /**
   * Execute multiple phases in parallel
   * @param {Array<Object>} phases - Phases to execute
   * @param {Function} executePhase - Function to execute a single phase
   * @param {Object} options - Execution options
   * @returns {Promise<Object[]>} Results from all phases
   */
  async executeParallel(phases, executePhase, options = {}) {
    const maxConcurrency = this._normalizeConcurrency(options.maxConcurrency);
    const results = [];
    const errors = [];

    console.log(chalk.yellow(`\n⚡ Executing ${phases.length} phases in parallel (max ${maxConcurrency} concurrent)`));

    const tasks = phases.map((phase) => async () => {
      const phaseId = phase.phase || phase.step;
      const startTime = Date.now();
      this.runningTasks.set(phaseId, { status: 'running', startTime });

      try {
        const result = await executePhase(phase);
        this.runningTasks.set(phaseId, {
          status: 'completed',
          startTime,
          endTime: Date.now(),
          result,
        });
        return { phase: phaseId, status: 'fulfilled', result };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        this.runningTasks.set(phaseId, {
          status: 'failed',
          startTime,
          endTime: Date.now(),
          error: errorMessage,
        });
        return { phase: phaseId, status: 'rejected', error: errorMessage };
      }
    });

    // Execute with concurrency limit
    const settled = await this._executeWithConcurrencyLimit(tasks, maxConcurrency);

    // Process results
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.result);
      } else {
        errors.push(result.error);
        console.log(chalk.red(`   ❌ Phase ${result.phase} failed: ${result.error}`));
      }
    }

    // Summary
    const successCount = results.length;
    const failCount = errors.length;
    console.log(chalk.gray(`   Completed: ${successCount} success, ${failCount} failed`));

    return {
      results,
      errors,
      summary: {
        total: phases.length,
        success: successCount,
        failed: failCount,
      },
    };
  }

  /**
   * Execute promises with concurrency limit
   * @private
   */
  async _executeWithConcurrencyLimit(tasks, limit) {
    const normalizedLimit = this._normalizeConcurrency(limit);
    const results = new Array(tasks.length);
    let nextIndex = 0;

    const workers = Array.from(
      { length: Math.min(normalizedLimit, tasks.length) },
      async () => {
        while (nextIndex < tasks.length) {
          const currentIndex = nextIndex++;
          results[currentIndex] = await tasks[currentIndex]();
        }
      },
    );

    await Promise.all(workers);
    return results;
  }

  /**
   * Get status of running tasks
   * @returns {Object} Map of task statuses
   */
  getStatus() {
    const status = {};
    for (const [id, taskStatus] of this.runningTasks) {
      status[id] = { ...taskStatus };
      if (Number.isFinite(taskStatus.startTime) && Number.isFinite(taskStatus.endTime)) {
        status[id].duration = taskStatus.endTime - taskStatus.startTime;
      }
    }
    return status;
  }

  /**
   * Check if any tasks are still running
   * @returns {boolean} True if tasks are running
   */
  hasRunningTasks() {
    for (const [, status] of this.runningTasks) {
      if (status.status === 'running') {
        return true;
      }
    }
    return false;
  }

  /**
   * Wait for all running tasks to complete
   * @param {number} timeout - Maximum wait time in ms
   * @returns {Promise<void>}
   */
  async waitForCompletion(timeout = 300000) {
    const startTime = Date.now();

    while (this.hasRunningTasks()) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for parallel tasks to complete');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Cancel all running tasks
   * Note: This marks tasks as cancelled but cannot truly cancel async operations
   */
  cancelAll() {
    for (const [id, status] of this.runningTasks) {
      if (status.status === 'running') {
        this.runningTasks.set(id, {
          ...status,
          status: 'cancelled',
          cancelledAt: Date.now(),
        });
      }
    }
  }

  /**
   * Clear task history
   */
  clear() {
    this.runningTasks.clear();
  }

  /**
   * Set maximum concurrency
   * @param {number} max - Maximum concurrent executions
   */
  setMaxConcurrency(max) {
    this.maxConcurrency = this._normalizeConcurrency(max);
  }

  /**
   * Get execution summary
   * @returns {Object} Summary statistics
   */
  getSummary() {
    let completed = 0;
    let failed = 0;
    let running = 0;
    let totalDuration = 0;

    for (const [, status] of this.runningTasks) {
      switch (status.status) {
        case 'completed':
          completed++;
          if (Number.isFinite(status.startTime) && Number.isFinite(status.endTime)) {
            totalDuration += status.endTime - status.startTime;
          }
          break;
        case 'failed':
          failed++;
          break;
        case 'running':
          running++;
          break;
      }
    }

    return {
      total: this.runningTasks.size,
      completed,
      failed,
      running,
      averageDuration: completed > 0 ? Math.round(totalDuration / completed) : 0,
    };
  }

  /**
   * Normalize concurrency values to supported bounds
   * @private
   * @param {number} limit - Requested concurrency limit
   * @returns {number} Safe concurrency value
   */
  _normalizeConcurrency(limit) {
    const candidate = Number.isFinite(limit) ? Math.floor(limit) : this.maxConcurrency;
    return Math.max(1, Math.min(10, candidate));
  }
}

module.exports = ParallelExecutor;
