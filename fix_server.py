import re

with open('server.ts', 'r') as f:
    content = f.read()

target = r'${speakers ? \`The speakers in this meeting are: ${speakers}. Please assign their names correctly.\` : ""}'
replacement = '${speakers ? "The speakers in this meeting are: " + speakers + ". Please assign their names correctly." : ""}'

content = content.replace(target, replacement)
content = content.replace(r'\`', '`') # remove any stray escapes if any

with open('server.ts', 'w') as f:
    f.write(content)
