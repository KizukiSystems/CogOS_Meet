import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import multer from "multer";
import os from "os";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);



async function withRetry<T>(operation: () => Promise<T>, maxRetries = 2): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      if (attempt > maxRetries) {
        throw error;
      }
      console.warn(`Gemini API call failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying...`);
      await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
    }
  }
}

function buildAnalysisSchema(selectedOptions?: string[], includeSentiment = false) {
  const properties: any = {};
  const wants = (key: string) => !selectedOptions || selectedOptions.includes(key) || selectedOptions.length === 0;

  if (wants("summary")) properties.summary = { type: Type.STRING };
  if (wants("executiveSummary")) properties.executiveSummary = { type: Type.STRING };
  if (wants("detailedSummary")) properties.detailedSummary = { type: Type.STRING };
  if (wants("tldl")) properties.tldl = { type: Type.STRING };
  
  if (wants("actionItems")) {
    properties.actionItems = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          task: { type: Type.STRING },
          owner: { type: Type.STRING },
          completed: { type: Type.BOOLEAN }
        },
        required: ["id", "task", "owner", "completed"]
      }
    };
  }
  if (wants("importantDates")) {
    properties.importantDates = { type: Type.ARRAY, items: { type: Type.STRING } };
  }
  if (wants("decisionLog")) {
    properties.decisionLog = { type: Type.ARRAY, items: { type: Type.STRING } };
  }
  
  // ALWAYS get verbatim for verification
  properties.verbatimTranscript = { type: Type.STRING };
  
  properties.tags = { type: Type.ARRAY, items: { type: Type.STRING } };
  properties.perspectives = {
    type: Type.OBJECT,
    properties: {
      empathy: { type: Type.STRING },
      operational: { type: Type.STRING }
    },
    required: ["empathy", "operational"]
  };

  if (includeSentiment) {
    properties.sentiment = { type: Type.STRING };
  }

  return {
    type: Type.OBJECT,
    properties,
    required: Object.keys(properties)
  };
}


const chunkAudio = (inputPath: string, outputDir: string, segmentTime: number = 600): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(outputDir, 'chunk_%03d.mp3');
    ffmpeg(inputPath)
      .outputOptions([
        '-f', 'segment',
        '-segment_time', `${segmentTime}`,
        '-c:a', 'libmp3lame'
      ])
      .output(outputPath)
      .on('end', () => {
        const files = fs.readdirSync(outputDir).filter(f => f.startsWith('chunk_')).sort();
        resolve(files.map(f => path.join(outputDir, f)));
      })
      .on('error', (err) => reject(err))
      .run();
  });
};

const extractTranscript = async (ai: any, filePath: string, mimeType: string, speakers: string): Promise<string> => {
  let uploadedFile: any = await withRetry(() => ai.files.upload({
    file: filePath,
    config: { mimeType }
  }));
  let fileInfo: any = await ai.files.get({ name: uploadedFile.name });
  while (fileInfo.state === "PROCESSING") {
    await new Promise(resolve => setTimeout(resolve, 3000));
    fileInfo = await ai.files.get({ name: uploadedFile.name });
  }
  if (fileInfo.state === "FAILED") {
    throw new Error("Gemini audio processing failed");
  }

  const prompt = `Please provide a verbatim transcript of the provided audio recording.${speakers ? " The speakers in this meeting are: " + speakers + ". Please assign their names correctly." : ""}`;
  
  const response: any = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [
      { fileData: { mimeType: fileInfo.mimeType, fileUri: fileInfo.uri } },
      prompt
    ]
  }));
  
  await ai.files.delete({ name: uploadedFile.name }).catch(() => {});
  return response.text || "";
};

