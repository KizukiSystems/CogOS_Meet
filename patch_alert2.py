import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

target = r"""    \} catch \(err\) \{
      console.error\("Analysis failed", err\);
    \} finally \{"""

replacement = """    } catch (err) {
      console.error("Analysis failed", err);
      alert(err instanceof Error ? err.message : "Failed to analyze transcript.");
    } finally {"""

content = re.sub(target, replacement, content)

with open('src/App.tsx', 'w') as f:
    f.write(content)

