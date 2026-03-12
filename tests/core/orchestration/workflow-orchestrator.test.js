'use strict';

const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const mockBuildPrompt = jest.fn();
const mockUpdateMetadata = jest.fn();
const mockGetContextForPhase = jest.fn();
const mockSavePhaseOutput = jest.fn();
const mockGetPreviousPhaseOutputs = jest.fn();
const mockChecklistRun = jest.fn();
const mockDetect = jest.fn();
const mockShouldExecutePhase = jest.fn();
const mockGetSkipExplanation = jest.fn();
const mockBuildDispatchPayload = jest.fn();
const mockParseSkillOutput = jest.fn();
const mockFormatDispatchLog = jest.fn();
const mockCreateSkipResult = jest.fn();

jest.mock('../../../.aios-core/core/orchestration/subagent-prompt-builder', () =>
  jest.fn().mockImplementation(() => ({
    buildPrompt: mockBuildPrompt,
  })),
);

jest.mock('../../../.aios-core/core/orchestration/context-manager', () =>
  jest.fn().mockImplementation(() => ({
    updateMetadata: mockUpdateMetadata,
    getContextForPhase: mockGetContextForPhase,
    savePhaseOutput: mockSavePhaseOutput,
    getPreviousPhaseOutputs: mockGetPreviousPhaseOutputs,
  })),
);

jest.mock('../../../.aios-core/core/orchestration/checklist-runner', () =>
  jest.fn().mockImplementation(() => ({
    run: mockChecklistRun,
  })),
);

jest.mock('../../../.aios-core/core/orchestration/parallel-executor', () =>
  jest.fn().mockImplementation(() => ({})),
);

jest.mock('../../../.aios-core/core/orchestration/tech-stack-detector', () =>
  jest.fn().mockImplementation(() => ({
    detect: mockDetect,
  })),
);

jest.mock('../../../.aios-core/core/orchestration/condition-evaluator', () =>
  jest.fn().mockImplementation(() => ({
    shouldExecutePhase: mockShouldExecutePhase,
    getSkipExplanation: mockGetSkipExplanation,
  })),
);

jest.mock('../../../.aios-core/core/orchestration/skill-dispatcher', () =>
  jest.fn().mockImplementation(() => ({
    buildDispatchPayload: mockBuildDispatchPayload,
    parseSkillOutput: mockParseSkillOutput,
    formatDispatchLog: mockFormatDispatchLog,
    createSkipResult: mockCreateSkipResult,
  })),
);

const WorkflowOrchestrator = require('../../../.aios-core/core/orchestration/workflow-orchestrator');

