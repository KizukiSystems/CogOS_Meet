import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

target = r"""      const response = await fetch\('/api/upload-audio', \{
        method: 'POST',
        body: formData,
      \}\);
      const data = await response.json\(\);"""

replacement = """      if (file.size > 30 * 1024 * 1024) {
        throw new Error("File is too large. Maximum size is 30MB.");
      }

      const response = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData,
      });
      
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error(response.status === 413 ? "File too large (server limit)" : `Server error: ${response.status} ${response.statusText}`);
      }
      
      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }"""

content = re.sub(target, replacement, content)

with open('src/App.tsx', 'w') as f:
    f.write(content)

