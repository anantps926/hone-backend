export function buildExplainPrompt(
  hobbyName: string,
  techniqueName: string,
  word: string,
  sentence: string
): string {
  return `You are explaining a hobby term to a learner in plain language.

Hobby: ${hobbyName}
Technique being studied: ${techniqueName}
Term to explain: "${word}"
Sentence where it appeared: "${sentence}"

Write a definition that:
- Uses no jargon unless you immediately explain it
- Gives a concrete example from ${hobbyName}
- Suggests 3 related terms the learner might want to understand next

Return ONLY valid JSON:
{
  "definition": "1-2 sentence plain English definition",
  "example": "One concrete example showing this in the context of ${hobbyName}",
  "related": ["term1", "term2", "term3"]
}`
}
