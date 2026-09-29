import { Router, type Request } from "express";

import type { ClassService } from "../classes/class.service.js";
import { ClassGroupNotFoundError, ClassInputError } from "../classes/class.service.js";
import { getAuthUser, type AuthGuards } from "../auth/auth.middleware.js";
import {
  GroupInputError,
  GroupMembershipDuplicateError,
  GroupMembershipNotFoundError,
  GroupNameConflictError,
  GroupNoScheduledGroupTodayError,
  GroupNotFoundError,
  GroupUserNotFoundError,
  GroupUserNotStudentError,
  type GroupService,
} from "./group.service.js";
import type { Group, GroupStudent } from "./group.types.js";

export function createGroupRouter(
  guards: AuthGuards,
  groupService: GroupService,
  classService: ClassService,
): Router {
  const router = Router();
  const { requireAdmin, requireHost, requireStudent } = guards;

  router.post("/", requireAdmin, async (req, res, next) => {
    try {
      const body = asRecord(req.body);
      const group = await groupService.createGroup({
        name: typeof body.name === "string" ? body.name : "",
      });

      res.status(201).json(toPublicGroup(group));
    } catch (error: unknown) {
      if (error instanceof GroupInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error instanceof GroupNameConflictError) {
        res.status(409).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  router.get("/", async (_req, res, next) => {
    try {
      const groups = await groupService.listGroups();
      res.json(groups.map(toPublicGroup));
    } catch (error: unknown) {
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const group = await groupService.getGroup(getPathParam(req, "id"));
      if (!group) {
        res.status(404).json({ message: "Group not found" });
        return;
      }
      res.json(toPublicGroup(group));
    } catch (error: unknown) {
      if (error instanceof GroupInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  router.get("/:groupId/students", requireHost, async (req, res, next) => {
    try {
      const students = await groupService.getStudents(getPathParam(req, "groupId"));
      res.json(students.map(toPublicStudent));
    } catch (error: unknown) {
      if (error instanceof GroupInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error instanceof GroupNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  router.post("/:groupId/students", requireAdmin, async (req, res, next) => {
    try {
      const body = asRecord(req.body);
      const userId = typeof body.userId === "number" ? String(body.userId) : body.userId;

      await groupService.addStudent(getPathParam(req, "groupId"), typeof userId === "string" ? userId : "");

      res.status(201).json({ message: "Student added to group" });
    } catch (error: unknown) {
      if (error instanceof GroupInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error instanceof GroupNotFoundError || error instanceof GroupUserNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error instanceof GroupUserNotStudentError) {
        res.status(422).json({ message: error.message });
        return;
      }
      if (error instanceof GroupMembershipDuplicateError) {
        res.status(409).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  router.delete("/:groupId/students/:studentId", requireAdmin, async (req, res, next) => {
    try {
      await groupService.removeStudent(getPathParam(req, "groupId"), getPathParam(req, "studentId"));
      res.status(204).send();
    } catch (error: unknown) {
      if (error instanceof GroupInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error instanceof GroupMembershipNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  // Asociación automática al grupo del día para la alumna autenticada.
  // El userId se toma de la sesión de estudiante (requireStudent), nunca del
  // body: este endpoint no lee ni acepta ningún groupId del cliente.
  router.post("/me/today", requireStudent, async (req, res, next) => {
    try {
      const userId = getAuthUser(req)?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const group = await groupService.assignTodayGroupToStudent(userId);
      res.status(200).json({ assigned: true, group: toPublicGroup(group) });
    } catch (error: unknown) {
      if (error instanceof GroupNoScheduledGroupTodayError) {
        res.status(200).json({
          assigned: false,
          group: null,
          message: "No hay un grupo configurado para las clases de hoy.",
        });
        return;
      }
      if (error instanceof GroupUserNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error instanceof GroupUserNotStudentError) {
        res.status(422).json({ message: error.message });
        return;
      }
      if (error instanceof GroupNotFoundError) {
        res.status(503).json({ message: error.message });
        return;
      }
      if (error instanceof GroupInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  router.get("/:groupId/classes", async (req, res, next) => {
    try {
      const classes = await classService.listByGroup(getPathParam(req, "groupId"));
      res.json(classes);
    } catch (error: unknown) {
      if (error instanceof ClassInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error instanceof ClassGroupNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function getPathParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}

function toPublicGroup(group: Group) {
  return {
    id: group.id,
    name: group.name,
    createdAt: group.createdAt,
  };
}

function toPublicStudent(student: GroupStudent) {
  return {
    id: student.id,
    name: student.name,
    nickname: student.nickname,
    email: student.email,
  };
}
