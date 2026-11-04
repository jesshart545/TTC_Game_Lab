"use client";

import { useState } from "react";
import type { ProjectAsset, TalkSlide } from "../lib/project";
import type { WorkflowStepState } from "../lib/workflow-progress";
import { assetBackdropText, backgroundAssets, findSignAsset } from "../lib/backdrop-text";
import { assetCategory } from "../lib/asset-folders";
import { quizQuestionsOf } from "../lib/quiz";
import { isVideo } from "../lib/workshop-libraries";
import {
  BACKDROP_CHANGES, DEMO_COLOR_PAIRS, DEMO_FONTS, EXAMPLE_QUIZ, QUIZ_CHANGES,
  RESEARCH_CHANGES, SAMPLE_RESEARCH, SIGN_CHANGES, SLIDES_CHANGES, TALK_STEPS,
  YOUTUBE_CHANGES, demoBackdrop, demoTextSpec,
} from "../lib/talkshow-path";
import AssetThumbnail from "./AssetThumbnail";
import BackdropTextLayer from "./BackdropText";
import { ChangeList } from "./GameshowWorkshop";
import { TalkAskStrip, TalkStepShell, type TalkshowWorkshopProps } from "./TalkshowWorkshop";

type ScreenProps = TalkshowWorkshopProps & { step?: WorkflowStepState };

const assetKey = (asset: ProjectAsset) => asset.storageKey || asset.name;

