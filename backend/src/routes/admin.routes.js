import { Router } from "express";
import { Parser } from "json2csv";
import { auth, adminOnly } from "../middleware/auth.js";
import DetectiveCase from "../models/DetectiveCase.js";
import DetectiveClue from "../models/DetectiveClue.js";
import DetectiveQuestion from "../models/DetectiveQuestion.js";
import DetectiveHint from "../models/DetectiveHint.js";
import DetectiveAttempt from "../models/DetectiveAttempt.js";
import User from "../models/User.js";

const router = Router();
router.use(auth, adminOnly);

router.get("/cases", async (_, res) => {
  res.json(await DetectiveCase.find().sort({ createdAt: -1 }));
});

router.post("/cases", async (req, res) => {
  const created = await DetectiveCase.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json(created);
});

router.patch("/cases/:id", async (req, res) => {
  const updated = await DetectiveCase.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});

router.delete("/cases/:id", async (req, res) => {
  await Promise.all([
    DetectiveCase.findByIdAndDelete(req.params.id),
    DetectiveClue.deleteMany({ caseId: req.params.id }),
    DetectiveQuestion.deleteMany({ caseId: req.params.id }),
    DetectiveHint.deleteMany({ caseId: req.params.id })
  ]);
  res.json({ deleted: true });
});

router.post("/clues", async (req, res) => res.status(201).json(await DetectiveClue.create(req.body)));
router.patch("/clues/:id", async (req, res) => res.json(await DetectiveClue.findByIdAndUpdate(req.params.id, req.body, { new: true })));
router.delete("/clues/:id", async (req, res) => {
  await DetectiveClue.findByIdAndDelete(req.params.id);
  res.json({ deleted: true });
});

router.post("/questions", async (req, res) => res.status(201).json(await DetectiveQuestion.create(req.body)));
router.patch("/questions/:id", async (req, res) => res.json(await DetectiveQuestion.findByIdAndUpdate(req.params.id, req.body, { new: true })));
router.delete("/questions/:id", async (req, res) => {
  await DetectiveQuestion.findByIdAndDelete(req.params.id);
  res.json({ deleted: true });
});

router.post("/hints", async (req, res) => res.status(201).json(await DetectiveHint.create(req.body)));
router.patch("/hints/:id", async (req, res) => res.json(await DetectiveHint.findByIdAndUpdate(req.params.id, req.body, { new: true })));
router.delete("/hints/:id", async (req, res) => {
  await DetectiveHint.findByIdAndDelete(req.params.id);
  res.json({ deleted: true });
});

router.get("/monitoring", async (_, res) => {
  const rows = await DetectiveAttempt.find()
    .populate("participantId", "name username email teamId teamName qualificationStatus")
    .sort({ updatedAt: -1 });

  res.json(rows.map(a => ({
    participant: a.participantId,
    caseId: a.caseId,
    status: a.status,
    currentClue: a.currentClue,
    currentQuestion: a.currentQuestion,
    hintsUsed: a.hintsUsed,
    score: a.score,
    timeRemaining: Math.max(0, new Date(a.expiresAt).getTime() - Date.now())
  })));
});

router.post("/unlock/:userId", async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.userId,
    { qualificationStatus: "QUALIFIED" },
    { new: true }
  );
  res.json({ id: user._id, qualificationStatus: user.qualificationStatus });
});

router.post("/lock/:userId", async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.userId,
    { qualificationStatus: "NOT_QUALIFIED" },
    { new: true }
  );
  res.json({ id: user._id, qualificationStatus: user.qualificationStatus });
});

router.get("/export", async (req, res) => {
  const allowed = [
    "name", "username", "email", "teamId", "teamName",
    "round1Status", "round1Score", "qualificationStatus"
  ];
  const fields = String(req.query.fields || "").split(",").filter(x => allowed.includes(x));
  const users = await User.find().lean();
  const rows = users.map(u => Object.fromEntries(fields.map(f => [f, u[f]])));

  const csv = new Parser({ fields }).parse(rows);
  res.header("Content-Type", "text/csv");
  res.attachment("participants.csv");
  res.send(csv);
});

export default router;
