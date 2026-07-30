with open('server.ts', 'r') as f:
    content = f.read()

content = content.replace('let uploadedFile = await withRetry(() => ai.files.upload', 'let uploadedFile: any = await withRetry(() => ai.files.upload')
content = content.replace('let fileInfo = await ai.files.get', 'let fileInfo: any = await ai.files.get')
content = content.replace('const response = await withRetry(() => ai.models.generateContent', 'const response: any = await withRetry(() => ai.models.generateContent')

with open('server.ts', 'w') as f:
    f.write(content)
