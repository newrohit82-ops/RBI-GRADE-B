# RBI Grade B Economics Practice App

This app provides daily practice questions for RBI Grade B Economics aspirants. It serves level-wise questions from simple to complex, evaluates answers using an AI API with IBPS-style marking, and unlocks higher levels when the student clears the score threshold.

## Features
- Level-based question practice (easy to complex)
- AI-powered evaluation with IBPS-style marking
- Negative marking (0.25) for incorrect responses
- Level unlock system (70%+ required)

## Getting Started

```bash
npm install
npm start
```

Visit `http://localhost:3000`.

## AI Evaluation Configuration
Set the following environment variables to enable AI evaluation:

```
AI_API_BASE=https://api.openai.com/v1
AI_API_KEY=your_api_key_here
AI_MODEL=gpt-4o-mini
```

If no API key is provided, the app falls back to keyword-based evaluation.
