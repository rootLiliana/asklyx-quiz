import assert from "node:assert/strict";
import test from "node:test";

import type { ClassRepository } from "../classes/class.repository.js";
import type { ClassItem } from "../classes/class.types.js";
import type { CreateGroupInput, Group, GroupStudent } from "../groups/group.types.js";
import type { GroupRepository } from "../groups/group.repository.js";
import type { CreateQuizContent, QuizContent } from "../quizzes/quiz-content.types.js";
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
import type { AttendanceRecord, AttendanceStatus, ClassAttendanceEntry, StudentAttendanceEntry } from "./attendance.types.js";
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

class FakeClassRepository implements ClassRepository {
  async findAll(): Promise<ClassItem[]> { return [existingClass]; }
  async findById(id: string): Promise<ClassItem | null> { return id === existingClass.id ? existingClass : null; }
  async findByGroup(): Promise<ClassItem[]> { return [existingClass]; }
}

class FakeQuizContentRepository implements QuizContentRepository {
  async create(): Promise<QuizContent> { throw new Error("not used in these tests"); }
  async findById(id: string): Promise<QuizContent | null> { return id === existingQuiz.id ? existingQuiz : null; }
}

class FakeQuizSessionRepository implements QuizSessionRepository {
  private readonly sessionsByGameCode = new Map<string, QuizSession>();

  seed(gameCode: string, quizId: string): void {
    this.sessionsByGameCode.set(gameCode, {
      id: "900",
      quizId,
      hostId: "1",
      groupId: existingClass.groupId,
      gameCode,
      mode: "PRACTICE",
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
}

class FakeUserRepository implements UserRepository {
  private readonly usersByNickname = new Map<string, User>([
    [studentAna.nickname, studentAna],
    [studentMaria.nickname, studentMaria],
    [hostLili.nickname, hostLili],
  ]);

  async create(): Promise<User> { return studentAna; }
  async findById(id: string): Promise<User | null> {
    return [studentAna, studentMaria, hostLili].find((user) => user.id === id) ?? null;
  }
  async findByEmail(): Promise<User | null> { return null; }
  async findByNickname(nickname: string): Promise<User | null> { return this.usersByNickname.get(nickname) ?? null; }
  async findAuthByNickname(): Promise<UserWithPasswordHash | null> { return null; }
  async updateRole(_: string, role: UserRole): Promise<User | null> { return { ...studentAna, role }; }
  async findAll(): Promise<User[]> { return [studentAna, studentMaria, hostLili]; }
}

class FakeGroupRepository implements GroupRepository {
  async create(input: CreateGroupInput): Promise<Group> { return { id: "10", name: input.name, createdAt: "2026-01-01T00:00:00.000Z" }; }
  async findById(): Promise<Group | null> { return { id: existingClass.groupId, name: "Grupo 1", createdAt: "2026-01-01T00:00:00.000Z" }; }
  async findByName(): Promise<Group | null> { return null; }
  async findAll(): Promise<Group[]> { return []; }
  async findMembers(): Promise<GroupStudent[]> { return []; }
  async hasMember(groupId: string, userId: string): Promise<boolean> {
    return groupId === existingClass.groupId && (userId === studentAna.id || userId === studentMaria.id);
  }
  async addMember(): Promise<void> {}
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

  return { gameAttendanceService, quizSessionRepository, attendanceRepository };
}

const GAME_CODE = "ANA-1234";

test("registers PRESENT for a single valid student player, using the classId resolved from game_code -> quiz_session -> quiz", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);

  await gameAttendanceService.registerPresentPlayersForGame(GAME_CODE, [{ name: "ana" }]);

  assert.equal(attendanceRepository.records.get(`${existingClass.id}:${studentAna.id}`), "PRESENT");
  assert.equal(attendanceRepository.records.size, 1);
});

test("registers PRESENT for two valid student players", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);

  await gameAttendanceService.registerPresentPlayersForGame(GAME_CODE, [{ name: "ana" }, { name: "maria" }]);