function BackdropStageMedia({ asset }: { asset: ProjectAsset }) {
  if (!asset.url) return <ExampleStageMedia />;
  if (isVideo(asset)) {
    return <video src={asset.url} autoPlay loop muted playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />;
  }
  return <img src={asset.url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />;
}

/** The pictured example stage for an empty project: the site's own Talk
 * Show artwork, so a step demonstrates with a real picture — never a flat
 * gradient void — exactly as the Gameshow media step labels its example
 * stage. Labelled as an example wherever it stands in. */
function ExampleStageMedia() {
  return <img className="gsw-bg" src="/redesign/kind-talkshow.webp" alt="" />;
}

/** Font + color play-state shared by the sign and backdrop demonstrations. */
function useLookPlay() {
  const [fontIndex, setFontIndex] = useState<number | null>(null);
  const [pairIndex, setPairIndex] = useState<number | null>(null);
  return { fontIndex, pairIndex, setFontIndex, setPairIndex };
}

function LookControls({ fontIndex, pairIndex, onFont, onPair }: {
  fontIndex: number | null; pairIndex: number | null;
  onFont: (index: number) => void; onPair: (index: number) => void;
}) {
  return (
    <>
      <div className="gsw-seclabel">Lettering — the site’s display fonts</div>
      <div className="gsw-chipsrow">
        {DEMO_FONTS.slice(0, 6).map((font, i) => (
          <button key={font.family} type="button" className={"gsw-vchip" + (fontIndex === i ? " gold" : "")} style={{ fontFamily: font.family, fontSize: 14 }} onClick={() => onFont(i)}>{font.name}</button>
        ))}
      </div>
      <div className="gsw-seclabel" style={{ marginTop: 14 }}>…and its colors</div>
      <div className="gsw-chipsrow">
        {DEMO_COLOR_PAIRS.map((pair, i) => (
          <button key={pair.name} type="button" className={"gsw-vchip" + (pairIndex === i ? " gold" : "")} onClick={() => onPair(i)}>
            <span style={{ color: pair.textColor, textShadow: "0 1px 6px rgba(0,0,0,.8)" }}>Aa</span> {pair.name}
          </button>
        ))}
      </div>
    </>
  );
}

/* ---------------- Step 1 · Name & sign your show ---------------- */

export function SignStep(props: ScreenProps) {
  const { project, doors, onAskJewel: onAsk, onSaveProject } = props;
  const signAsset = findSignAsset(project);
  const demoAsset = signAsset || demoBackdrop(project);
  const baseSpec = demoTextSpec(project, demoAsset);
  const look = useLookPlay();
  const spec = {
    ...baseSpec,
    ...(look.fontIndex !== null ? { fontFamily: DEMO_FONTS[look.fontIndex].family } : {}),
    ...(look.pairIndex !== null ? { textColor: DEMO_COLOR_PAIRS[look.pairIndex].textColor, accentColor: DEMO_COLOR_PAIRS[look.pairIndex].accentColor } : {}),
  };
  const uploadedSign = signAsset && signAsset.sign === true && !assetBackdropText(signAsset) ? signAsset : null;
  const theme = (project.gamePlan?.theme || "").trim();
  return (
    <TalkStepShell stepId="sign" step={props.step}>
      <div className="gsw-cols">
        <div>
          <span className="gsw-demotag">Live demonstration — your sign, lettered for real</span>
          <div className="gsw-stage-visual" style={{ minHeight: 300, position: "relative" }}>
            {demoAsset ? <BackdropStageMedia asset={demoAsset} /> : <ExampleStageMedia />}
            {!uploadedSign && <BackdropTextLayer spec={spec} />}
            <div className="gsw-shade" style={{ background: "linear-gradient(180deg, transparent 55%, rgba(8,6,14,.72))" }} />
            <div style={{ position: "absolute", left: 14, bottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span className="gsw-vchip gold">{uploadedSign ? `Your uploaded sign · ${uploadedSign.name}` : signAsset ? `Your sign · ${signAsset.name}` : "Demonstration · Jewel letters your title over artwork like this"}</span>
              {signAsset && !uploadedSign && <span className="gsw-vchip">Lettering is a real text layer — never baked in</span>}
              {theme && <span className="gsw-vchip">Theme · {theme}</span>}
            </div>
          </div>
          {!uploadedSign && (
            <>
              <LookControls fontIndex={look.fontIndex} pairIndex={look.pairIndex} onFont={look.setFontIndex} onPair={look.setPairIndex} />
              {(look.fontIndex !== null || look.pairIndex !== null) && (
                <div className="gsw-chipsrow" style={{ marginTop: 12 }}>
                  <button type="button" className="gsw-jchip" onClick={() => onAsk(`Letter my sign “${spec.text}” in ${DEMO_FONTS[look.fontIndex ?? 0].name}, ${DEMO_COLOR_PAIRS[look.pairIndex ?? 0].name} colors`)}>
                    Ask Jewel for this exact look
                  </button>
                </div>
              )}
            </>
          )}

          <div className="gsw-seclabel" style={{ marginTop: 22 }}>Your name &amp; theme — the short version, set right here</div>
          <div className="gsw-grid2">
            <div className="gsw-card">
              <div className="tsw-fields">
                <label>Show name
                  <input
                    type="text"
                    value={project.name === "New Project" ? "" : project.name}
                    placeholder="Example: The Cozy Corner"
                    onChange={event => onSaveProject({ ...project, name: event.target.value, updatedAt: "just now" })}
                  />
                </label>
                <label>Theme &amp; style
                  <textarea
                    rows={2}
                    value={project.gamePlan?.theme || ""}
                    placeholder="Example: a warm spiritual-and-life talk show"
                    onChange={event => onSaveProject({ ...project, gamePlan: { ...project.gamePlan, theme: event.target.value }, updatedAt: "just now" })}
                  />
                </label>
              </div>
              <p style={{ marginTop: 8 }}>Saved as you type, into the same fields as always — the theme aims Jewel’s research.</p>
            </div>
            <div className="gsw-card">
              <h4>Have your own sign?</h4>
              <p>Upload a sign you made yourself and it is used instead of Jewel’s — exactly as it is, nothing redrawn.</p>
              <div className="gsw-chipsrow">
                <button type="button" className="gsw-demobtn" onClick={doors.uploadSign}>Upload your own sign</button>
              </div>
            </div>
          </div>
          <ChangeList title="What you can change — your sign" items={SIGN_CHANGES} onAsk={onAsk} />
        </div>
        <TalkAskStrip {...props} stepId="sign" extra={TALK_STEPS.sign.adjust} />
      </div>
    </TalkStepShell>
  );
}

/* ---------------- Step 2 · Make your backdrops ---------------- */

export function BackdropsStep(props: ScreenProps) {
  const { project, doors, onAskJewel: onAsk } = props;
  const backgrounds = backgroundAssets(project);
  const animated = backgrounds.find(asset => isVideo(asset)) || null;
  const artistic = backgrounds.find(asset => !isVideo(asset)) || null;
  const hero = animated || artistic;
  const textAsset = demoBackdrop(project);
  const baseSpec = demoTextSpec(project, textAsset);
  const look = useLookPlay();
  const spec = {
    ...baseSpec,
    ...(look.fontIndex !== null ? { fontFamily: DEMO_FONTS[look.fontIndex].family } : {}),
    ...(look.pairIndex !== null ? { textColor: DEMO_COLOR_PAIRS[look.pairIndex].textColor, accentColor: DEMO_COLOR_PAIRS[look.pairIndex].accentColor } : {}),
  };
  return (
    <TalkStepShell stepId="backdrops" step={props.step}>
      <div className="gsw-cols">
        <div>
          <span className="gsw-demotag">Live demonstration — a backdrop, playing</span>
          <div className="gsw-stage-visual" style={{ minHeight: 280, position: "relative" }}>
            {hero ? <BackdropStageMedia asset={hero} /> : <ExampleStageMedia />}
            <div style={{ position: "absolute", left: 14, top: 10 }}>
              <span className="gsw-vchip gold">{animated ? `Animated — playing · ${animated.name}` : artistic ? `Artistic · ${artistic.name}` : "Example stage — your backdrop will play here"}</span>
            </div>
          </div>
          <p className="gsw-demostatus" style={{ marginTop: 8 }}>
            {animated ? "The real backdrop, looping the way it loops on your overlay." : artistic ? "A still, artistic backdrop — ask Jewel for an animated one and it plays in this same frame." : "No backdrop yet — the first one Jewel makes for you plays right here."}
          </p>

          <div className="gsw-seclabel" style={{ marginTop: 22 }}>Words over a backdrop — switch the look, live</div>
          <div className="gsw-stage-visual" style={{ minHeight: 240, position: "relative" }}>
            {textAsset ? <BackdropStageMedia asset={textAsset} /> : <ExampleStageMedia />}
            <BackdropTextLayer spec={spec} />
          </div>
          <LookControls fontIndex={look.fontIndex} pairIndex={look.pairIndex} onFont={look.setFontIndex} onPair={look.setPairIndex} />
          <p className="gsw-demostatus" style={{ marginTop: 8 }}>The lettering is a real text layer — crisp at any size, never baked into the artwork.</p>

          <div className="gsw-seclabel" style={{ marginTop: 22 }}>Your backdrops</div>
          {backgrounds.length ? (
            <div className="gsw-shelf">
              {backgrounds.map(asset => {
                const lettering = assetBackdropText(asset);
                return (
                  <button key={assetKey(asset)} type="button" className="gsw-asset" onClick={() => doors.applyBackground(assetKey(asset))}>
                    <AssetThumbnail asset={asset} kind={assetCategory(asset)} />
                    <div className="gsw-shade" />
                    <span className="gsw-ak">{isVideo(asset) ? "Animated backdrop" : "Backdrop"}{asset.sign ? " · Your sign" : ""}</span>
                    <span className="gsw-an">{asset.name}<br />
                      <span style={{ color: "#cfc8e6", fontWeight: 600, fontSize: 12 }}>{asset.inProject ? "✓ On your overlay — tap another to switch" : "Tap to put it on your overlay"}{lettering ? ` · Lettered: “${lettering.text}”` : ""}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="gsw-hint">Nothing here yet — your first backdrop lands on this shelf.</p>
          )}
          <ChangeList title="What you can change — a backdrop" items={BACKDROP_CHANGES} onAsk={onAsk} />
        </div>
        <TalkAskStrip {...props} stepId="backdrops" extra={TALK_STEPS.backdrops.adjust} />
      </div>
    </TalkStepShell>
  );
}

/* ---------------- Step 3 · Research with Jewel ---------------- */

export function ResearchStep(props: ScreenProps) {
  const { project, onNavigateStep, onAskJewel: onAsk } = props;
  const theme = (project.gamePlan?.theme || "").trim();
  const researched = project.workflowProgress?.researched === true;
  const [sampleRan, setSampleRan] = useState(false);
  return (
    <TalkStepShell stepId="research" step={props.step}>
      <div className="gsw-cols">
        <div>
          <div className="gsw-seclabel">Your research compass — the theme &amp; style of your show</div>
          <div className="gsw-card">
            <h4>{theme || "No theme & style set yet"}</h4>
            <p>{theme
              ? "This aims Jewel’s searching — a science classroom and a gossip show research very differently."
              : "Set it on the Name & sign step — it tells Jewel what kind of show this is, so she knows what to look for."}</p>
            {!theme && <div className="gsw-chipsrow"><button type="button" className="gsw-demobtn gold" onClick={() => onNavigateStep(0, "sign")}>Set my theme &amp; style</button></div>}
          </div>

          <span className="gsw-demotag" style={{ marginTop: 22 }}>Demonstration — run a sample search</span>
          <div className="gsw-qcard" style={{ textAlign: "left" }}>
            <div className="gsw-qk">Sample question · a classroom show</div>
            <div className="gsw-qq" style={{ fontSize: 17 }}>{SAMPLE_RESEARCH.question}</div>
            {!sampleRan && (
              <div className="gsw-chipsrow" style={{ justifyContent: "center", marginTop: 14 }}>
                <button type="button" className="gsw-demobtn gold" onClick={() => setSampleRan(true)}>Run the sample search</button>
              </div>
            )}
          </div>
          {sampleRan && (
            <>
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {SAMPLE_RESEARCH.findings.map(finding => (
                  <div key={finding.text} className="gsw-card">
                    <p style={{ margin: 0 }}>{finding.text}</p>
                    <div className="gsw-chipsrow"><span className="gsw-vchip">{finding.source}</span></div>
                  </div>
                ))}
              </div>
              <p className="gsw-demostatus" style={{ marginTop: 10 }}>{SAMPLE_RESEARCH.note}</p>
            </>
          )}

          <div className="gsw-seclabel" style={{ marginTop: 22 }}>Then the research goes to work</div>
          <div className="gsw-grid2">
            <div className="gsw-card"><h4>A backdrop shaped by findings</h4><p>Jewel briefs your backdrop’s artwork with what she found — the places, the facts, the mood.</p></div>
            <div className="gsw-card"><h4>A quiz built from sources</h4><p>Or the findings become questions your audience can answer from what your show taught them.</p></div>
          </div>
          <p className="gsw-demostatus" style={{ marginTop: 10 }}>
            {researched ? "✓ Jewel has researched in this project — findings and sources are in your conversation with her." : "No research yet — the first lookup you ask Jewel for checks this step off."}
          </p>
          <ChangeList title="What you can change — the research" items={RESEARCH_CHANGES} onAsk={onAsk} />
        </div>
        <TalkAskStrip {...props} stepId="research" extra={TALK_STEPS.research.adjust} />
      </div>
    </TalkStepShell>
  );
}

/* ---------------- Step 4 · Build a quiz ---------------- */

type DemoQuizQuestion = { question: string; options: string[]; correctIndex: number };

function QuizFlip({ q }: { q: DemoQuizQuestion }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className="gsw-flipwrap">
      <div
        className={"gsw-flip gsw-mini-flip" + (flipped ? " flipped" : "")}
        onClick={() => setFlipped(f => !f)}
        role="button" aria-label={`Flip the quiz card: ${q.question}`}
      >
        <div className="gsw-face"><div className="gsw-mini-face" style={{ height: "100%" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.2, color: "#20e8ff", textTransform: "uppercase" }}>Quiz · Question</div>
          <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.35, marginTop: 6 }}>{q.question}</div>
          <div style={{ marginTop: 10, display: "grid", gap: 5 }}>
            {q.options.map((option, i) => (
              <span key={i} style={{ fontSize: 13.5, color: "#d9d3ec" }}><b style={{ color: "#e9c979" }}>{String.fromCharCode(65 + i)}.</b> {option}</span>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#948bb3", marginTop: 10 }}>Tap to flip — the answer is on the back, for your eyes until the reveal.</div>
        </div></div>
        <div className="gsw-face back"><div className="gsw-mini-face" style={{ height: "100%" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.2, color: "#20e8ff", textTransform: "uppercase" }}>Correct answer</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{String.fromCharCode(65 + q.correctIndex)}. {q.options[q.correctIndex]}</div>
          <div style={{ fontSize: 12, color: "#948bb3", marginTop: 6 }}>Your audience sees the choices — never which one is right — until you reveal it during the show.</div>
        </div></div>
      </div>
    </div>
  );
}

export function QuizStep(props: ScreenProps) {
  const { project, doors, onAskJewel: onAsk } = props;
  const quizTool = (project.gameTools || []).find(tool => tool.enabled && tool.type === "trivia-list" && quizQuestionsOf(tool).length > 0);
  const saved = quizTool ? quizQuestionsOf(quizTool) : [];
  const questions: DemoQuizQuestion[] = saved.length
    ? saved.slice(0, 3).map(q => ({ question: q.question, options: q.options, correctIndex: q.correctIndex }))
    : EXAMPLE_QUIZ;
  const cardTool = quizTool ? (project.gameTools || []).find(tool => tool.enabled && tool.type === "question-card" && tool.config.poolId === quizTool.id) : undefined;
  return (
    <TalkStepShell stepId="quiz" step={props.step}>
      <div className="gsw-cols">
        <div>
          <span className="gsw-demotag">Live demonstration — tap a card to see the answer side</span>
          {!saved.length && <p className="gsw-hint" style={{ marginBottom: 10 }}>Example questions — yours will be saved here, flipped the same way.</p>}
          <div className="gsw-grid2">
            {questions.map((q, i) => <QuizFlip key={i} q={q} />)}
          </div>
          {quizTool ? (
            <div className="gsw-card" style={{ marginTop: 14 }}>
              <h4>{quizTool.name} · {saved.length} multiple-choice question{saved.length === 1 ? "" : "s"}</h4>
              <p>{cardTool
                ? "Your quiz cards are ready — they draw from this list, choices showing, answer held for the reveal."
                : "Your questions are saved. They present on quiz cards — make the cards yourself with the Workshop’s card maker, or ask Jewel to create them."}</p>
              <div className="gsw-chipsrow">
                <button type="button" className="gsw-jchip" onClick={() => doors.openListEditor(quizTool.id)}>Open the quiz list</button>
                {!cardTool && <button type="button" className="gsw-jchip" onClick={doors.createQuizCards}>Create the cards yourself</button>}
                {!cardTool && <button type="button" className="gsw-jchip" onClick={() => onAsk("Create question cards for my quiz")}>Ask Jewel to make the cards</button>}
                {cardTool && <button type="button" className="gsw-jchip" onClick={() => doors.openCardEditor(cardTool.id)}>Open the card designer</button>}
              </div>
            </div>
          ) : (
            <div className="gsw-card" style={{ marginTop: 14 }}>
              <h4>No quiz yet</h4>
              <p>Tell Jewel your topic — or let her build the quiz from the research you did together — and the questions land here with their choices.</p>
            </div>
          )}
          <ChangeList title="What you can change — a quiz" items={QUIZ_CHANGES} onAsk={onAsk} />
        </div>
        <TalkAskStrip {...props} stepId="quiz" extra={TALK_STEPS.quiz.adjust} />
      </div>
    </TalkStepShell>
  );
}

/* ---------------- Step 5 · Add YouTube ---------------- */

export function YoutubeStep(props: ScreenProps) {
  const { project, doors, onAskJewel: onAsk } = props;
  const tool = (project.gameTools || []).find(t => t.enabled && t.type === "youtube");
  const backdrop = demoBackdrop(project);
  return (
    <TalkStepShell stepId="youtube" step={props.step}>
      <div className="gsw-cols">
        <div>
          <span className="gsw-demotag">Demonstration — the video moment, on your stage</span>
          <div className="gsw-stage-visual" style={{ minHeight: 280, position: "relative" }}>
            {backdrop ? <BackdropStageMedia asset={backdrop} /> : <ExampleStageMedia />}
            <div className="gsw-shade" style={{ background: "rgba(8,6,14,.38)" }} />
            <div className="tsw-ytcenter"><div className="tsw-ytplay" aria-hidden="true">▶</div></div>
            <div style={{ position: "absolute", left: 14, bottom: 12 }}>
              <span className="gsw-vchip gold">{tool ? "YouTube · in your toolbox — it plays here when you send it" : "Plays here — only when you send it, from your dashboard"}</span>
            </div>
          </div>
          {tool ? (
            <div className="gsw-card" style={{ marginTop: 14 }}>
              <h4>✓ YouTube is in your toolbox</h4>
              <p>It waits there until Set the Stage, where you decide which dashboard button opens it.</p>
              <div className="gsw-chipsrow"><button type="button" className="gsw-jchip" onClick={doors.showSavedWork}>See it in your toolbox</button></div>
            </div>
          ) : (
            <div className="gsw-card" style={{ marginTop: 14 }}>
              <h4>Not added yet</h4>
              <p>Add the YouTube feature with the existing tool — or ask Jewel to add it for you.</p>
              <div className="gsw-chipsrow"><button type="button" className="gsw-demobtn gold" onClick={doors.addYoutube}>Add YouTube</button></div>
            </div>
          )}
          <ChangeList title="What you can change — YouTube" items={YOUTUBE_CHANGES} onAsk={onAsk} />
        </div>
        <TalkAskStrip {...props} stepId="youtube" extra={TALK_STEPS.youtube.adjust} />
      </div>
    </TalkStepShell>
  );
}

/* ---------------- Step 6 · Arrange your slides ---------------- */

type SlideCandidate = { kind: TalkSlide["kind"]; label: string; refKey: string; asset: ProjectAsset | null };

function slideCandidates(project: TalkshowWorkshopProps["project"]): SlideCandidate[] {
  const out: SlideCandidate[] = [];
  const sign = findSignAsset(project);
  if (sign) out.push({ kind: "sign", label: `Your sign — ${project.name || sign.name}`, refKey: assetKey(sign), asset: sign });
  for (const asset of backgroundAssets(project)) {
    if (sign && assetKey(asset) === assetKey(sign)) continue;
    out.push({ kind: "backdrop", label: asset.name, refKey: assetKey(asset), asset });
  }
  for (const tool of project.gameTools || []) {
    if (!tool.enabled) continue;
    if (tool.type === "trivia-list" && quizQuestionsOf(tool).length > 0) out.push({ kind: "quiz", label: `Quiz — ${tool.name}`, refKey: tool.id, asset: null });
    if (tool.type === "youtube") out.push({ kind: "youtube", label: "YouTube video moment", refKey: tool.id, asset: null });
  }
  for (const comp of project.compositions || []) out.push({ kind: "composition", label: `Package — ${comp.name}`, refKey: comp.id, asset: null });
  for (const asset of project.assets || []) {
    if (asset.inProject && asset.role !== "background") out.push({ kind: "media", label: asset.name, refKey: assetKey(asset), asset });
  }
  return out;
}

/** The asset a saved slide points at, when it points at one — so the deck
 * shows the slide's real picture, not a text row. */
function slideAsset(project: TalkshowWorkshopProps["project"], slide: TalkSlide): ProjectAsset | null {
  if (slide.kind !== "sign" && slide.kind !== "backdrop" && slide.kind !== "media") return null;
  return (project.assets || []).find(asset => assetKey(asset) === slide.refKey) || null;
}

/** A slide's face when it has no picture of its own — the same glyphs the
 * toolbox tiles use, on a stage-colored card. */
function SlideFace({ kind }: { kind: TalkSlide["kind"] }) {
  const glyph = kind === "quiz" ? "?" : kind === "youtube" ? "▶" : kind === "composition" ? "⚡" : "▭";
  return <span className="tsw-slideface" aria-hidden="true">{glyph}</span>;
}

const SLIDE_KIND_LABELS: Record<TalkSlide["kind"], string> = {
  sign: "Sign", backdrop: "Backdrop", quiz: "Quiz", youtube: "YouTube", media: "Media", composition: "Package",
};

export function SlidesStep(props: ScreenProps) {
  const { project, onSaveProject, onAskJewel: onAsk } = props;
  const deck: TalkSlide[] = Array.isArray(project.talkDeck) ? project.talkDeck : [];
  const candidates = slideCandidates(project);
  const inDeck = (candidate: SlideCandidate) => deck.some(slide => slide.kind === candidate.kind && slide.refKey === candidate.refKey);
  const save = (next: TalkSlide[]) => onSaveProject({ ...project, talkDeck: next });
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= deck.length) return;
    const next = [...deck];
    [next[index], next[target]] = [next[target], next[index]];
    save(next);
  };
  return (
    <TalkStepShell stepId="slides" step={props.step}>
      <div className="gsw-cols">
        <div>
          <div className="gsw-seclabel">Your deck — in the order your show will follow</div>
          {deck.length ? (
            <div className="tsw-deckstrip">
              {deck.map((slide, i) => {
                const asset = slideAsset(project, slide);
                return (
                  <div key={slide.id} className="tsw-slide">
                    <div className="tsw-slidevis">
                      {asset ? <AssetThumbnail asset={asset} kind={assetCategory(asset)} /> : slide.kind === "backdrop" || slide.kind === "sign" ? <ExampleStageMedia /> : <SlideFace kind={slide.kind} />}
                      <span className="tsw-sliden">{i + 1}</span>
                    </div>
                    <div className="tsw-slidelabel">{slide.label}</div>
                    <div className="tsw-slidekind">{SLIDE_KIND_LABELS[slide.kind]}</div>
                    <span className="tsw-deckbtns">
                      <button type="button" aria-label={`Move ${slide.label} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                      <button type="button" aria-label={`Move ${slide.label} down`} disabled={i === deck.length - 1} onClick={() => move(i, 1)}>↓</button>
                      <button type="button" aria-label={`Remove ${slide.label} from the deck`} onClick={() => save(deck.filter((_, j) => j !== i))}>✕</button>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div className="gsw-seclabel" style={{ marginBottom: 8 }}>Example deck — yours will line up like this</div>
              <div className="tsw-deckstrip" aria-hidden="true">
                {([["sign", "Your sign"], ["backdrop", "Opening backdrop"], ["quiz", "Quiz"], ["youtube", "Video moment"]] as [TalkSlide["kind"], string][]).map(([kind, label], i) => (
                  <div key={kind} className="tsw-slide">
                    <div className="tsw-slidevis">
                      {kind === "sign" || kind === "backdrop" ? <ExampleStageMedia /> : <SlideFace kind={kind} />}
                      <span className="tsw-sliden">{i + 1}</span>
                    </div>
                    <div className="tsw-slidelabel">{label}</div>
                    <div className="tsw-slidekind">Example</div>
                  </div>
                ))}
              </div>
              <p className="gsw-hint">Your deck is empty — add the moments you’ve made below, in the order you’ll present them.</p>
            </>
          )}
          <p className="gsw-demostatus" style={{ marginTop: 8 }}>Preparing only — the clickers that run your slides live arrive in Set the Stage.</p>

          <div className="gsw-seclabel" style={{ marginTop: 22 }}>What you’ve made — add it to the deck</div>
          {candidates.length ? (
            <div className="gsw-shelf">
              {candidates.map(candidate => candidate.asset ? (
                <button
                  key={`${candidate.kind}:${candidate.refKey}`} type="button" className="gsw-asset"
                  disabled={inDeck(candidate)}
                  onClick={() => save([...deck, { id: crypto.randomUUID(), kind: candidate.kind, label: candidate.label, refKey: candidate.refKey }])}
                >
                  <AssetThumbnail asset={candidate.asset} kind={assetCategory(candidate.asset)} />
                  <div className="gsw-shade" />
                  <span className="gsw-ak">{SLIDE_KIND_LABELS[candidate.kind]}</span>
                  <span className="gsw-an">{candidate.label}<br />
                    <span style={{ color: "#cfc8e6", fontWeight: 600, fontSize: 12 }}>{inDeck(candidate) ? "✓ In your deck" : "Tap to add"}</span>
                  </span>
                </button>
              ) : (
                <button
                  key={`${candidate.kind}:${candidate.refKey}`} type="button" className="gsw-asset plain"
                  disabled={inDeck(candidate)}
                  onClick={() => save([...deck, { id: crypto.randomUUID(), kind: candidate.kind, label: candidate.label, refKey: candidate.refKey }])}
                >
                  <span className="gsw-ak">{SLIDE_KIND_LABELS[candidate.kind]}</span>
                  <span className="gsw-an" style={{ position: "static" }}>{candidate.label}<br />
                    <span style={{ color: "#948bb3", fontWeight: 600, fontSize: 12 }}>{inDeck(candidate) ? "✓ In your deck" : "Tap to add"}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="gsw-hint">Nothing to arrange yet — your sign, backdrops, quiz and packages appear here as you make them.</p>
          )}
          <ChangeList title="What you can change — your slides" items={SLIDES_CHANGES} onAsk={onAsk} />
        </div>
        <TalkAskStrip {...props} stepId="slides" extra={TALK_STEPS.slides.adjust} />
      </div>
    </TalkStepShell>
  );
}

/* ---------------- Step 7 · Review your toolbox ---------------- */

export function ToolboxStep(props: ScreenProps) {
  const { project, doors, onNavigateStep } = props;
  const tools = project.gameTools || [];
  const backgrounds = backgroundAssets(project);
  const deck = Array.isArray(project.talkDeck) ? project.talkDeck : [];
  const firstCard = tools.find(tool => tool.type === "question-card" || tool.type === "blank-card");
  const firstList = tools.find(tool => tool.type === "trivia-list");
  const toolStatus = (tool: (typeof tools)[number]) => tool.type === "trivia-list"
    ? `${quizQuestionsOf(tool).length} quiz questions`
    : tool.type === "youtube"
      ? "In your dashboard toolbox"
      : (tool.inToolbox ? "✓ In Dashboard Toolbox" : "Saved in toolbox");
  const tiles: { icon: string; title: string; description: string; action: () => void }[] = [
    { icon: "▭", title: "Card designer", description: "Look · Size & position · Content · Review", action: () => firstCard ? doors.openCardEditor(firstCard.id) : onNavigateStep(0, "quiz") },
    { icon: "≣", title: "Quiz & question lists", description: "Questions, choices, and answers", action: () => firstList ? doors.openListEditor(firstList.id) : onNavigateStep(0, "quiz") },
    { icon: "✂", title: "Media editor", description: "Trim · Resize · Save an edited copy", action: () => project.assets.length ? doors.openMediaEditor(0) : onNavigateStep(0, "backdrops") },
    { icon: "⚡", title: "Asset Composer", description: "The timeline workbench", action: doors.openComposer },
    { icon: "⚙", title: "Tool editors", description: "Name · Setup · Look · Preview — per tool", action: doors.showSavedWork },
    { icon: "✎", title: "Name & theme form", description: "Your show’s name and its theme & style", action: () => onNavigateStep(0, "sign") },
  ];
  return (
    <TalkStepShell stepId="toolbox" step={props.step}>
      <div className="gsw-seclabel" style={{ marginTop: 20 }}>Your tools</div>
      {tools.length ? (
        <div className="gsw-shelf">
          {tools.map(tool => (
            <button key={tool.id} type="button" className="gsw-asset plain" onClick={doors.showSavedWork}>
              <span className="gsw-ak">{tool.type.replace(/-/g, " ")}</span>
              <span className="gsw-an" style={{ position: "static" }}>{tool.name}<br /><span style={{ color: "#948bb3", fontWeight: 600, fontSize: 12 }}>{toolStatus(tool)}</span></span>
            </button>
          ))}
        </div>
      ) : (
        <p className="gsw-hint">Nothing in the toolbox yet — the things you make on the earlier steps land here.</p>
      )}
      <div className="gsw-seclabel" style={{ marginTop: 22 }}>Your backdrops &amp; sign</div>
      {backgrounds.length ? (
        <div className="gsw-shelf">
          {backgrounds.map(asset => {
            const lettering = assetBackdropText(asset);
            return (
              <button key={assetKey(asset)} type="button" className="gsw-asset" onClick={() => onNavigateStep(0, "backdrops")}>
                <AssetThumbnail asset={asset} kind={assetCategory(asset)} />
                <div className="gsw-shade" />
                <span className="gsw-ak">{asset.sign ? "Your sign" : "Backdrop"}</span>
                <span className="gsw-an">{asset.name}<br /><span style={{ color: "#cfc8e6", fontWeight: 600, fontSize: 12 }}>{lettering ? `Lettered: “${lettering.text}”` : asset.inProject ? "On your overlay" : "Saved"}</span></span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="gsw-hint">No backdrops yet.</p>
      )}
      <div className="gsw-card" style={{ marginTop: 16 }}>
        <h4>Your deck — {deck.length} slide{deck.length === 1 ? "" : "s"}</h4>
        <p>{deck.length ? deck.map((slide, i) => `${i + 1}. ${slide.label}`).join("  ·  ") : "No slides arranged yet — line up your show’s moments on the Arrange your slides step."}</p>
        <div className="gsw-chipsrow"><button type="button" className="gsw-jchip" onClick={() => onNavigateStep(0, "slides")}>Open the deck</button></div>
      </div>
      <div className="gsw-seclabel" style={{ marginTop: 22 }}>Every manual editor — the doors</div>
      <div className="gsw-tiles" style={{ marginTop: 0 }}>
        {tiles.map(tile => (
          <button key={tile.title} type="button" className="gsw-tile" onClick={tile.action}>
            <div className="gsw-ic">{tile.icon}</div><div className="gsw-tt">{tile.title}</div><div className="gsw-td">{tile.description}</div>
          </button>
        ))}
      </div>
      <div className="gsw-grid2" style={{ marginTop: 16 }}>
        <div className="gsw-card"><h4>Published links &amp; sharing</h4><p>The links for this project, where they already live today.</p>
          <div className="gsw-chipsrow"><button type="button" className="gsw-jchip" onClick={doors.showSavedWork}>Open sharing</button></div></div>
        <div className="gsw-card"><h4>Mistake? Take it back</h4><p>Jewel’s edits can be undone, one step at a time — the Undo button appears in her panel after she changes something.</p>
          <div className="gsw-chipsrow"><button type="button" className="gsw-jchip" onClick={props.onOpenJewel}>Open Jewel</button></div></div>
      </div>
      <div className="gsw-cols">
        <div />
        <TalkAskStrip {...props} stepId="toolbox" />
      </div>
    </TalkStepShell>
  );
}
