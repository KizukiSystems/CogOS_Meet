import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

content = content.replace('ISNAD Protected', 'Verified Pass')
content = content.replace('Codette Synthesis', 'Analysis')

with open('src/App.tsx', 'w') as f:
    f.write(content)
