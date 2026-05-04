import type { Request, Response } from "express";
import { UserService } from "../services/userService.js";

export class UserController {
  private userService = new UserService();

  getAll = async (_req: Request, res: Response) => {
    try {
      const users = await this.userService.findAll();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const user = await this.userService.findById(req.params.id!);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const user = await this.userService.create(req.body);
      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  };
}
