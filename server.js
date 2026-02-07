import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

const AI_API_BASE = process.env.AI_API_BASE || "https://api.openai.com/v1";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const LEVEL_UNLOCK_THRESHOLD = 0.7;

const questionBank = [
  {
    id: "L1-Q1",
    level: 1,
    prompt: "Define inflation in simple terms.",
    modelAnswer: "Inflation is the general rise in prices over time which reduces the purchasing power of money.",
    keywords: ["general rise", "prices", "purchasing power", "over time"],
    maxMarks: 1
  },
  {
    id: "L1-Q2",
    level: 1,
    prompt: "What is GDP and why is it important?",
    modelAnswer: "GDP is the total value of goods and services produced within a country in a period; it indicates the size and health of the economy.",
    keywords: ["total value", "goods and services", "within a country", "period", "economy"],
    maxMarks: 1
  },
  {
    id: "L2-Q1",
    level: 2,
    prompt: "Explain the difference between monetary policy and fiscal policy with one example each.",
    modelAnswer: "Monetary policy is run by the central bank to control money supply and rates (e.g., repo rate change). Fiscal policy is run by government to manage spending and taxes (e.g., increased infrastructure spending or tax cuts).",
    keywords: ["central bank", "money supply", "interest", "repo", "government", "spending", "tax"],
    maxMarks: 2
  },
  {
    id: "L2-Q2",
    level: 2,
    prompt: "What is the role of the RBI in managing inflation?",
    modelAnswer: "RBI targets inflation using monetary policy tools such as repo rate, CRR, and open market operations to manage liquidity and demand.",
    keywords: ["targets", "monetary policy", "repo", "CRR", "open market", "liquidity"],
    maxMarks: 2
  },
  {
    id: "L3-Q1",
    level: 3,
    prompt: "Discuss how a rise in global crude oil prices can affect India's current account balance and inflation.",
    modelAnswer: "Higher crude prices increase import bill, widening the current account deficit, and raise input costs, leading to higher inflation via cost-push pressures.",
    keywords: ["import bill", "current account", "deficit", "input costs", "cost-push", "inflation"],
    maxMarks: 3
  },
  {
    id: "L3-Q2",
    level: 3,
    prompt: "Explain the concept of financial inclusion and mention two initiatives in India that support it.",
    modelAnswer: "Financial inclusion ensures access to useful financial services for all; initiatives include PMJDY, Aadhaar-enabled payments, and BC model.",
    keywords: ["access", "financial services", "PMJDY", "Aadhaar", "business correspondent"],
    maxMarks: 3
  }
];

const getLevelQuestions = (level) =>
  questionBank.filter((question) => question.level === level);

const calculateObjectiveScore = (question, answer) => {
  if (!answer || !answer.trim()) {
    return { awardedMarks: 0, verdict: "unattempted", explanation: "No answer provided." };
  }

  const normalized = answer.toLowerCase();
  const keywordHits = question.keywords.filter((keyword) => normalized.includes(keyword.toLowerCase())).length;
  const ratio = keywordHits / question.keywords.length;
  const awardedMarks = ratio >= 0.6 ? question.maxMarks : 0;
  const verdict = awardedMarks > 0 ? "correct" : "incorrect";
  return {
    awardedMarks,
    verdict,
    explanation: awardedMarks > 0 ? "Matched key points." : "Key points missing."
  };
};

const ibpsScore = (results) => {
  const totalMarks = results.reduce((sum, item) => sum + item.maxMarks, 0);
  const positive = results.reduce((sum, item) => sum + item.awardedMarks, 0);
  const incorrectCount = results.filter((item) => item.verdict === "incorrect").length;
  const penalty = incorrectCount * 0.25;
  const score = Math.max(0, positive - penalty);
  return { score, totalMarks };
};

const buildEvaluationPrompt = ({ questions, answers }) => {
  const payload = questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    modelAnswer: question.modelAnswer,
    maxMarks: question.maxMarks,
    studentAnswer: answers.find((item) => item.id === question.id)?.answer || ""
  }));

  return `You are an examiner for RBI Grade B Economics. Evaluate each answer using IBPS-style marking: +1 (or maxMarks) for correct, 0 for incorrect, and mark unattempted as 0. Apply negative marking of 0.25 per incorrect answer. Return JSON only with this schema: {"evaluations":[{"id":"","awardedMarks":0,"verdict":"correct|incorrect|unattempted","explanation":""}]}.
Questions: ${JSON.stringify(payload)}`;
};

const evaluateWithAI = async ({ questions, answers }) => {
  if (!AI_API_KEY) {
    return null;
  }

  const prompt = buildEvaluationPrompt({ questions, answers });

  const response = await fetch(`${AI_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "You are a strict examiner. Output JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || "";
  try {
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
};

app.get("/api/questions", (req, res) => {
  const level = Number(req.query.level) || 1;
  const questions = getLevelQuestions(level).map(({ modelAnswer, keywords, ...rest }) => rest);
  res.json({ level, questions });
});

app.post("/api/evaluate", async (req, res) => {
  const { level = 1, answers = [] } = req.body || {};
  const questions = getLevelQuestions(Number(level));

  let evaluations = null;

  const aiResult = await evaluateWithAI({ questions, answers });
  if (aiResult?.evaluations?.length) {
    evaluations = aiResult.evaluations.map((item) => {
      const question = questions.find((q) => q.id === item.id);
      return {
        ...item,
        maxMarks: question?.maxMarks || 1
      };
    });
  }

  if (!evaluations) {
    evaluations = questions.map((question) => {
      const answer = answers.find((item) => item.id === question.id)?.answer || "";
      return {
        id: question.id,
        maxMarks: question.maxMarks,
        ...calculateObjectiveScore(question, answer)
      };
    });
  }

  const { score, totalMarks } = ibpsScore(evaluations);
  const percentage = totalMarks > 0 ? score / totalMarks : 0;
  const unlockedNext = percentage >= LEVEL_UNLOCK_THRESHOLD;

  res.json({
    level,
    score,
    totalMarks,
    percentage,
    unlockedNext,
    evaluations
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