describe('WorkflowOrchestrator', () => {
  let tempDir;
  let workflowPath;
  let mockPhaseOutputs;

  const techStackProfile = {
    hasDatabase: false,
    hasFrontend: true,
    hasBackend: true,
    hasTypeScript: true,
    hasTests: true,
    database: { type: null },
    frontend: { framework: 'react' },
    backend: { type: 'node' },
    applicablePhases: [1, 2, 3],
    confidence: 90,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-orchestrator-'));
    workflowPath = path.join(tempDir, 'workflow.yaml');
    mockPhaseOutputs = {};

    mockBuildPrompt.mockResolvedValue('full prompt');
    mockUpdateMetadata.mockResolvedValue(undefined);
    mockGetContextForPhase.mockResolvedValue({
      workflowId: 'test-workflow',
      currentPhase: 1,
      previousPhases: {},
      metadata: { source: 'test' },
    });
    mockSavePhaseOutput.mockImplementation(async (phaseNum, output) => {
      mockPhaseOutputs[phaseNum] = {
        ...output,
        completedAt: '2026-02-01T00:00:00.000Z',
      };
    });
    mockGetPreviousPhaseOutputs.mockImplementation(() => mockPhaseOutputs);
    mockChecklistRun.mockResolvedValue({
      passed: true,
      items: [{ description: 'Checklist item', passed: true }],
    });
    mockDetect.mockResolvedValue(techStackProfile);
    mockShouldExecutePhase.mockReturnValue({
      shouldExecute: true,
      reason: 'condition_met',
    });
    mockGetSkipExplanation.mockReturnValue('All conditions met');
    mockBuildDispatchPayload.mockImplementation(({ agentId, prompt, context, phase }) => ({
      skill: `AIOS:agents:${agentId}`,
      args: `--phase=${phase.phase}`,
      context: {
        workflowId: context.workflowId,
        prompt,
      },
    }));
    mockParseSkillOutput.mockImplementation((result) => result);
    mockFormatDispatchLog.mockReturnValue('AIOS:agents:dev');
    mockCreateSkipResult.mockImplementation((phase, reason) => ({
      status: 'skipped',
      phase: phase.phase,
      reason,
    }));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  async function writeWorkflow(workflow) {
    await fs.writeFile(workflowPath, JSON.stringify(workflow, null, 2), 'utf8');
  }

  describe('happy path execution', () => {
    it('should dispatch a phase, validate outputs, persist context, and return summary', async () => {
      const phaseOutputPath = 'docs/reports/phase-1.md';

      await writeWorkflow({
        workflow: { id: 'test-workflow', name: 'Test Workflow' },
        sequence: [
          {
            phase: 1,
            phase_name: 'Discovery',
            agent: 'dev',
            action: 'develop',
            task: 'develop-story',
            creates: phaseOutputPath,
          },
        ],
        orchestration: {},
      });

      const dispatchSubagent = jest.fn(async () => {
        await fs.writeFile(path.join(tempDir, phaseOutputPath), '# output', 'utf8');
        return {
          status: 'success',
          summary: 'Phase completed',
        };
      });

      const onPhaseStart = jest.fn();
      const onPhaseComplete = jest.fn();
      const orchestrator = new WorkflowOrchestrator(workflowPath, {
        projectRoot: tempDir,
        dispatchSubagent,
        onPhaseStart,
        onPhaseComplete,
      });

      const result = await orchestrator.execute();

      expect(dispatchSubagent).toHaveBeenCalledWith(
        expect.objectContaining({
          skill: 'AIOS:agents:dev',
          agentId: 'dev',
          prompt: 'full prompt',
          phase: expect.objectContaining({ phase: 1 }),
        }),
      );
      expect(mockBuildPrompt).toHaveBeenCalledWith(
        'dev',
        'develop-story',
        expect.objectContaining({
          phase: expect.objectContaining({ phase: 1 }),
          creates: phaseOutputPath,
          yoloMode: false,
        }),
      );
      expect(mockParseSkillOutput).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' }),
        expect.objectContaining({ phase: 1 }),
      );
      expect(mockSavePhaseOutput).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          agent: 'dev',
          action: 'develop',
          task: 'develop-story',
          result: expect.objectContaining({ status: 'success' }),
          validation: expect.objectContaining({ passed: true }),
        }),
      );
      expect(onPhaseStart).toHaveBeenCalledWith(expect.objectContaining({ phase: 1 }));
      expect(onPhaseComplete).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 1 }),
        expect.objectContaining({ status: 'success' }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          workflow: 'test-workflow',
          status: 'completed',
          phases: expect.objectContaining({
            total: 1,
            completed: 1,
            failed: 0,
            skipped: 0,
          }),
          completedPhases: [1],
          outputs: expect.objectContaining({
            1: expect.objectContaining({
              result: expect.objectContaining({ status: 'success' }),
              validation: expect.objectContaining({ passed: true }),
            }),
          }),
        }),
      );
    });
  });

  describe('skip behavior', () => {
    it('should skip a phase when condition evaluation fails and persist the skip reason', async () => {
      const orchestrator = new WorkflowOrchestrator(workflowPath, {
        projectRoot: tempDir,
      });

      orchestrator.contextManager = {
        savePhaseOutput: mockSavePhaseOutput,
      };
      orchestrator.conditionEvaluator = {
        shouldExecutePhase: jest.fn().mockReturnValue({
          shouldExecute: false,
          reason: 'condition_not_met:project_has_database',
        }),
        getSkipExplanation: jest.fn().mockReturnValue('No database detected in project'),
      };

      const result = await orchestrator._executeSinglePhase({
        phase: 2,
        phase_name: 'Database Review',
        agent: 'qa',
        condition: 'project_has_database',
      });

      expect(mockCreateSkipResult).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 2 }),
        'condition_not_met:project_has_database',
      );
      expect(mockSavePhaseOutput).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          status: 'skipped',
          phase: 2,
          reason: 'condition_not_met:project_has_database',
        }),
      );
      expect(orchestrator.executionState.skippedPhases).toEqual([2]);
      expect(result).toEqual({
        skipped: true,
        phase: 2,
        reason: 'condition_not_met:project_has_database',
      });
    });

    it('should skip a phase with missing dependencies outside YOLO mode', async () => {
      const onPhaseStart = jest.fn();
      const orchestrator = new WorkflowOrchestrator(workflowPath, {
        projectRoot: tempDir,
        yolo: false,
        onPhaseStart,
      });

      orchestrator.contextManager = {
        savePhaseOutput: mockSavePhaseOutput,
      };

      const result = await orchestrator._executeSinglePhase({
        phase: 3,
        phase_name: 'Implementation',
        agent: 'dev',
        requires: ['docs/stories/story.md'],
      });

      expect(result).toEqual({
        skipped: true,
        phase: 3,
        reason: 'missing_dependencies',
      });
      expect(orchestrator.executionState.skippedPhases).toEqual([3]);
      expect(onPhaseStart).not.toHaveBeenCalled();
      expect(mockBuildPrompt).not.toHaveBeenCalled();
      expect(mockSavePhaseOutput).not.toHaveBeenCalled();
    });
  });

  describe('dispatch fallback', () => {
    it('should return a pending dispatch result when dispatchSubagent is not provided', async () => {
      const orchestrator = new WorkflowOrchestrator(workflowPath, {
        projectRoot: tempDir,
      });

      orchestrator.contextManager = {
        getContextForPhase: mockGetContextForPhase,
        savePhaseOutput: mockSavePhaseOutput,
      };
      orchestrator.workflow = {
        workflow: { id: 'test-workflow' },
      };
      orchestrator.techStackProfile = techStackProfile;

      const result = await orchestrator._executeSinglePhase({
        phase: 1,
        phase_name: 'Discovery',
        agent: 'dev',
        action: 'develop',
        task: 'develop-story',
      });

      expect(result).toEqual(
        expect.objectContaining({
          status: 'pending_dispatch',
          prompt: 'full prompt',
          skill: 'AIOS:agents:dev',
          message: 'Subagent dispatch function not provided',
          validation: expect.objectContaining({ passed: true }),
        }),
      );
      expect(mockParseSkillOutput).not.toHaveBeenCalled();
      expect(mockSavePhaseOutput).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          result: expect.objectContaining({
            status: 'pending_dispatch',
            skill: 'AIOS:agents:dev',
          }),
        }),
      );
    });
  });

  describe('validation and summary', () => {
    it('should validate created files, execute the checklist, and expose outputs in the summary', async () => {
      const outputPath = 'docs/reports/validated.md';
      await fs.ensureDir(path.join(tempDir, 'docs/reports'));
      await fs.writeFile(path.join(tempDir, outputPath), 'validated', 'utf8');

      const orchestrator = new WorkflowOrchestrator(workflowPath, {
        projectRoot: tempDir,
      });

      orchestrator._currentChecklist = 'phase-checklist';
      orchestrator.contextManager = {
        getPreviousPhaseOutputs: jest.fn().mockReturnValue({
          1: { result: { status: 'success' } },
        }),
      };
      orchestrator.workflow = {
        workflow: { id: 'summary-workflow' },
        sequence: [{ phase: 1 }, { phase: 2 }],
      };
      orchestrator.executionState = {
        startTime: Date.now() - 65000,
        currentPhase: 1,
        completedPhases: [1],
        failedPhases: [2],
        skippedPhases: [],
      };

      const validation = await orchestrator.validatePhaseOutput(
        {
          phase: 1,
          creates: outputPath,
        },
        { status: 'success' },
      );
      const summary = orchestrator._generateExecutionSummary();

      expect(validation).toEqual(
        expect.objectContaining({
          passed: true,
          checks: expect.arrayContaining([
            expect.objectContaining({
              type: 'file_exists',
              path: outputPath,
              passed: true,
            }),
            expect.objectContaining({
              type: 'checklist',
              checklist: 'phase-checklist',
              passed: true,
            }),
          ]),
        }),
      );
      expect(mockChecklistRun).toHaveBeenCalledWith('phase-checklist', outputPath);
      expect(summary).toEqual(
        expect.objectContaining({
          workflow: 'summary-workflow',
          status: 'completed_with_errors',
          phases: {
            total: 2,
            completed: 1,
            failed: 1,
            skipped: 0,
          },
          failedPhases: [2],
          outputs: {
            1: { result: { status: 'success' } },
          },
        }),
      );
      expect(summary.duration).toMatch(/1m \d+s/);
    });
  });

  describe('phase grouping', () => {
    it('should group sequential and parallel phases while ignoring workflow end markers', () => {
      const orchestrator = new WorkflowOrchestrator(workflowPath, {
        projectRoot: tempDir,
      });

      const groups = orchestrator._groupPhases(
        [
          { phase: 1, phase_name: 'Start' },
          { phase: 2, phase_name: 'Frontend' },
          { phase: 3, phase_name: 'Backend' },
          { workflow_end: true },
          { phase: 4, phase_name: 'Review' },
        ],
        [2, 3],
      );

      expect(groups).toEqual([
        {
          parallel: false,
          phases: [{ phase: 1, phase_name: 'Start' }],
        },
        {
          parallel: true,
          phases: [
            { phase: 2, phase_name: 'Frontend' },
            { phase: 3, phase_name: 'Backend' },
          ],
        },
        {
          parallel: false,
          phases: [{ phase: 4, phase_name: 'Review' }],
        },
      ]);
    });

    it('should execute sequential and parallel groups through execute()', async () => {
      const phase1 = { phase: 1, phase_name: 'Start' };
      const phase2 = { phase: 2, phase_name: 'Frontend' };
      const phase3 = { phase: 3, phase_name: 'Backend' };
      const phase4 = { phase: 4, phase_name: 'Review' };

      const orchestrator = new WorkflowOrchestrator(workflowPath, {
        projectRoot: tempDir,
      });

      orchestrator.workflow = {
        workflow: { id: 'grouped-workflow', name: 'Grouped Workflow' },
        sequence: [phase1, phase2, phase3, phase4],
        orchestration: {
          parallel_phases: [2, 3],
        },
      };
      orchestrator.contextManager = {
        updateMetadata: mockUpdateMetadata,
        getPreviousPhaseOutputs: jest.fn().mockReturnValue({}),
      };

      jest.spyOn(orchestrator, 'setupDirectories').mockResolvedValue([]);
      const executeSingleSpy = jest
        .spyOn(orchestrator, '_executeSinglePhase')
        .mockResolvedValue({ status: 'success' });
      const executeParallelSpy = jest
        .spyOn(orchestrator, '_executeParallelPhases')
        .mockResolvedValue([]);

      await orchestrator.execute();

      expect(executeSingleSpy).toHaveBeenNthCalledWith(1, phase1);
      expect(executeSingleSpy).toHaveBeenNthCalledWith(2, phase4);
      expect(executeParallelSpy).toHaveBeenCalledWith([phase2, phase3]);
    });
  });
});
