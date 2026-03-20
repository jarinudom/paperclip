import { describe, expect, it, vi } from "vitest";
import { issueService } from "../services/issues.ts";

function createDbStub(selectResults: unknown[][], updateRows: unknown[][]) {
  const pendingSelects = [...selectResults];
  const pendingUpdates = [...updateRows];

  const select = vi.fn(() => {
    const result = pendingSelects.shift() ?? [];
    const query: Record<string, unknown> = {};
    query.from = vi.fn(() => query);
    query.innerJoin = vi.fn(() => query);
    query.where = vi.fn(() => query);
    query.orderBy = vi.fn(async () => result);
    query.limit = vi.fn(async () => result);
    query.then = vi.fn((resolve: (value: unknown[]) => unknown) => Promise.resolve(resolve(result)));
    return query;
  });

  const updateSet = vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn(() => {
        const rows = pendingUpdates.shift() ?? [];
        return {
          then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(resolve(rows)),
        };
      }),
    })),
  }));
  const update = vi.fn(() => ({
    set: updateSet,
  }));

  return {
    db: {
      select,
      update,
    },
    updateSet,
  };
}

describe("issueService.release", () => {
  it("clears execution lock fields when releasing an issue", async () => {
    const dbStub = createDbStub(
      [[{
        id: "issue-1",
        companyId: "company-1",
        status: "in_progress",
        assigneeAgentId: "agent-1",
        checkoutRunId: "run-1",
        executionRunId: "run-1",
      }], []],
      [[{
        id: "issue-1",
        companyId: "company-1",
        status: "todo",
        assigneeAgentId: null,
        checkoutRunId: null,
        executionRunId: null,
        executionAgentNameKey: null,
        executionLockedAt: null,
      }]],
    );

    const service = issueService(dbStub.db as any);
    const released = await service.release("issue-1", "agent-1", "run-1");

    expect(dbStub.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "todo",
        assigneeAgentId: null,
        checkoutRunId: null,
        executionRunId: null,
        executionAgentNameKey: null,
        executionLockedAt: null,
        updatedAt: expect.any(Date),
      }),
    );
    expect(released).toMatchObject({
      id: "issue-1",
      status: "todo",
      executionRunId: null,
      labelIds: [],
      labels: [],
    });
  });
});
