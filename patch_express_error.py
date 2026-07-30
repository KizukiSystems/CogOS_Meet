import re

with open('server.ts', 'r') as f:
    content = f.read()

target = r'  // Vite middleware for development'
replacement = """  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Express error:", err);
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: "File too large" });
    }
    res.status(500).json({ error: err.message || "Internal server error" });
  });

  // Vite middleware for development"""

content = content.replace(target, replacement)

with open('server.ts', 'w') as f:
    f.write(content)

