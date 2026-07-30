import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import multer from "multer";
import os from "os";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  const upload = multer({ dest: os.tmpdir() });

  app.use(express.json());

  // API Routes
  app.post("/api/upload-audio", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      const { options, speakers } = req.body;
      let selectedOptions = [];
      try {
        if (options) selectedOptions = JSON.parse(options);
      } catch(e) {}

      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          timeout: 600000 // 10 minutes
        }
      });
      
      const uploadedFile = await ai.files.upload({
        file: req.file.path,
        config: {
          mimeType: req.file.mimetype,
        }
      });

      let fileInfo = await ai.files.get({ name: uploadedFile.name });
      while (fileInfo.state === "PROCESSING") {
        await new Promise(resolve => setTimeout(resolve, 3000));
        fileInfo = await ai.files.get({ name: uploadedFile.name });
      }

      if (fileInfo.state === "FAILED") {
        throw new Error("Gemini audio processing failed");
      }

      const jsonStructure: any = {};
      if (selectedOptions.includes("verbatim")) jsonStructure.verbatimTranscript = "Full transcript text";
      if (selectedOptions.includes("executiveSummary")) jsonStructure.executiveSummary = "High-level executive summary";
      if (selectedOptions.includes("detailedSummary")) jsonStructure.detailedSummary = "In-depth summary";
      if (selectedOptions.includes("tldl")) jsonStructure.tldl = "Too Long Didn't Listen summary";
      if (selectedOptions.includes("actionItems")) jsonStructure.actionItems = [{ id: "uuid-v4-string", task: "Task description", owner: "Person name or 'Unassigned'", completed: false }];
      if (selectedOptions.includes("importantDates")) jsonStructure.importantDates = ["YYYY-MM-DD: Description"];
      if (selectedOptions.includes("decisionLog")) jsonStructure.decisionLog = ["Decision 1", "Decision 2"];
      
      jsonStructure.sentiment = "Positive";
      jsonStructure.sentimentScore = 85;
      jsonStructure.epistemicConfidence = 95;
      jsonStructure.tags = ["Tag 1", "Tag 2"];
      jsonStructure.perspectives = {
        empathy: "Analysis of team dynamics.",
        operational: "Analysis of decisions."
      };

      const prompt = `You are an expert meeting analyst operating with Codette-style multi-perspective reasoning and ISNAD-level epistemic governance.
Please analyze the provided audio recording.
${speakers ? `The speakers in this meeting are: ${speakers}. Please assign their names correctly.` : ""}

Return a purely valid JSON object (NO markdown tags, NO backticks) with exactly this structure matching the requested outputs:
${JSON.stringify(jsonStructure, null, 2)}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            fileData: {
              mimeType: fileInfo.mimeType,
              fileUri: fileInfo.uri
            }
          },
          prompt
        ],
      });

      await ai.files.delete({ name: uploadedFile.name }).catch(() => {});
      fs.unlinkSync(req.file.path);

      let analysisText = response.text || "{}";
      analysisText = analysisText.replace(/```json/g, "").replace(/```/g, "").trim();
      const analysisData = JSON.parse(analysisText);

      res.json({ analysis: analysisData });
    } catch (error) {
      console.error("Error processing audio upload:", error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: "Failed to process audio" });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const { transcript } = req.body;
      
      if (!transcript) {
        return res.status(400).json({ error: "Transcript is required" });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `You are an expert meeting analyst operating with Codette-style multi-perspective reasoning and ISNAD-level epistemic governance.
        
Analyze the following transcript and return a purely valid JSON object (NO markdown tags, NO backticks) with this exact structure:
{
  "summary": "Executive summary of the meeting",
  "actionItems": [{"id": "uuid-v4-string", "task": "Task description", "owner": "Person name or 'Unassigned'", "completed": false}],
  "sentiment": "Positive", 
  "sentimentScore": 85,
  "epistemicConfidence": 95,
  "tags": ["Tag 1", "Tag 2"],
  "perspectives": {
    "empathy": "Analysis of team dynamics, stakeholder impact, and emotional tone.",
    "operational": "Analysis of decisions, blockers, and structural architecture discussed."
  }
}

The sentiment must be one of: "Positive", "Neutral", "Negative".
The epistemicConfidence must be a number from 0 to 100 based on transcript clarity and lack of contradictions.
The tags array should contain categorization tags like 'Internal', 'Client', 'Project', etc., based on the meeting content.

Transcript:
${transcript}`,
      });

      let analysisText = response.text || "{}";
      analysisText = analysisText.replace(/```json/g, "").replace(/```/g, "").trim();
      const analysisData = JSON.parse(analysisText);

      res.json({ analysis: analysisData });
    } catch (error) {
      console.error("Error analyzing transcript:", error);
      res.status(500).json({ error: "Failed to analyze transcript" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  server.timeout = 0;
  server.keepAliveTimeout = 0;
}

startServer();
