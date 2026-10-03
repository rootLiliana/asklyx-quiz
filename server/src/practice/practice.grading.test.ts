import assert from "node:assert/strict";
import test from "node:test";

import { gradeAnswer, outputMatches, PracticeAnswerInputError, shortAnswerMatches } from "./practice.grading.js";
import type { PracticeAnswerInput, PracticeQuestion } from "./practice.types.js";

const question = (changes: Partial<PracticeQuestion>): PracticeQuestion => ({
  id: "1", type: "SHORT_ANSWER", text: "?", explanation: null, code: null, options: [], acceptedAnswers: [], modelSolution: null, ...changes,
});
const answer = (changes: Partial<PracticeAnswerInput>): PracticeAnswerInput => ({
  questionId: "1", optionId: null, answerText: null, selfAssessment: null, ...changes,
});

test("short answers ignore case, accents and extra spaces", () => {
  assert.equal(shortAnswerMatches("  AGREGACIÓN ", ["agregacion"]), true);
  assert.equal(shortAnswerMatches("data   frame", ["DataFrame", "data frame"]), true);
  assert.equal(shortAnswerMatches("serie", ["dataframe"]), false);
});

test("numeric short answers compare as numbers", () => {
  assert.equal(shortAnswerMatches("42.0", ["42"]), true);
  assert.equal(shortAnswerMatches("3,5", ["3.5"]), true);
  assert.equal(shortAnswerMatches("42", ["43"]), false);
  assert.equal(shortAnswerMatches("1e3", ["1000"]), true);
});

test("code output compares line by line ignoring trailing spaces and surrounding blank lines", () => {
  assert.equal(outputMatches("\nciudad\nCDMX    10\n\n", ["ciudad\nCDMX    10"]), true);
  assert.equal(outputMatches("a  \r\nb", ["a\nb"]), true);
  // Dentro de la línea sí importa (mayúsculas y espacios internos).
  assert.equal(outputMatches("cdmx 10", ["CDMX 10"]), false);
  assert.equal(outputMatches("CDMX 10", ["CDMX  10"]), false);
});

test("gradeAnswer: multiple choice uses the stored correct option", () => {
  const mc = question({
    type: "MULTIPLE_CHOICE",
    options: [{ id: "a", text: "sum", isCorrect: false }, { id: "b", text: "groupby", isCorrect: true }],
  });
  assert.equal(gradeAnswer(mc, answer({ optionId: "b" })), true);
  assert.equal(gradeAnswer(mc, answer({ optionId: "a" })), false);
  assert.throws(() => gradeAnswer(mc, answer({ optionId: "zzz" })), PracticeAnswerInputError);
});

test("gradeAnswer: code writing is self-assessed and needs the written code", () => {
  const cw = question({ type: "CODE_WRITING", modelSolution: "df.mean()" });
  assert.equal(gradeAnswer(cw, answer({ answerText: "df.mean()", selfAssessment: true })), true);
  assert.equal(gradeAnswer(cw, answer({ answerText: "df.sum()", selfAssessment: false })), false);
  assert.throws(() => gradeAnswer(cw, answer({ answerText: "", selfAssessment: true })), PracticeAnswerInputError);
  assert.throws(() => gradeAnswer(cw, answer({ answerText: "x" })), PracticeAnswerInputError);
});

test("gradeAnswer: empty text answers are rejected instead of graded as wrong", () => {
  assert.throws(() => gradeAnswer(question({ acceptedAnswers: ["x"] }), answer({ answerText: "  " })), PracticeAnswerInputError);
  assert.throws(() => gradeAnswer(question({ type: "CODE_OUTPUT", acceptedAnswers: ["x"] }), answer({})), PracticeAnswerInputError);
});
