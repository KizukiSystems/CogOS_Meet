import re

with open('src/components/VerificationPanel.tsx', 'r') as f:
    content = f.read()

target = r'\{verification\.flagged && \('
replacement = """{verification.truncated && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Transcript was truncated before verification. Some claims may be incorrectly marked as gap/fabricated.
        </div>
      )}
      {verification.flagged && ("""

content = re.sub(target, replacement, content)

with open('src/components/VerificationPanel.tsx', 'w') as f:
    f.write(content)
