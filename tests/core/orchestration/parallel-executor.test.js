'use strict';

const ParallelExecutor = require('../../../.aios-core/core/orchestration/parallel-executor');

function createDeferred() {
  let resolve;
  let reject;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

async function waitFor(check, timeoutMs = 200) {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('ParallelExecutor', () => {
  let executor;
  let consoleSpy;

  beforeEach(() => {
    executor = new ParallelExecutor();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('executeParallel', () => {
    it('should execute phases successfully and return a success summary', async () => {
      const phases = [{ phase: 1 }, { phase: 2 }];
      const executePhase = jest
        .fn()
        .mockResolvedValueOnce('phase-1-result')
        .mockResolvedValueOnce('phase-2-result');

      const result = await executor.executeParallel(phases, executePhase);

      expect(executePhase).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        results: ['phase-1-result', 'phase-2-result'],
        errors: [],
        summary: {
          total: 2,
          success: 2,
          failed: 0,
        },
      });
      expect(executor.getStatus()).toEqual({
        1: expect.objectContaining({
          status: 'completed',
          result: 'phase-1-result',
          duration: expect.any(Number),
        }),
        2: expect.objectContaining({
          status: 'completed',
          result: 'phase-2-result',
          duration: expect.any(Number),
        }),
      });
    });

    it('should collect phase failures without treating them as successes', async () => {
      const phases = [{ phase: 1 }, { phase: 2 }];
      const executePhase = jest.fn(async (phase) => {
        if (phase.phase === 2) {
          throw new Error('phase-2-failed');
        }

        return 'phase-1-result';
      });

      const result = await executor.executeParallel(phases, executePhase);

      expect(result).toEqual({
        results: ['phase-1-result'],
        errors: ['phase-2-failed'],
        summary: {
          total: 2,
          success: 1,
          failed: 1,
        },
      });
      expect(executor.getStatus()).toEqual({
        1: expect.objectContaining({
          status: 'completed',
          result: 'phase-1-result',
          duration: expect.any(Number),
        }),
        2: expect.objectContaining({
          status: 'failed',
          error: 'phase-2-failed',
          duration: expect.any(Number),
        }),
      });
    });

    it('should respect the configured concurrency limit', async () => {
      const deferreds = [
        createDeferred(),
        createDeferred(),
        createDeferred(),
        createDeferred(),
      ];
      const activePhases = new Set();
      const startedPhases = [];
      let peakConcurrency = 0;

      const executionPromise = executor.executeParallel(
        [{ phase: 1 }, { phase: 2 }, { phase: 3 }, { phase: 4 }],
        (phase) => {
          const deferred = deferreds[phase.phase - 1];

          startedPhases.push(phase.phase);
          activePhases.add(phase.phase);
          peakConcurrency = Math.max(peakConcurrency, activePhases.size);

          return deferred.promise.finally(() => {
            activePhases.delete(phase.phase);
          });
        },
        { maxConcurrency: 2 },
      );

      await Promise.resolve();
      await Promise.resolve();

      expect(startedPhases).toEqual([1, 2]);
      expect(peakConcurrency).toBe(2);

      deferreds[0].resolve('phase-1-result');
      await waitFor(() => startedPhases.length === 3);
      expect(startedPhases).toEqual([1, 2, 3]);
      expect(peakConcurrency).toBe(2);

      deferreds[1].resolve('phase-2-result');
      await waitFor(() => startedPhases.length === 4);
      expect(startedPhases).toEqual([1, 2, 3, 4]);
      expect(peakConcurrency).toBe(2);

      deferreds[2].resolve('phase-3-result');
      deferreds[3].resolve('phase-4-result');

      await expect(executionPromise).resolves.toEqual({
        results: [
          'phase-1-result',
          'phase-2-result',
          'phase-3-result',
          'phase-4-result',
        ],
        errors: [],
        summary: {
          total: 4,
          success: 4,
          failed: 0,
        },
      });
      expect(peakConcurrency).toBe(2);
    });

    it('should use the instance concurrency when options are not provided', async () => {
      executor.setMaxConcurrency(1);

      const deferreds = [createDeferred(), createDeferred()];
      const startedPhases = [];

      const executionPromise = executor.executeParallel(
        [{ phase: 1 }, { phase: 2 }],
        (phase) => {
          startedPhases.push(phase.phase);
          return deferreds[phase.phase - 1].promise;
        },
      );

      await Promise.resolve();
      await Promise.resolve();

      expect(startedPhases).toEqual([1]);

      deferreds[0].resolve('phase-1-result');
      await Promise.resolve();
      await Promise.resolve();

      expect(startedPhases).toEqual([1, 2]);

      deferreds[1].resolve('phase-2-result');
      await executionPromise;
    });
  });

  describe('getStatus', () => {
    it('should return a cloned snapshot of task state with durations', () => {
      executor.runningTasks.set('phase-1', {
        status: 'completed',
        startTime: 100,
        endTime: 175,
        result: 'done',
      });

      const status = executor.getStatus();
      expect(status).toEqual({
        'phase-1': {
          status: 'completed',
          startTime: 100,
          endTime: 175,
          result: 'done',
          duration: 75,
        },
      });

      status['phase-1'].status = 'mutated';

      expect(executor.runningTasks.get('phase-1').status).toBe('completed');
    });
  });

  describe('hasRunningTasks', () => {
    it('should report whether any task is still running', async () => {
      const deferred = createDeferred();
      const executionPromise = executor.executeParallel(
        [{ phase: 1 }],
        () => deferred.promise,
        { maxConcurrency: 1 },
      );

      await Promise.resolve();
      await Promise.resolve();

      expect(executor.hasRunningTasks()).toBe(true);

      deferred.resolve('done');
      await executionPromise;

      expect(executor.hasRunningTasks()).toBe(false);
    });
  });

  describe('waitForCompletion', () => {
    it('should resolve once running tasks are completed', async () => {
      executor.runningTasks.set('phase-1', {
        status: 'running',
        startTime: Date.now(),
      });

      const waitPromise = executor.waitForCompletion(500);

      setTimeout(() => {
        executor.runningTasks.set('phase-1', {
          status: 'completed',
          startTime: Date.now() - 10,
          endTime: Date.now(),
          result: 'done',
        });
      }, 20);

      await expect(waitPromise).resolves.toBeUndefined();
    });

    it('should reject when tasks never finish before the timeout', async () => {
      executor.runningTasks.set('phase-1', {
        status: 'running',
        startTime: Date.now(),
      });

      await expect(executor.waitForCompletion(10)).rejects.toThrow(
        'Timeout waiting for parallel tasks to complete',
      );
    });
  });

  describe('cancelAll', () => {
    it('should cancel only tasks that are still running', () => {
      executor.runningTasks.set('phase-1', {
        status: 'running',
        startTime: 100,
      });
      executor.runningTasks.set('phase-2', {
        status: 'completed',
        startTime: 100,
        endTime: 200,
      });

      executor.cancelAll();

      expect(executor.getStatus()).toEqual({
        'phase-1': expect.objectContaining({
          status: 'cancelled',
          startTime: 100,
          cancelledAt: expect.any(Number),
        }),
        'phase-2': expect.objectContaining({
          status: 'completed',
          startTime: 100,
          endTime: 200,
          duration: 100,
        }),
      });
    });
  });

  describe('clear', () => {
    it('should remove all tracked tasks', () => {
      executor.runningTasks.set('phase-1', { status: 'completed' });
      executor.runningTasks.set('phase-2', { status: 'failed' });

      executor.clear();

      expect(executor.runningTasks.size).toBe(0);
      expect(executor.getStatus()).toEqual({});
    });
  });

  describe('setMaxConcurrency', () => {
    it('should clamp concurrency between 1 and 10', () => {
      executor.setMaxConcurrency(0);
      expect(executor.maxConcurrency).toBe(1);

      executor.setMaxConcurrency(25);
      expect(executor.maxConcurrency).toBe(10);

      executor.setMaxConcurrency(4);
      expect(executor.maxConcurrency).toBe(4);
    });
  });

  describe('getSummary', () => {
    it('should summarize completed, failed, and running tasks', () => {
      executor.runningTasks.set('phase-1', {
        status: 'completed',
        startTime: 100,
        endTime: 160,
      });
      executor.runningTasks.set('phase-2', {
        status: 'completed',
        startTime: 200,
        endTime: 300,
      });
      executor.runningTasks.set('phase-3', {
        status: 'failed',
        startTime: 400,
        endTime: 450,
        error: 'boom',
      });
      executor.runningTasks.set('phase-4', {
        status: 'running',
        startTime: 500,
      });
      executor.runningTasks.set('phase-5', {
        status: 'cancelled',
        startTime: 600,
        cancelledAt: 650,
      });

      expect(executor.getSummary()).toEqual({
        total: 5,
        completed: 2,
        failed: 1,
        running: 1,
        averageDuration: 80,
      });
    });
  });
});
