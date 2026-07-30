# Meeting Analysis App

This application analyzes meeting transcripts or audio recordings to extract action items, decisions, and summaries, and uses an independent language model pass to verify extracted claims against the verbatim transcript.

## Features

- **Audio Ingestion**: Upload audio recordings to generate transcripts and extract structured insights.
- **Transcript Ingestion**: Directly paste live transcripts for analysis.
- **Verification Pass**: A second, independent LLM (the "judge") evaluates the extracted claims against the verbatim transcript, ensuring every claim is backed by the source material. It flags hallucinated or unverified claims.
- **Exporting**: Export analyses to Markdown or DOCX formats, including the verification results.

## Requirements

You must provide a valid Gemini API key. Set it in a `.env` file (see `.env.example`):
\`\`\`
GEMINI_API_KEY=your_key_here
\`\`\`

## Architecture

- The application uses \`gemini-3.6-flash\` to process audio/transcripts and generate the structured JSON analysis.
- The verification pass uses \`gemini-3.1-pro-preview\` to assess the generated analysis against the verbatim transcript.
- Verification scores are computed deterministically (Confirmed = 1, Probable = 0.5, Gap/Disputed/Fabricated = 0).

## Running Locally

1. Install dependencies: \`npm install\`
2. Start the development server: \`npm run dev\`
3. Open http://localhost:3000 in your browser.
