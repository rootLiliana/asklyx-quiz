import assert from "node:assert/strict";
import test from "node:test";

import type { ClassRepository } from "../classes/class.repository.js";
import type { ClassItem } from "../classes/class.types.js";
import type { CreateGroupInput, Group, GroupStudent, GroupMembership } from "../groups/group.types.js";
import type { GroupRepository } from "../groups/group.repository.js";
import type { QuizContent, QuizSummary } from "../quizzes/quiz-content.types.js";
import type { QuizContentRepository } from "../quizzes/quiz-content.repository.js";
import { QuizContentService } from "../quizzes/quiz-content.service.js";
import type { CreateQuizSessionInput, QuizSession } from "../quizSessions/quiz-session.types.js";
import type { QuizSessionRepository } from "../quizSessions/quiz-session.repository.js";
import { QuizSessionService } from "../quizSessions/quiz-session.service.js";
import { PlayerIdentityService } from "../users/player-identity.service.js";
import type { UserRepository } from "../users/user.repository.js";
import type { User, UserRole, UserWithPasswordHash } from "../users/user.types.js";
import { AttendanceService } from "./attendance.service.js";
import type { AttendanceRepository } from "./attendance.repository.js";
import type { AttendanceRecord, AttendanceStatus, ClassAttendanceEntry, GroupAttendanceMatrix, StudentAttendanceEntry } from "./attendance.types.js";
import { GameAttendanceService } from "./game-attendance.service.js";

const existingClass: ClassItem = {
  id: "1",
  moduleId: "1",
  groupId: "10",
  name: "Clase Prueba - Módulo 1",
  description: null,
  classDate: "2026-01-05",
  startTime: "10:00:00",
  endTime: "11:00:00",
  status: "SCHEDULED",
};

// Misma clase/tema, pero del otro grupo (otro día).
const otherGroupClass: ClassItem = { ...existingClass, id: "2", groupId: "11", classDate: "2026-01-06" };

const existingQuiz: QuizContent = {
  id: "500",
  classId: existingClass.id,
  title: "Python",
  description: null,
  timeLimitSeconds: null,
  createdBy: "1",
  questions: [],
};

