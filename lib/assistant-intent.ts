/** A narrow execution boundary, not a task classifier or executor. */
export function adviceOnlyRequest(request: string): boolean {
  const text = request.trim();
  if (/\b(?:suggestions?|advice|recommendations?|ideas)\s+only\b|\b(?:do not|don't)\s+(?:implement|apply)\b/i.test(text)) return true;
  const advisory = /^(?:please\s+)?(?:suggest\b|recommend\b|give me (?:some )?(?:ideas|options|suggestions)\b|what (?:should|could|would) (?:I|we)\b|what (?:can you do|do I do next|next)\b|how (?:do|can|would|should) (?:I|we)\b|explain\b|help me understand\b|(?:can|could|would) you (?:suggest|recommend|explain)\b)/i.test(text);
  if (!advisory) return false;
  // An explicit follow-on instruction is authorization; mere recommendation is not.
  const explicitExecution = /\b(?:and|then)\s+(?:please\s+)?(?:generate|create|edit|configure|connect|implement|apply|make|set up)\b|\b(?:please\s+)?(?:apply|implement)\s+(?:it|that|your recommendation|the suggested)\b/i.test(text);
  return !explicitExecution;
}

/**
 * Inventory questions ("What assets do I have?", "What's in my project?")
 * ask about the actual project, so they must run through the project
 * executor — the same path the in-project assistant uses — instead of
 * being answered conversationally, which produced a different (summary)
 * answer in the floating help panel than in the project panel.
 */
export function inventoryRequest(text: string): boolean {
  const t = text.toLowerCase();
  if (/\bhow\b/.test(t)) return false;
  return /\b(?:what|which)\b[^.?!]*\b(?:assets?|files?|media|images?|pictures?|photos?|videos?|music|songs?|sounds?|clips?)\b/.test(t)
    || /^\s*(?:list|show me|show)\b[^.?!]*\b(?:assets?|files?|media|project)\b/.test(t)
    || /\bwhat(?:'s| is) in (?:my|the|this) project\b/.test(t)
    || /\bwhat do i have\b/.test(t);
}