const normalizeText = (text: string) => {
  if (!text) return "";
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  const upload = multer({ dest: os.tmpdir() });

  app.use(express.json({ limit: "50mb" }));

  app.post("/api/upload-audio", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      const { options, speakers } = req.body;
      let selectedOptions: string[] = [];
      try {
        if (options) selectedOptions = JSON.parse(options);
      } catch(e) {}

      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { timeout: 600000 }
      });
      
      const uploadedFile = await withRetry(() => ai.files.upload({
        file: req.file!.path,
        config: { mimeType: req.file!.mimetype }
      }));

      let fileInfo: any = await ai.files.get({ name: uploadedFile.name });
      while (fileInfo.state === "PROCESSING") {
        await new Promise(resolve => setTimeout(resolve, 3000));
        fileInfo = await ai.files.get({ name: uploadedFile.name });
      }

      if (fileInfo.state === "FAILED") {
        throw new Error("Gemini audio processing failed");
      }

      const prompt = `You are an expert meeting analyst.
Please analyze the provided audio recording.
${speakers ? "The speakers in this meeting are: " + speakers + ". Please assign their names correctly." : ""}
Extract the requested fields based on the provided schema.`;

      const response: any = await withRetry(() => ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          { fileData: { mimeType: fileInfo.mimeType, fileUri: fileInfo.uri } },
          prompt
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: buildAnalysisSchema(selectedOptions, req.body.includeSentiment === 'true')
        }
      }));

      await ai.files.delete({ name: uploadedFile.name }).catch(() => {});
      fs.unlinkSync(req.file.path);

      let analysisData: any = {};
      try {
        analysisData = JSON.parse(response.text || "{}");
      } catch (err) {
        return res.status(500).json({ error: "Failed to parse model response" });
      }

      const verbatimRequested = selectedOptions.length === 0 || selectedOptions.includes("verbatim");

      res.json({ analysis: analysisData, verbatimRequested });
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
      const response: any = await withRetry(() => ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `You are an expert meeting analyst.
        
Analyze the following transcript and extract the requested fields. The tags array should contain categorization tags like 'Internal', 'Client', 'Project', etc., based on the meeting content.

Transcript:
${transcript}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: buildAnalysisSchema([], req.body.includeSentiment === 'true')
        }
      }));

      let analysisData = {};
      try {
        analysisData = JSON.parse(response.text || "{}");
      } catch (err) {
        return res.status(500).json({ error: "Failed to parse model response" });
      }

      res.json({ analysis: analysisData, verbatimRequested: true });
    } catch (error) {
      console.error("Error analyzing transcript:", error);
      res.status(500).json({ error: "Failed to analyze transcript" });
    }
  });

  app.post("/api/verify", async (req, res) => {
    try {
      let { transcript, analysis } = req.body;
      
      if (!transcript || !analysis) {
        return res.status(400).json({ error: "Transcript and analysis are required" });
      }
      
      let truncated = false;
      const MAX_TRANSCRIPT_LENGTH = 100000;
      if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
        transcript = transcript.substring(0, MAX_TRANSCRIPT_LENGTH);
        truncated = true;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response: any = await withRetry(() => ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `SOURCE TRANSCRIPT:
${transcript}

ANALYSIS:
${JSON.stringify(analysis, null, 2)}`,
        config: {
          systemInstruction: `You are a verification auditor. You receive a SOURCE TRANSCRIPT and an ANALYSIS generated from it by another system.

Step 1. Decompose the ANALYSIS into atomic claims. One assertion per claim. Split compound sentences. A claim containing "and" is usually two claims. Record which analysis field each claim came from.

Step 2. Judge each claim against the SOURCE TRANSCRIPT.

Rules of evidence:
- The transcript is the only evidence. Your own knowledge is not evidence.
- If the transcript does not say it, it is not supported, however plausible it is.
- Do not be charitable. Do not repair or soften a claim to make it verifiable.
- Any claim naming a person, a number, a date, an amount, or a commitment must trace to specific transcript text.

Verdicts, assign exactly one per claim:
- confirmed: the transcript states this directly. Supply the verbatim quote.
- probable: the transcript implies this without stating it. Supply the quote you inferred from and state the inference in one line.
- disputed: the transcript contains content that contradicts this claim. Supply the contradicting quote.
- gap: the transcript is silent on this. Not wrong, just unsupported. quote is null.
- fabricated: the claim introduces specific entities, numbers, dates, names, or commitments that appear nowhere in the transcript. quote is null.

Hard constraint: every quote you supply must be a verbatim substring of the transcript. If you cannot produce a verbatim quote, the verdict cannot be confirmed or probable. Do not paraphrase into the quote field.

You are not scoring. You are not summarizing. Assign verdicts and supply evidence.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                claim: { type: Type.STRING },
                sourceField: { type: Type.STRING },
                verdict: { type: Type.STRING, enum: ["confirmed", "probable", "disputed", "gap", "fabricated"] },
                quote: { type: Type.STRING, nullable: true },
                reasoning: { type: Type.STRING }
              },
              required: ["id", "claim", "sourceField", "verdict", "reasoning"]
            }
          }
        }
      }));

      let claims = [];
      try {
        claims = JSON.parse(response.text || "[]");
      } catch (err) {
        return res.status(500).json({ error: "Failed to parse verification response" });
      }

      const validVerdicts = ["confirmed", "probable", "disputed", "gap", "fabricated"];
      
      const counts: Record<string, number> = { confirmed: 0, probable: 0, disputed: 0, gap: 0, fabricated: 0 };
      
      const normTranscript = normalizeText(transcript);
      
      claims.forEach((claim: any) => {
        if (!validVerdicts.includes(claim.verdict)) {
          claim.verdict = 'gap';
          claim.reasoning += " (Invalid verdict coerced to gap)";
        }
        
        if (claim.verdict === 'confirmed' || claim.verdict === 'probable') {
          if (!claim.quote || claim.quote.trim() === "") {
            claim.verdict = 'gap';
            claim.reasoning += " (no quote supplied)";
            claim.quote = null;
          } else {
            const normQuote = normalizeText(claim.quote);
            if (!normTranscript.includes(normQuote)) {
              claim.verdict = 'gap';
              claim.reasoning += " (quote failed verbatim check)";
              claim.quote = null;
            }
          }
        }
        counts[claim.verdict] = (counts[claim.verdict] || 0) + 1;
      });

      const w: Record<string, number> = { confirmed: 1, probable: 0.5, gap: 0, disputed: 0, fabricated: 0 };
      
      let supportScore: number | null = null;
      if (claims.length > 0) {
        const totalWeight = claims.reduce((sum: number, c: any) => sum + (w[c.verdict] || 0), 0);
        supportScore = Math.round(100 * totalWeight / claims.length);
      }

      const flagged = counts.disputed > 0 || counts.fabricated > 0;

      const verification = {
        claims,
        counts,
        supportScore,
        flagged,
        judgeModel: "gemini-3.1-pro-preview",
        verifiedAt: new Date().toISOString(),
        truncated
      };

      res.json({ verification });
    } catch (error) {
      console.error("Error verifying analysis:", error);
      res.status(500).json({ error: "Failed to verify analysis" });
    }
  });

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Express error:", err);
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: "File too large" });
    }
    res.status(500).json({ error: err.message || "Internal server error" });
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
