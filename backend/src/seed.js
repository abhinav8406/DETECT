import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
import DetectiveCase from "./models/DetectiveCase.js";
import DetectiveClue from "./models/DetectiveClue.js";
import DetectiveQuestion from "./models/DetectiveQuestion.js";
import DetectiveHint from "./models/DetectiveHint.js";

await mongoose.connect(process.env.MONGO_URI);

const hash = p => bcrypt.hash(p, 12);

await User.deleteMany({});
await DetectiveCase.deleteMany({});
await DetectiveClue.deleteMany({});
await DetectiveQuestion.deleteMany({});
await DetectiveHint.deleteMany({});

const admin = await User.create({
  name: "Fest Admin", username: "admin", email: "admin@example.com",
  passwordHash: await hash("admin123"), role: "admin",
  qualificationStatus: "QUALIFIED"
});

await User.create({
  name: "Qualified Player", username: "qualified", email: "qualified@example.com",
  passwordHash: await hash("password123"), role: "participant",
  round1Status: "COMPLETED", round1Score: 900, qualificationStatus: "QUALIFIED"
});

await User.create({
  name: "Locked Player", username: "locked", email: "locked@example.com",
  passwordHash: await hash("password123"), role: "participant",
  round1Status: "COMPLETED", round1Score: 300, qualificationStatus: "NOT_QUALIFIED"
});

const c = await DetectiveCase.create({
  title: "The Missing Prototype",
  description: "A prototype disappeared from the laboratory between the final CCTV check and the security sweep. Combine the evidence to identify what happened.",
  difficulty: "Medium",
  timeLimit: 900,
  maximumScore: 1000,
  status: "PUBLISHED",
  suspects: [
    { name: "Aarav", description: "Research assistant with laboratory access." },
    { name: "Meera", description: "Technician responsible for equipment logs." },
    { name: "Kabir", description: "Security contractor on evening duty." }
  ],
  finalSolution: {
    culprit: "Meera",
    time: "20:42",
    method: "Used the maintenance corridor",
    motive: "To hide a failed test result",
    evidenceClues: []
  },
  scoring: { culprit: 100, time: 50, method: 50, motive: 50, evidence: 100, wrongFinal: -50 },
  createdBy: admin._id
});

const clueData = [
  ["CCTV — 20:40", "Camera 3 shows the corridor empty before the lights briefly fail.", "CCTV footage: 20:40:11. Corridor camera records no person entering from the main door.", "CCTV"],
  ["Access Log", "The laboratory access terminal records an unusual maintenance credential.", "20:42 — Maintenance credential M-17 used. Main laboratory door remained closed.", "DIGITAL"],
  ["Equipment Log", "A maintenance entry conflicts with the technician's statement.", "20:44 — Cooling unit reset. Entry made from the maintenance console.", "DOCUMENT"],
  ["Message Archive", "A recovered message gives a possible motive.", "Message draft: 'If the result is seen tonight, the entire batch will be rejected.'", "TEXT"]
];

const clues = [];
for (let i = 0; i < clueData.length; i++) {
  clues.push(await DetectiveClue.create({
    caseId: c._id, sequenceNumber: i + 1, title: clueData[i][0],
    description: clueData[i][1], evidence: clueData[i][2], evidenceType: clueData[i][3],
    classification: ["SUPPORTING", "CRITICAL", "SUPPORTING", "CRITICAL"][i]
  }));
}

const questions = [
  ["Who had the credential used at 20:42?", ["Aarav", "Meera", "Kabir", "Nobody"], 1, 100],
  ["Which route best explains the closed main door?", ["Main entrance", "Maintenance corridor", "Window", "Server room"], 1, 100],
  ["Which clue establishes the likely motive?", ["CCTV", "Access log", "Equipment log", "Message archive"], 3, 100],
  ["Who should be investigated as the primary culprit?", ["Aarav", "Meera", "Kabir", "Unknown"], 1, 100]
];

for (let i = 0; i < questions.length; i++) {
  const q = await DetectiveQuestion.create({
    caseId: c._id, clueId: clues[i]._id, sequenceNumber: i + 1,
    question: questions[i][0], options: questions[i][1],
    correctOption: questions[i][2], points: questions[i][3]
  });
  await DetectiveHint.create({
    caseId: c._id, questionId: q._id, sequenceNumber: 1,
    hintText: "Compare this clue with the corresponding access or timestamp record.",
    penalty: 20, isEnabled: true
  });
}

console.log("Seed complete.");
await mongoose.disconnect();
