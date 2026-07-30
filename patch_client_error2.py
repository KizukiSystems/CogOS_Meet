import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

target = r"""      const response = await fetch\('/api/analyze', \{
        method: 'POST',
        headers: \{ 'Content-Type': 'application/json' \},
        body: JSON.stringify\(\{ transcript: textToAnalyze \}\),
      \}\);
            
      const data = await response\.json\(\);"""

replacement = """      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: textToAnalyze }),
      });
      
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      
      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }"""

content = re.sub(target, replacement, content)

with open('src/App.tsx', 'w') as f:
    f.write(content)

