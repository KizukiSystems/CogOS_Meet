import re
import sys

with open('server.ts', 'r') as f:
    content = f.read()

import_statement = """import os from "os";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
"""
content = content.replace('import os from "os";\nimport fs from "fs";', import_statement)

chunking_helper = """
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
  let uploadedFile = await withRetry(() => ai.files.upload({
    file: filePath,
    config: { mimeType }
  }));
  let fileInfo = await ai.files.get({ name: uploadedFile.name });
  while (fileInfo.state === "PROCESSING") {
    await new Promise(resolve => setTimeout(resolve, 3000));
    fileInfo = await ai.files.get({ name: uploadedFile.name });
  }
  if (fileInfo.state === "FAILED") {
    throw new Error("Gemini audio processing failed");
  }

  const prompt = `Please provide a verbatim transcript of the provided audio recording.${speakers ? " The speakers in this meeting are: " + speakers + ". Please assign their names correctly." : ""}`;
  
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [
      { fileData: { mimeType: fileInfo.mimeType, fileUri: fileInfo.uri } },
      prompt
    ]
  }));
  
  await ai.files.delete({ name: uploadedFile.name }).catch(() => {});
  return response.text || "";
};
"""

content = content.replace('const normalizeText', chunking_helper + '\nconst normalizeText')

upload_endpoint_old = """  app.post("/api/upload-audio", upload.single("audio"), async (req, res) => {
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

      let fileInfo = await ai.files.get({ name: uploadedFile.name });
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

      const response = await withRetry(() => ai.models.generateContent({
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
  });"""

upload_endpoint_new = """  app.post("/api/upload-audio", upload.single("audio"), async (req, res) => {
    let chunksDir = "";
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
      
      let fullTranscript = "";
      
      // If file > 20MB, chunk it
      if (req.file.size > 20 * 1024 * 1024) {
        chunksDir = path.join(os.tmpdir(), `chunks_${Date.now()}`);
        fs.mkdirSync(chunksDir);
        
        console.log(`File is large (${req.file.size} bytes). Chunking into 10 minute segments...`);
        const chunkPaths = await chunkAudio(req.file.path, chunksDir);
        
        console.log(`Generated ${chunkPaths.length} chunks. Extracting transcripts in parallel...`);
        
        // Process in parallel
        const transcriptPromises = chunkPaths.map(cp => extractTranscript(ai, cp, "audio/mp3", speakers || ""));
        const transcripts = await Promise.all(transcriptPromises);
        
        fullTranscript = transcripts.join("\\n\\n");
      } else {
        console.log(`File is small (${req.file.size} bytes). Extracting transcript directly...`);
        fullTranscript = await extractTranscript(ai, req.file.path, req.file.mimetype, speakers || "");
      }
      
      if (!fullTranscript || fullTranscript.trim() === "") {
        throw new Error("Failed to extract transcript from audio.");
      }

      const prompt = `You are an expert meeting analyst.
Please analyze the provided meeting transcript.
${speakers ? "The speakers in this meeting are: " + speakers + ". Please assign their names correctly." : ""}
Extract the requested fields based on the provided schema.

Transcript:
${fullTranscript}`;

      console.log(`Transcript extracted (${fullTranscript.length} chars). Generating analysis...`);

      const response = await withRetry(() => ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: buildAnalysisSchema(selectedOptions, req.body.includeSentiment === 'true')
        }
      }));

      fs.unlinkSync(req.file.path);
      if (chunksDir && fs.existsSync(chunksDir)) {
        fs.rmSync(chunksDir, { recursive: true, force: true });
      }

      let analysisData: any = {};
      try {
        analysisData = JSON.parse(response.text || "{}");
      } catch (err) {
        return res.status(500).json({ error: "Failed to parse model response" });
      }
      
      // Ensure verbatim transcript is present
      analysisData.verbatimTranscript = fullTranscript;

      const verbatimRequested = selectedOptions.length === 0 || selectedOptions.includes("verbatim");

      res.json({ analysis: analysisData, verbatimRequested });
    } catch (error) {
      console.error("Error processing audio upload:", error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      if (chunksDir && fs.existsSync(chunksDir)) {
        fs.rmSync(chunksDir, { recursive: true, force: true });
      }
      res.status(500).json({ error: "Failed to process audio" });
    }
  });"""

content = content.replace(upload_endpoint_old, upload_endpoint_new)

with open('server.ts', 'w') as f:
    f.write(content)