  assert.equal(attendanceRepository.records.get(`${existingClass.id}:${studentAna.id}`), "PRESENT");
  assert.equal(attendanceRepository.records.get(`${existingClass.id}:${studentMaria.id}`), "PRESENT");
  assert.equal(attendanceRepository.records.size, 2);
});

test("an unknown nickname does not break the start of the game and the rest are still processed", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);

  await assert.doesNotReject(
    gameAttendanceService.registerPresentPlayersForGame(GAME_CODE, [{ name: "no-existe" }, { name: "ana" }]),
  );

  assert.equal(attendanceRepository.records.size, 1);
  assert.equal(attendanceRepository.records.get(`${existingClass.id}:${studentAna.id}`), "PRESENT");
});

test("a HOST/ADMIN nickname does not generate attendance", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);

  await gameAttendanceService.registerPresentPlayersForGame(GAME_CODE, [{ name: "lilis" }, { name: "ana" }]);

  assert.equal(attendanceRepository.records.size, 1);
  assert.equal(attendanceRepository.records.has(`${existingClass.id}:${hostLili.id}`), false);
});

test("running the registration twice does not duplicate records (idempotent, respects UNIQUE(class_id, student_id))", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);

  await gameAttendanceService.registerPresentPlayersForGame(GAME_CODE, [{ name: "ana" }]);
  await gameAttendanceService.registerPresentPlayersForGame(GAME_CODE, [{ name: "ana" }]);

  assert.equal(attendanceRepository.records.size, 1);
  assert.equal(attendanceRepository.records.get(`${existingClass.id}:${studentAna.id}`), "PRESENT");
});

test("with no players, the game starts normally: it is not an error", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);

  await assert.doesNotReject(gameAttendanceService.registerPresentPlayersForGame(GAME_CODE, []));
  assert.equal(attendanceRepository.records.size, 0);
});

test("if attendance fails for one student, the game continues starting and the other students are still processed", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);
  attendanceRepository.shouldFailFor = studentAna.id;

  await assert.doesNotReject(
    gameAttendanceService.registerPresentPlayersForGame(GAME_CODE, [{ name: "ana" }, { name: "maria" }]),
  );

  assert.equal(attendanceRepository.records.has(`${existingClass.id}:${studentAna.id}`), false);
  assert.equal(attendanceRepository.records.get(`${existingClass.id}:${studentMaria.id}`), "PRESENT");
});

test("classId always comes from game_code -> quiz_session -> quiz -> classId, never from an external value: no such parameter exists", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);

  await gameAttendanceService.registerPresentPlayersForGame(GAME_CODE, [{ name: "ana" }]);

  // registerPresentPlayersForGame(gameCode, players) no acepta ni recibe
  // ningún classId: el único registrado corresponde exactamente al de la
  // clase real del quiz de esa quiz_session.
  const [key] = attendanceRepository.records.keys();
  assert.equal(key?.split(":")[0], existingClass.id);
});

test("userId used for attendance is resolved from users.nickname (PlayerIdentityService), never a client-supplied id: GamePlayer only carries a name", async () => {
  const { gameAttendanceService, quizSessionRepository, attendanceRepository } = buildServices();
  quizSessionRepository.seed(GAME_CODE, existingQuiz.id);

  // GamePlayer = { name }: no hay forma de pasarle un userId directamente.
  await gameAttendanceService.registerPresentPlayersForGame(GAME_CODE, [{ name: "ana" }]);

  const [key] = attendanceRepository.records.keys();
  assert.equal(key?.split(":")[1], studentAna.id);
});

test("a game without a persisted quiz_session (legacy flow) registers no attendance and does not fail", async () => {
  const { gameAttendanceService, attendanceRepository } = buildServices();
  // No se llama a quizSessionRepository.seed(): no existe game_code -> quiz_session.

  await assert.doesNotReject(
    gameAttendanceService.registerPresentPlayersForGame("ANA-LEGACY", [{ name: "ana" }]),
  );

  assert.equal(attendanceRepository.records.size, 0);
});