const studentAna: User = {
  id: "25",
  name: "Ana",
  lastNamePaternal: "Pérez",
  lastNameMaternal: null,
  email: "ana@example.com",
  nickname: "ana",
  role: "STUDENT",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const studentMaria: User = { ...studentAna, id: "26", nickname: "maria", name: "María" };
const hostLili: User = { ...studentAna, id: "1", nickname: "lilis", role: "HOST" };
// Alumna registrada que todavía no pertenece a ningún grupo.
const studentSofia: User = { ...studentAna, id: "27", nickname: "sofia", name: "Sofía" };

class FakeClassRepository implements ClassRepository {
  async findAll(): Promise<ClassItem[]> { return [existingClass]; }
  async findById(id: string): Promise<ClassItem | null> {
    return [existingClass, otherGroupClass].find((classItem) => classItem.id === id) ?? null;
  }
  async findByGroup(): Promise<ClassItem[]> { return [existingClass]; }
}

class FakeQuizContentRepository implements QuizContentRepository {
  async create(): Promise<QuizContent> { throw new Error("not used in these tests"); }
  async findById(id: string): Promise<QuizContent | null> { return id === existingQuiz.id ? existingQuiz : null; }
  async findAll(): Promise<QuizSummary[]> { return []; }
  async update(): Promise<QuizContent | null> { throw new Error("not used in these tests"); }
  async delete(): Promise<boolean> { throw new Error("not used in these tests"); }
  async hasResults(): Promise<boolean> { return false; }
}

class FakeQuizSessionRepository implements QuizSessionRepository {
  private readonly sessionsByGameCode = new Map<string, QuizSession>();

  seed(gameCode: string, quizId: string, classItem: ClassItem | null = existingClass): void {
    this.sessionsByGameCode.set(gameCode, {
      id: "900",
      quizId,
      hostId: "1",
      classId: classItem?.id ?? null,
      groupId: classItem?.groupId ?? null,
      gameCode,
      mode: "LIVE",
      status: "WAITING",
    });
  }

  async create(input: CreateQuizSessionInput): Promise<QuizSession> {
    const session: QuizSession = { id: "900", ...input, status: "WAITING" };
    this.sessionsByGameCode.set(input.gameCode, session);
    return session;
  }

  async findByGameCode(gameCode: string): Promise<QuizSession | null> {
    return this.sessionsByGameCode.get(gameCode) ?? null;
  }

  async markStarted(): Promise<void> {}
  async markFinished(): Promise<void> {}
}

class FakeUserRepository implements UserRepository {
  private readonly usersByNickname = new Map<string, User>([
    [studentAna.nickname, studentAna],
    [studentMaria.nickname, studentMaria],
    [studentSofia.nickname, studentSofia],
    [hostLili.nickname, hostLili],
  ]);

  async create(): Promise<User> { return studentAna; }
  async findById(id: string): Promise<User | null> {
    return [studentAna, studentMaria, studentSofia, hostLili].find((user) => user.id === id) ?? null;
  }
  async findByEmail(): Promise<User | null> { return null; }
  async findByNickname(nickname: string): Promise<User | null> { return this.usersByNickname.get(nickname) ?? null; }
  async findAuthByNickname(): Promise<UserWithPasswordHash | null> { return null; }
  async updateRole(_: string, role: UserRole): Promise<User | null> { return { ...studentAna, role }; }
  async findAll(): Promise<User[]> { return [studentAna, studentMaria, hostLili]; }
}

class FakeGroupRepository implements GroupRepository {
  async findAllMemberships(): Promise<GroupMembership[]> { return []; }
  async setOnlyGroup(): Promise<void> {}
  async create(input: CreateGroupInput): Promise<Group> { return { id: "10", name: input.name, createdAt: "2026-01-01T00:00:00.000Z" }; }
  async findById(): Promise<Group | null> { return { id: existingClass.groupId, name: "Grupo 1", createdAt: "2026-01-01T00:00:00.000Z" }; }
  async findByName(): Promise<Group | null> { return null; }
  async findAll(): Promise<Group[]> { return []; }
  async findMembers(): Promise<GroupStudent[]> { return []; }
  readonly members = new Set([`${existingClass.groupId}:${studentAna.id}`, `${existingClass.groupId}:${studentMaria.id}`]);
  async hasMember(groupId: string, userId: string): Promise<boolean> {
    return this.members.has(`${groupId}:${userId}`);
  }
  async addMember(groupId: string, userId: string): Promise<void> {
    this.members.add(`${groupId}:${userId}`);
  }
  async removeMember(): Promise<boolean> { return true; }
}

class FakeAttendanceRepository implements AttendanceRepository {
  records = new Map<string, AttendanceStatus>();
  shouldFailFor: string | null = null;

  async upsert(classId: string, studentId: string, status: AttendanceStatus): Promise<AttendanceRecord> {
    if (this.shouldFailFor === studentId) {
      throw new Error("simulated database failure");
    }

    this.records.set(`${classId}:${studentId}`, status);
    return { id: "1", classId, studentId, status, checkedAt: "2026-01-01T00:00:00.000Z" };
  }

  async findRosterForClass(): Promise<ClassAttendanceEntry[]> { return []; }
  async findByStudent(): Promise<StudentAttendanceEntry[]> { return []; }
  async findMatrixForGroup(): Promise<GroupAttendanceMatrix> { return { classes: [], students: [], records: [] }; }
}

function buildServices() {
  const quizSessionRepository = new FakeQuizSessionRepository();
  const attendanceRepository = new FakeAttendanceRepository();
  const userRepository = new FakeUserRepository();
  const groupRepository = new FakeGroupRepository();
  const classRepository = new FakeClassRepository();

  const quizSessionService = new QuizSessionService(quizSessionRepository);
  const quizContentService = new QuizContentService(new FakeQuizContentRepository(), classRepository);
  const playerIdentityService = new PlayerIdentityService(userRepository);
  const attendanceService = new AttendanceService(attendanceRepository, classRepository, userRepository, groupRepository);

  const gameAttendanceService = new GameAttendanceService(
    quizSessionService,
    quizContentService,
    playerIdentityService,
    attendanceService,
  );

  return { gameAttendanceService, quizSessionRepository, attendanceRepository, groupRepository };
}

const GAME_CODE = "ANA-1234";

function player(name: string, answeredQuestions: string[] = ["q1"]) {
  return { name, answeredQuestions };
}

test("registers PRESENT for a single valid student player, using the classId resolved from game_code -> quiz_session -> quiz", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);

  await gameAttendanceService.registerAttendanceForFinishedGame(GAME_CODE, [player("ana")]);

  assert.equal(attendanceRepository.records.get(`${existingClass.id}:${studentAna.id}`), "PRESENT");
  assert.equal(attendanceRepository.records.size, 1);
});

test("registers PRESENT for two valid student players", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);

  await gameAttendanceService.registerAttendanceForFinishedGame(GAME_CODE, [player("ana"), player("maria")]);

  assert.equal(attendanceRepository.records.get(`${existingClass.id}:${studentAna.id}`), "PRESENT");
  assert.equal(attendanceRepository.records.get(`${existingClass.id}:${studentMaria.id}`), "PRESENT");
  assert.equal(attendanceRepository.records.size, 2);
});

test("an unknown nickname does not break the end of the game and the rest are still processed", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);

  await assert.doesNotReject(
    gameAttendanceService.registerAttendanceForFinishedGame(GAME_CODE, [player("no-existe"), player("ana")]),
  );

  assert.equal(attendanceRepository.records.size, 1);
  assert.equal(attendanceRepository.records.get(`${existingClass.id}:${studentAna.id}`), "PRESENT");
});

