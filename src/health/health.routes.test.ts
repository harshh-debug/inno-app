import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";

function createPrismaStub(isReady: boolean) {
  return {
    $queryRaw: isReady
      ? vi.fn().mockResolvedValue([{ "?column?": 1 }])
      : vi.fn().mockRejectedValue(new Error("database unavailable")),
  };
}

function createResponseStub() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };

  response.status.mockReturnValue(response);
  return response;
}

function createController(isReady: boolean): HealthController {
  return new HealthController(new HealthService(createPrismaStub(isReady) as never));
}

describe("health endpoints", () => {
  it("returns a liveness response without querying the database", async () => {
    const prisma = createPrismaStub(true);
    const controller = new HealthController(new HealthService(prisma as never));
    const response = createResponseStub();

    controller.health({} as Request, response as unknown as Response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ status: "ok" });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("returns ready when PostgreSQL is reachable", async () => {
    const controller = createController(true);
    const response = createResponseStub();

    await controller.ready({} as Request, response as unknown as Response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ status: "ready", database: "up" });
  });

  it("returns not ready when PostgreSQL is unreachable", async () => {
    const controller = createController(false);
    const response = createResponseStub();

    await controller.ready({} as Request, response as unknown as Response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({ status: "not_ready", database: "down" });
  });
});
