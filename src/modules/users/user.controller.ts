import type { Request, Response } from "express";
import type { PromoteUserRequest } from "./user.schemas.js";
import type { UserService } from "./user.service.js";

export class UserController {
  constructor(private readonly userService: UserService) {}

  promote = async (request: Request, response: Response): Promise<void> => {
    const { userId } = request.params as { userId: string };
    const body = request.body as PromoteUserRequest;
    const user = await this.userService.promote(userId, body);
    response.json({ data: { id: user.id, role: user.role, domain: user.domain } });
  };
}