test("a HOST/ADMIN nickname does not generate attendance", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);

  await gameAttendanceService.registerAttendanceForFinishedGame(GAME_CODE, [player("lilis"), player("ana")]);

  assert.equal(attendanceRepository.records.size, 1);
  assert.equal(attendanceRepository.records.has(`${existingClass.id}:${hostLili.id}`), false);
});

test("running the registration twice does not duplicate records (idempotent, respects UNIQUE(class_id, student_id))", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);

  await gameAttendanceService.registerAttendanceForFinishedGame(GAME_CODE, [player("ana")]);
  await gameAttendanceService.registerAttendanceForFinishedGame(GAME_CODE, [player("ana")]);

  assert.equal(attendanceRepository.records.size, 1);
  assert.equal(attendanceRepository.records.get(`${existingClass.id}:${studentAna.id}`), "PRESENT");
});

test("with no players, the game finishes normally: it is not an error", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);

  await assert.doesNotReject(gameAttendanceService.registerAttendanceForFinishedGame(GAME_CODE, []));
  assert.equal(attendanceRepository.records.size, 0);
});

test("if attendance fails for one student, the game still finishes and the other students are still processed", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);
  attendanceRepository.shouldFailFor = studentAna.id;

  await assert.doesNotReject(
    gameAttendanceService.registerAttendanceForFinishedGame(GAME_CODE, [player("ana"), player("maria")]),
  );

  assert.equal(attendanceRepository.records.has(`${existingClass.id}:${studentAna.id}`), false);
  assert.equal(attendanceRepository.records.get(`${existingClass.id}:${studentMaria.id}`), "PRESENT");
});

test("classId always comes from game_code -> quiz_session -> classId, never from an external value: no such parameter exists", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);

  await gameAttendanceService.registerAttendanceForFinishedGame(GAME_CODE, [player("ana")]);

  // registerAttendanceForFinishedGame(gameCode, players) no acepta ni recibe
  // ningún classId: el único registrado corresponde exactamente al de la
  // clase guardada en esa quiz_session.
  const [key] = attendanceRepository.records.keys();
  assert.equal(key?.split(":")[0], existingClass.id);
});

test("userId used for attendance is resolved from users.nickname (PlayerIdentityService), never a client-supplied id: GamePlayer only carries a name", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);

  // GamePlayer = { name }: no hay forma de pasarle un userId directamente.
  await gameAttendanceService.registerAttendanceForFinishedGame(GAME_CODE, [player("ana")]);

  const [key] = attendanceRepository.records.keys();
  assert.equal(key?.split(":")[1], studentAna.id);
});

test("a game without a persisted quiz_session (legacy flow) registers no attendance and does not fail", async () => {
  const { gameAttendanceService, attendanceRepository } = buildServices();
  // No se llama a quizSessionRepository.seed(): no existe game_code -> quiz_session.

  await assert.doesNotReject(
    gameAttendanceService.registerAttendanceForFinishedGame("ANA-LEGACY", [player("ana")]),
  );

  assert.equal(attendanceRepository.records.size, 0);
});

test("a player who joined but never answered a question gets no attendance", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);

  await gameAttendanceService.registerAttendanceForFinishedGame(GAME_CODE, [player("ana", []), player("maria")]);

  assert.equal(attendanceRepository.records.has(`${existingClass.id}:${studentAna.id}`), false);
  assert.equal(attendanceRepository.records.get(`${existingClass.id}:${studentMaria.id}`), "PRESENT");
});

test("a student who finished the quiz but was not in the class group is enrolled and marked PRESENT", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository, groupRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);

  await gameAttendanceService.registerAttendanceForFinishedGame(GAME_CODE, [player("sofia")]);

  assert.equal(groupRepository.members.has(`${existingClass.groupId}:${studentSofia.id}`), true);
  assert.equal(attendanceRepository.records.get(`${existingClass.id}:${studentSofia.id}`), "PRESENT");
});

test("the same quiz reused with another group records attendance in the session's class, not the quiz's class", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository, groupRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id, otherGroupClass);

  await gameAttendanceService.registerAttendanceForFinishedGame(GAME_CODE, [player("ana")]);

  assert.equal(attendanceRepository.records.get(`${otherGroupClass.id}:${studentAna.id}`), "PRESENT");
  assert.equal(attendanceRepository.records.has(`${existingClass.id}:${studentAna.id}`), false);
  assert.equal(groupRepository.members.has(`${otherGroupClass.groupId}:${studentAna.id}`), true);
});

test("a session created before quiz_sessions.class_id existed falls back to the quiz's class", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id, null);

  await gameAttendanceService.registerAttendanceForFinishedGame(GAME_CODE, [player("ana")]);

  assert.equal(attendanceRepository.records.get(`${existingClass.id}:${studentAna.id}`), "PRESENT");
});
