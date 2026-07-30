import re

with open('server.ts', 'r') as f:
    content = f.read()

import_statement = """import os
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
"""
content = content.replace('import os from "os";\nimport fs from "fs";', import_statement)

# Now for buildAnalysisSchema - add required for all objects.
# Actually, the user asked to "Modify all responseSchema objects in server.ts to include the 'required' array property, explicitly listing all mandatory fields."
schema_code = """function buildAnalysisSchema(selectedOptions?: string[], includeSentiment = false) {
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
}"""
# Note that buildAnalysisSchema already has required on all objects where we defined them. 

# Let's write the actual server.ts replacement using python script or just create a new server.ts.
