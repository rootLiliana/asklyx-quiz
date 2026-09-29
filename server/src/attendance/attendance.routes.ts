import { Router, type Request } from "express";

import type { AuthGuards } from "../auth/auth.middleware.js";
import {
  AttendanceClassNotFoundError,
  AttendanceGroupNotFoundError,
  AttendanceInputError,
  AttendanceStudentNotAStudentError,
  AttendanceStudentNotFoundError,
  AttendanceStudentNotInGroupError,
  type AttendanceService,
} from "./attendance.service.js";

// Las hosts pueden VER la asistencia; solo la admin puede editarla.
export function createAttendanceRouter(guards: AuthGuards, attendanceService: AttendanceService): Router {
  const router = Router();

  router.post("/classes/:classId/attendance", guards.requireAdmin, async (req, res, next) => {
    try {
      const body = asRecord(req.body);
      const studentId = typeof body.studentId === "number" ? String(body.studentId) : body.studentId;

      const record = await attendanceService.record(
        getPathParam(req, "classId"),
        typeof studentId === "string" ? studentId : "",
        body.status,
      );

      res.status(201).json(record);
    } catch (error: unknown) {
      if (error instanceof AttendanceInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error instanceof AttendanceClassNotFoundError || error instanceof AttendanceStudentNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error instanceof AttendanceStudentNotAStudentError || error instanceof AttendanceStudentNotInGroupError) {
        res.status(422).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  router.get("/classes/:classId/attendance", guards.requireHost, async (req, res, next) => {
    try {
      const roster = await attendanceService.getClassAttendance(getPathParam(req, "classId"));
      res.json(roster);
    } catch (error: unknown) {
      if (error instanceof AttendanceInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error instanceof AttendanceClassNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  // Tabla alumnos x clases del grupo (solo lectura para hosts).
  router.get("/groups/:groupId/attendance", guards.requireHost, async (req, res, next) => {
    try {
      res.json(await attendanceService.getGroupAttendance(getPathParam(req, "groupId")));
    } catch (error: unknown) {
      if (error instanceof AttendanceInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error instanceof AttendanceGroupNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  router.get("/students/:studentId/attendance", guards.requireHost, async (req, res, next) => {
    try {
      const history = await attendanceService.getStudentAttendance(getPathParam(req, "studentId"));
      res.json(history);
    } catch (error: unknown) {
      if (error instanceof AttendanceInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error instanceof AttendanceStudentNotFoundError) {
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
