import type { Project } from "./project";

/** Describes saved executable references, never invents IDs or edits a project. */
export function executionContext(project: Project) {
  const controls = Array.isArray(project.controls) ? project.controls : [];
  const tools = Array.isArray(project.gameTools) ? project.gameTools : [];
  return {
    sequenceContract: {
      create: "Omit id entirely for a NEW sequence. Do not put a tool ID or selected button ID in sequences.id.",
      edit: "id must be one of existingSequenceIds. An ordinary Start button is not a saved sequence.",
      pressBehavior: "sequenceMode all runs every step on one press; per-press runs exactly one next step on each press and wraps after the last. Step overlayResult saves placement and entrance/exit none|fade|slide|zoom with entranceSeconds/exitSeconds. New internal action controls are hidden inside the combined button; existing dashboard buttons are preserved.",
      limits: "Maximum 30 steps and 300 seconds total delay. No nested sequences. No actions run while editing.",
      existingSequenceIds: controls.filter(c => c.action === "sequence").map(c => c.id),
      stepControlIds: controls.filter(c => c.action !== "sequence" && c.buttonMode !== "chain").map(c => ({ id: c.id, label: c.label, action: c.action })),
    },
    countdowns: tools.filter(t => t.enabled && t.type === "countdown").map(tool => {
      const start = controls.find(c => c.action === `tool.${tool.id}`);
      const show = controls.find(c => c.action === `timer.show.${tool.id}`);
      const toggle = controls.find(c => c.action === `timer.toggle.${tool.id}`);
      const reset = controls.find(c => c.action === `timer.reset.${tool.id}`);
      const hide = controls.find(c => c.action === `timer.hide.${tool.id}` || !!start && c.action === `result.hide.${start.id}`);
      return {
        id: tool.id, name: tool.name, seconds: Number(tool.config.seconds) || 10,
        startsFreshCountdown: start?.id || null, showsWithoutStarting: show?.id || null,
        pausesOrResumes: toggle?.id || null, resetsStoppedCountdown: reset?.id || null,
        hides: hide?.id || null,
        newAutoRemoveSequenceExample: start && hide && Number(tool.config.seconds || 10)<=300 ? {name:`Start and auto-hide ${tool.name}`,steps:[{controlId:start.id,delaySeconds:0},{controlId:hide.id,delaySeconds:Number(tool.config.seconds)||10}]} : null,
        recipe: start && hide ? "If automatic removal is requested and duration <=300: create a NEW sequence (no id), step controlId startsFreshCountdown delaySeconds 0, then controlId hides delaySeconds equal to the timer's saved seconds. Preserve existing manual controls. A new sequence is an additional button, not an edit of the existing Start control." : "Do not assume a toggle resets or starts a fresh duration. Ask for missing behavior or use supported separate controls; never fabricate IDs.",
        appearanceFields: "config.display numbers|bar|circle|numbers-bar|numbers-circle; config.appearance backgroundColor,textColor,accentColor,fontFamily,fontSize,borderRadius,shape,showTitle,transparentBackground,showBorder. Preserve seconds and placement unless requested.",
      };
    }),
  };
}
