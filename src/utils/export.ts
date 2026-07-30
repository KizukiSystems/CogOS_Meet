import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { Meeting } from "../types";

export const exportToMarkdown = (meeting: Meeting) => {
  let md = `# ${meeting.title}\n\n`;
  md += `Date: ${new Date(meeting.date).toLocaleDateString()}\n\n`;

  if (meeting.analysis) {
    if (meeting.analysis.verification) {
      if (meeting.analysis.verification.flagged) {
        md = `⚠️ WARNING: This analysis contains claims the transcript does not support.\n\n` + md;
      }
      md += `## Verification Pass\n\n`;
      md += `**Support Score:** ${meeting.analysis.verification.supportScore !== null ? meeting.analysis.verification.supportScore + '%' : 'No claims extracted'}\n\n`;
      md += `**Counts:**\n`;
      Object.entries(meeting.analysis.verification.counts).forEach(([verdict, count]) => {
        if (count > 0) md += `- ${verdict}: ${count}\n`;
      });
      md += `\n**Claims:**\n`;
      meeting.analysis.verification.claims.forEach(claim => {
        md += `- **[${claim.verdict.toUpperCase()}]** ${claim.claim}\n`;
        if (claim.quote) md += `  > "${claim.quote}"\n`;
      });
      md += `\n---\n\n`;
    } else {
      md += `**Verification:** Not verified\n\n---\n\n`;
    }
    if (meeting.analysis.sentiment) {
      md += `**Sentiment:** ${meeting.analysis.sentiment}\n\n---\n\n`;
    }

    if (meeting.analysis.executiveSummary) {
      md += `## Executive Summary\n\n${meeting.analysis.executiveSummary}\n\n`;
    }
    
    if (meeting.analysis.summary && !meeting.analysis.executiveSummary) {
      md += `## Meeting Summary\n\n${meeting.analysis.summary}\n\n`;
    }

    if (meeting.analysis.detailedSummary) {
      md += `## Detailed Summary\n\n${meeting.analysis.detailedSummary}\n\n`;
    }

    if (meeting.analysis.tldl) {
      md += `## TL;DL\n\n${meeting.analysis.tldl}\n\n`;
    }

    if (meeting.analysis.importantDates && meeting.analysis.importantDates.length > 0) {
      md += `## Important Dates\n\n`;
      meeting.analysis.importantDates.forEach(date => {
        md += `- ${date}\n`;
      });
      md += `\n`;
    }

    if (meeting.analysis.decisionLog && meeting.analysis.decisionLog.length > 0) {
      md += `## Decision Log\n\n`;
      meeting.analysis.decisionLog.forEach(decision => {
        md += `- ${decision}\n`;
      });
      md += `\n`;
    }

    if (meeting.analysis.actionItems && meeting.analysis.actionItems.length > 0) {
      md += `## Action Items\n\n`;
      meeting.analysis.actionItems.forEach(item => {
        md += `- [${item.completed ? 'x' : ' '}] **${item.owner}**: ${item.task}\n`;
      });
      md += `\n`;
    }

    if (meeting.analysis.perspectives) {
      md += `## Multi-Perspective Synthesis\n\n`;
      if (meeting.analysis.perspectives.operational) {
        md += `### Operational\n${meeting.analysis.perspectives.operational}\n\n`;
      }
      if (meeting.analysis.perspectives.empathy) {
        md += `### Empathy\n${meeting.analysis.perspectives.empathy}\n\n`;
      }
    }
  }

  if (!meeting.hideTranscript) {
    md += `## Transcript\n\n${meeting.transcript}\n`;
  } else {
    md += `## Transcript\n\nSource transcript is hidden because verbatim was not requested.\n`;
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${meeting.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportToWord = async (meeting: Meeting) => {
  const children: any[] = [
    new Paragraph({
      text: meeting.title,
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Date: ${new Date(meeting.date).toLocaleDateString()}`, bold: true }),
      ],
      spacing: { after: 400 },
    })
  ];

  if (meeting.analysis) {
    if (meeting.analysis.verification) {
      if (meeting.analysis.verification.flagged) {
        children.unshift(new Paragraph({ children: [new TextRun({ text: "⚠️ WARNING: This analysis contains claims the transcript does not support.", bold: true })] }));
      }
      children.push(new Paragraph({ text: "Verification Pass", heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ text: `Support Score: ${meeting.analysis.verification.supportScore !== null ? meeting.analysis.verification.supportScore + '%' : 'No claims extracted'}` }));
      
      const countsStr = Object.entries(meeting.analysis.verification.counts)
        .filter(([_, count]) => (count as number) > 0)
        .map(([verdict, count]) => `${verdict}: ${count}`)
        .join(', ');
      children.push(new Paragraph({ text: `Counts: ${countsStr}`, spacing: { after: 200 } }));
      
      meeting.analysis.verification.claims.forEach(claim => {
        children.push(new Paragraph({ 
          children: [
            new TextRun({ text: `[${claim.verdict.toUpperCase()}] `, bold: true }),
            new TextRun({ text: claim.claim }),
          ]
        }));
        if (claim.quote) {
          children.push(new Paragraph({ children: [new TextRun({ text: `"${claim.quote}"`, italics: true })] }));
        }
      });
      children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
    } else {
      children.push(new Paragraph({ text: "Verification: Not verified", spacing: { after: 200 } }));
    }
    if (meeting.analysis.sentiment) {
      children.push(new Paragraph({ text: `Sentiment: ${meeting.analysis.sentiment}`, spacing: { after: 200 } }));
    }

    if (meeting.analysis.executiveSummary) {
      children.push(new Paragraph({ text: "Executive Summary", heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ text: meeting.analysis.executiveSummary, spacing: { after: 200 } }));
    }

    if (meeting.analysis.summary && !meeting.analysis.executiveSummary) {
      children.push(new Paragraph({ text: "Meeting Summary", heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ text: meeting.analysis.summary, spacing: { after: 200 } }));
    }

    if (meeting.analysis.detailedSummary) {
      children.push(new Paragraph({ text: "Detailed Summary", heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ text: meeting.analysis.detailedSummary, spacing: { after: 200 } }));
    }

    if (meeting.analysis.tldl) {
      children.push(new Paragraph({ text: "TL;DL", heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ text: meeting.analysis.tldl, spacing: { after: 200 } }));
    }

    if (meeting.analysis.importantDates && meeting.analysis.importantDates.length > 0) {
      children.push(new Paragraph({ text: "Important Dates", heading: HeadingLevel.HEADING_2 }));
      meeting.analysis.importantDates.forEach(date => {
        children.push(new Paragraph({ text: date, bullet: { level: 0 } }));
      });
      children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
    }

    if (meeting.analysis.decisionLog && meeting.analysis.decisionLog.length > 0) {
      children.push(new Paragraph({ text: "Decision Log", heading: HeadingLevel.HEADING_2 }));
      meeting.analysis.decisionLog.forEach(decision => {
        children.push(new Paragraph({ text: decision, bullet: { level: 0 } }));
      });
      children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
    }

    if (meeting.analysis.actionItems && meeting.analysis.actionItems.length > 0) {
      children.push(new Paragraph({ text: "Action Items", heading: HeadingLevel.HEADING_2 }));
      meeting.analysis.actionItems.forEach(item => {
        children.push(new Paragraph({ 
          children: [
            new TextRun({ text: `[${item.completed ? 'x' : ' '}] ` }),
            new TextRun({ text: `${item.owner}: `, bold: true }),
            new TextRun({ text: item.task }),
          ],
          bullet: { level: 0 } 
        }));
      });
      children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
    }

    if (meeting.analysis.perspectives) {
      children.push(new Paragraph({ text: "Multi-Perspective Synthesis", heading: HeadingLevel.HEADING_2 }));
      if (meeting.analysis.perspectives.operational) {
        children.push(new Paragraph({ text: "Operational", heading: HeadingLevel.HEADING_3 }));
        children.push(new Paragraph({ text: meeting.analysis.perspectives.operational, spacing: { after: 200 } }));
      }
      if (meeting.analysis.perspectives.empathy) {
        children.push(new Paragraph({ text: "Empathy", heading: HeadingLevel.HEADING_3 }));
        children.push(new Paragraph({ text: meeting.analysis.perspectives.empathy, spacing: { after: 200 } }));
      }
    }
  }

  children.push(new Paragraph({ text: "Transcript", heading: HeadingLevel.HEADING_2 }));
  if (!meeting.hideTranscript) {
    const transcriptLines = meeting.transcript.split('\n');
    transcriptLines.forEach(line => {
      children.push(new Paragraph({ text: line }));
    });
  } else {
    children.push(new Paragraph({ text: "Source transcript is hidden because verbatim was not requested." }));
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${meeting.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`;
  a.click();
  URL.revokeObjectURL(url);
};
