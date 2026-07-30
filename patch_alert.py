import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

content = content.replace('alert("Failed to analyze audio recording.");', 'alert(err instanceof Error ? err.message : "Failed to analyze audio recording.");')
content = content.replace('alert("Failed to analyze transcript.");', 'alert(err instanceof Error ? err.message : "Failed to analyze transcript.");')

with open('src/App.tsx', 'w') as f:
    f.write(content)

