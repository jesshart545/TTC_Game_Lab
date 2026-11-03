/**
 * The generator voice catalog — ONE shared source for every surface that
 * offers a voice. The Workshop generator panel's Voice select and Jewel's
 * voice generation action both read this list, so the voices a creator can
 * pick by hand are exactly the voices they can ask Jewel for, by name or by
 * description ("the deep voice" is Roger — deep male). The generate-asset
 * route passes the chosen name straight to the voice provider, unchanged.
 */
export const GENERATOR_VOICES = [
  { name: "Aria", label: "Aria — warm female" },
  { name: "Sarah", label: "Sarah — clear female" },
  { name: "Charlotte", label: "Charlotte — soft female" },
  { name: "Alice", label: "Alice — bright female" },
  { name: "Jessica", label: "Jessica — friendly female" },
  { name: "Roger", label: "Roger — deep male" },
  { name: "George", label: "George — warm male" },
  { name: "Brian", label: "Brian — steady male" },
  { name: "Liam", label: "Liam — young male" },
  { name: "Bill", label: "Bill — older male" },
] as const;

export type GeneratorVoiceName = (typeof GENERATOR_VOICES)[number]["name"];

export const GENERATOR_VOICE_NAMES: readonly string[] = GENERATOR_VOICES.map(voice => voice.name);

export function isGeneratorVoice(value: unknown): value is GeneratorVoiceName {
  return typeof value === "string" && GENERATOR_VOICE_NAMES.includes(value);
}
