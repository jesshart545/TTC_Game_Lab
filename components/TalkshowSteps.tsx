"use client";

import { useState } from "react";
import type { BackdropTextSpec, ProjectAsset, TalkSlide } from "../lib/project";
import type { WorkflowStepState } from "../lib/workflow-progress";
import { assetBackdropText, assetPromptText, backgroundAssets, findSignAsset, promptAsset } from "../lib/backdrop-text";
import { assetCategory } from "../lib/asset-folders";
import { quizQuestionsOf } from "../lib/quiz";
import { isVideo } from "../lib/workshop-libraries";
import {
  BACKDROP_CHANGES, DEMO_COLOR_PAIRS, DEMO_FONTS, EXAMPLE_QUIZ, MEDIA_CHANGES, PROMPT_CHANGES, QUIZ_CHANGES,
  RESEARCH_CHANGES, SAMPLE_PROMPT, SAMPLE_RESEARCH, SIGN_CHANGES, SLIDES_CHANGES, TALK_STEPS, TALK_TOOL_TYPES,
  THEME_CHANGES, demoBackdrop, demoTextSpec,
} from "../lib/talkshow-path";
import AssetThumbnail from "./AssetThumbnail";
import BackdropTextLayer from "./BackdropText";
import { ChangeList } from "./GameshowWorkshop";
import { TalkAskStrip, TalkStepShell, type TalkshowWorkshopProps } from "./TalkshowWorkshop";

type ScreenProps = TalkshowWorkshopProps & { step?: WorkflowStepState };

const assetKey = (asset: ProjectAsset) => asset.storageKey || asset.name;

export function BackdropStageMedia({ asset }: { asset: ProjectAsset }) {
  if (!asset.url) return <ExampleStageMedia />;
  if (isVideo(asset)) {
    return <video src={asset.url} autoPlay loop muted playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />;
  }
  return <img src={asset.url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />;
}

/** The pictured example stage for an empty project: the site's own Talk
 * Show artwork, so a step demonstrates with a real picture — never a flat
 * gradient void. Labelled as an example wherever it stands in. */
export function ExampleStageMedia() {
  return <img className="gsw-bg" src="/redesign/kind-talkshow.webp" alt="" />;
}

/** The animated example: the project's own moving backdrop when it has
 * one; otherwise the site's own animated artwork (Jewel waving, from the
 * home Tips card) — a real looping visual, honestly labelled. */
export function AnimatedExampleMedia({ project }: { project: TalkshowWorkshopProps["project"] }) {
  const animated = backgroundAssets(project).find(asset => isVideo(asset) && asset.url);
  if (animated) return <BackdropStageMedia asset={animated} />;
  return <video src="/redesign/talk-animated-backdrop.mp4" autoPlay loop muted playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />;
}

/* ---------------- Area 1 · Show theme & subject ---------------- */

export function ThemeStep(props: ScreenProps) {
  const { project, onSaveProject, onAskJewel: onAsk } = props;
  const theme = project.gamePlan?.theme || "";
  return (
    <TalkStepShell stepId="theme" step={props.step}>
      <div className="gsw-cols">
        <div>
          <div className="gsw-seclabel">Your show — {project.name && project.name !== "New Project" ? project.name : "not titled yet"}</div>
          <div className="gsw-card">
            <div className="tsw-fields">
              <label>Show theme / subject — what is your show all about?
                <textarea
                  rows={3}
                  value={theme}
                  placeholder="Example: a warm spiritual-and-life talk show; a science class that makes the water cycle click"
                  onChange={event => onSaveProject({ ...project, gamePlan: { ...project.gamePlan, theme: event.target.value }, updatedAt: "just now" })}
                />
              </label>
            </div>
            <p style={{ marginTop: 8 }}>{theme.trim()
              ? "✓ Answered — Jewel has checked this box off. It aims her research and flavors your sign and questions; edit it any time."
              : "The moment you type what your show is all about, Jewel checks this box off — and everything she does for you aims by it."}</p>
          </div>
          <ChangeList title="What you can change — your theme" items={THEME_CHANGES} onAsk={onAsk} />
        </div>
        <TalkAskStrip {...props} stepId="theme" extra={TALK_STEPS.theme.adjust} />
      </div>
    </TalkStepShell>
  );
}

/* ---------------- Area 2 · Decide on a background ---------------- */

export function BackgroundStep(props: ScreenProps) {
  const { project, doors, onOpenJewel, onAskJewel: onAsk } = props;
  const backgrounds = backgroundAssets(project);
  const animated = backgrounds.find(asset => isVideo(asset)) || null;
  const flat = backgrounds.find(asset => !isVideo(asset)) || null;
  const hero = animated || flat;
  return (
    <TalkStepShell stepId="background" step={props.step}>
      <div className="gsw-cols">
        <div>
          <div className="gsw-display" style={{ fontSize: 22, marginBottom: 10 }}>First let’s decide on a background (flat/animated)</div>
          <div className="gsw-grid2">
            <div>
              <span className="gsw-demotag">Flat — a still, artistic backdrop</span>
              <div className="gsw-stage-visual" style={{ minHeight: 190, position: "relative" }}>
                {flat ? <BackdropStageMedia asset={flat} /> : <ExampleStageMedia />}
                <div style={{ position: "absolute", left: 12, bottom: 10 }}>
                  <span className="gsw-vchip gold">{flat ? `Your flat backdrop · ${flat.name}` : "Example · a pictured talk-show stage"}</span>
                </div>
              </div>
            </div>
            <div>
              <span className="gsw-demotag">Animated — it moves and loops</span>
              <div className="gsw-stage-visual" style={{ minHeight: 190, position: "relative" }}>
                <AnimatedExampleMedia project={project} />
                <div style={{ position: "absolute", left: 12, bottom: 10 }}>
                  <span className="gsw-vchip gold">{animated ? `Your animated backdrop · ${animated.name}` : "Example · an animated talk-show backdrop, playing"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="gsw-card" style={{ marginTop: 14 }}>
            <h4>Design yours with Jewel</h4>
            <p>Open Jewel and describe the scene — she designs your background with you, flat or animated, and it files here with your show.</p>
            <div className="gsw-chipsrow">
              <button type="button" className="gsw-demobtn gold" onClick={onOpenJewel}>✦ Open Jewel — design my background</button>
            </div>
          </div>

          {hero && (
            <>
              <span className="gsw-demotag" style={{ marginTop: 22 }}>Your backdrop, on your stage</span>
              <div className="gsw-stage-visual" style={{ minHeight: 260, position: "relative" }}>
                <BackdropStageMedia asset={hero} />
                <div style={{ position: "absolute", left: 14, top: 10 }}>
                  <span className="gsw-vchip gold">{animated ? `Animated — playing · ${animated.name}` : `Flat · ${flat?.name}`}</span>
                </div>
              </div>
            </>
          )}

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
            <p className="gsw-hint">Nothing here yet — the background you design with Jewel lands on this shelf.</p>
          )}
          <ChangeList title="What you can change — a background" items={BACKDROP_CHANGES} onAsk={onAsk} />
        </div>
        <TalkAskStrip {...props} stepId="background" extra={TALK_STEPS.background.adjust} />
      </div>
    </TalkStepShell>
  );
}

/* ---------------- Area 3 · Add your title sign ---------------- */

export function SignStep(props: ScreenProps) {
  const { project, doors, onAskJewel: onAsk } = props;
  const signAsset = findSignAsset(project);
  const hasBackground = backgroundAssets(project).length > 0;
  const demoAsset = signAsset || demoBackdrop(project);
  const spec = demoTextSpec(project, demoAsset);
  const uploadedSign = signAsset && signAsset.sign === true && !assetBackdropText(signAsset) ? signAsset : null;
  return (
    <TalkStepShell stepId="sign" step={props.step}>
      <div className="gsw-cols">
        <div>
          {hasBackground && !signAsset && (
            <div className="gsw-card" style={{ marginBottom: 14, borderColor: "#e9c979" }}>
              <h4>✦ Jewel suggests: add your title sign</h4>
              <p>Your background is designed — the natural next piece is your title sign over it. Say the word and I’ll letter it for real.</p>
              <div className="gsw-chipsrow">
                <button type="button" className="gsw-demobtn gold" onClick={() => onAsk("Add the title sign for my show over my background")}>Add my title sign</button>
              </div>
            </div>
          )}
          <span className="gsw-demotag">Live demonstration — your sign, lettered for real</span>
          <div className="gsw-stage-visual" style={{ minHeight: 300, position: "relative" }}>
            {demoAsset ? <BackdropStageMedia asset={demoAsset} /> : <ExampleStageMedia />}
            {!uploadedSign && <BackdropTextLayer spec={spec} />}
            <div className="gsw-shade" style={{ background: "linear-gradient(180deg, transparent 55%, rgba(8,6,14,.72))" }} />
            <div style={{ position: "absolute", left: 14, bottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span className="gsw-vchip gold">{uploadedSign ? `Your uploaded sign · ${uploadedSign.name}` : signAsset ? `Your sign · ${signAsset.name}` : "Demonstration · Jewel letters your title over artwork like this"}</span>
              {signAsset && !uploadedSign && <span className="gsw-vchip">Lettering is a real text layer — never baked in</span>}
            </div>
          </div>
          <ChangeList title="What you can change — your sign" items={SIGN_CHANGES} onAsk={onAsk} />
        </div>
        <TalkAskStrip {...props} stepId="sign" extra={TALK_STEPS.sign.adjust} />
      </div>
    </TalkStepShell>
  );
}

/* ---------------- Area 4 · Opening prompt / talking point ---------------- */

const PRESENTATIONS: { id: NonNullable<BackdropTextSpec["presentation"]>; label: string }[] = [
  { id: "plain", label: "Plain" },
  { id: "bubble", label: "Thought bubble" },
  { id: "frame", label: "Frame" },
];

export function PromptStep(props: ScreenProps) {
  const { project, onSaveProject, onNavigateStep, onAskJewel: onAsk } = props;
  const backgrounds = backgroundAssets(project);
  const target = backgrounds.find(asset => asset.inProject) || backgrounds[0] || null;
  const current = target ? assetPromptText(target) : null;

  const save = (patch: Partial<BackdropTextSpec>) => {
    if (!target) return;
    const base: BackdropTextSpec = current || {
      text: "",
      fontFamily: DEMO_FONTS[0]?.family || "Georgia, serif",
      textColor: "#ffffff",
      presentation: "plain",
    };
    const next: BackdropTextSpec = { ...base, ...patch };
    if (patch.presentation === "bubble" && !current) next.textColor = "#3b2a63";
    if (!next.text.trim()) {
      if (current) onSaveProject({ ...project, assets: project.assets.map(a => a === target ? { ...a, promptOverlay: null } : a), updatedAt: "just now" });
      return;
    }
    onSaveProject({ ...project, assets: project.assets.map(a => a === target ? { ...a, promptOverlay: next } : a), updatedAt: "just now" });
  };

  const exampleSpec = (presentation: NonNullable<BackdropTextSpec["presentation"]>): BackdropTextSpec => ({
    text: SAMPLE_PROMPT,
    fontFamily: DEMO_FONTS[1]?.family || "Georgia, serif",
    textColor: presentation === "bubble" ? "#3b2a63" : "#ffffff",
    accentColor: "#e9c979",
    presentation,
  });

  return (
    <TalkStepShell stepId="prompt" step={props.step}>
      <div className="gsw-cols">
        <div>
          <div className="gsw-seclabel">Ideas — your talking point, three ways, on real backgrounds</div>
          <div className="gsw-grid2">
            <div>
              <span className="gsw-demotag">In a thought bubble · flat background</span>
              <div className="gsw-stage-visual" style={{ minHeight: 190, position: "relative" }}>
                <ExampleStageMedia />
                <BackdropTextLayer spec={exampleSpec("bubble")} placement="lower" />
              </div>
            </div>
            <div>
              <span className="gsw-demotag">In a frame · animated background</span>
              <div className="gsw-stage-visual" style={{ minHeight: 190, position: "relative" }}>
                <AnimatedExampleMedia project={project} />
                <BackdropTextLayer spec={exampleSpec("frame")} placement="lower" />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <span className="gsw-demotag">Plain · flat background</span>
            <div className="gsw-stage-visual" style={{ minHeight: 170, position: "relative" }}>
              <ExampleStageMedia />
              <BackdropTextLayer spec={exampleSpec("plain")} placement="lower" />
            </div>
          </div>

          <div className="gsw-seclabel" style={{ marginTop: 22 }}>Yours — on your background</div>
          {target ? (
            <>
              <div className="gsw-stage-visual" style={{ minHeight: 260, position: "relative" }}>
                <BackdropStageMedia asset={target} />
                {assetBackdropText(target) && <BackdropTextLayer spec={assetBackdropText(target)!} />}
                {current && <BackdropTextLayer spec={current} placement="lower" />}
                {!current && <div style={{ position: "absolute", left: 14, bottom: 12 }}><span className="gsw-vchip gold">Type your talking point below — it appears here, on your background</span></div>}
              </div>
              <div className="gsw-card" style={{ marginTop: 14 }}>
                <div className="tsw-fields">
                  <label>Your opening prompt / talking point
                    <textarea
                      rows={2}
                      value={current?.text || ""}
                      placeholder="Example: Tonight's talking point: small habits, big change"
                      onChange={event => save({ text: event.target.value })}
                    />
                  </label>
                </div>
                <div className="gsw-seclabel" style={{ marginTop: 14 }}>Its font</div>
                <div className="gsw-chipsrow">
                  {DEMO_FONTS.map(font => (
                    <button key={font.family} type="button" className={"gsw-vchip" + ((current?.fontFamily || DEMO_FONTS[0]?.family) === font.family ? " gold" : "")} style={{ fontFamily: font.family, fontSize: 14 }} onClick={() => save({ fontFamily: font.family })}>{font.name}</button>
                  ))}
                </div>
                <div className="gsw-seclabel" style={{ marginTop: 14 }}>The color of the text</div>
                <div className="gsw-chipsrow">
                  {DEMO_COLOR_PAIRS.map(pair => (
                    <button key={pair.name} type="button" className={"gsw-vchip" + (current?.textColor === pair.textColor ? " gold" : "")} onClick={() => save({ textColor: pair.textColor, accentColor: pair.accentColor })}>
                      <span style={{ color: pair.textColor, textShadow: "0 1px 6px rgba(0,0,0,.8)" }}>Aa</span> {pair.name}
                    </button>
                  ))}
                </div>
                <div className="gsw-seclabel" style={{ marginTop: 14 }}>How it sits on the background</div>
                <div className="gsw-chipsrow">
                  {PRESENTATIONS.map(pres => (
                    <button key={pres.id} type="button" className={"gsw-vchip" + ((current?.presentation || "plain") === pres.id ? " gold" : "")} onClick={() => save({ presentation: pres.id })}>{pres.label}</button>
                  ))}
                </div>
                <p style={{ marginTop: 10 }}>{current ? "✓ Set — Jewel has checked this box off. Change any of it, any time." : "Pick your words, font, color, and look — it saves as you choose."}</p>
              </div>
            </>
          ) : (
            <div className="gsw-card">
              <h4>Your prompt sits on your background</h4>
              <p>Design the background first, and this is where your talking point goes — right on it.</p>
              <div className="gsw-chipsrow"><button type="button" className="gsw-demobtn gold" onClick={() => onNavigateStep(0, "background")}>Go to my background</button></div>
            </div>
          )}
          <ChangeList title="What you can change — your prompt" items={PROMPT_CHANGES} onAsk={onAsk} />
        </div>
        <TalkAskStrip {...props} stepId="prompt" extra={TALK_STEPS.prompt.adjust} />
      </div>
    </TalkStepShell>
  );
}

/* ---------------- Area 5 · Research your talking point ---------------- */

export function ResearchStep(props: ScreenProps) {
  const { project, onNavigateStep, onAskJewel: onAsk } = props;
  const theme = (project.gamePlan?.theme || "").trim();
  const promptSpec = assetPromptText(promptAsset(project));
  const researched = project.workflowProgress?.researched === true;
  const [sampleRan, setSampleRan] = useState(false);
  return (
    <TalkStepShell stepId="research" step={props.step}>
      <div className="gsw-cols">
        <div>
          <div className="gsw-display" style={{ fontSize: 22, marginBottom: 10 }}>Ask Jewel to help with research on your topic/talking point</div>
          <div className="gsw-card">
            <h4>{promptSpec ? `Your talking point: “${promptSpec.text}”` : theme ? `Your show is about: ${theme}` : "No talking point yet"}</h4>
            <p>{promptSpec || theme
              ? "That is what Jewel researches — data points about it, from the web, with the sources attached."
              : "Set your theme in the first box, and your talking point on the Opening prompt step — Jewel researches from those."}</p>
            {!promptSpec && <div className="gsw-chipsrow"><button type="button" className="gsw-demobtn gold" onClick={() => onNavigateStep(0, "prompt")}>Set my talking point</button></div>}
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

          <div className="gsw-seclabel" style={{ marginTop: 22 }}>Then the data points go to work</div>
          <div className="gsw-grid2">
            <div className="gsw-card"><h4>Questions with backup</h4><p>The findings become quiz questions or follow-ups your audience can answer from what your show taught them.</p></div>
            <div className="gsw-card"><h4>A backdrop shaped by findings</h4><p>Or Jewel briefs your backdrop’s artwork with what she found — the places, the facts, the mood.</p></div>
          </div>
          <p className="gsw-demostatus" style={{ marginTop: 10 }}>
            {researched ? "✓ Jewel has researched in this project — data points and sources are in your conversation with her." : "No research yet — the first lookup you ask Jewel for checks this area off."}
          </p>
          <ChangeList title="What you can change — the research" items={RESEARCH_CHANGES} onAsk={onAsk} />
        </div>
        <TalkAskStrip {...props} stepId="research" extra={TALK_STEPS.research.adjust} />
      </div>
    </TalkStepShell>
  );
}

/* ---------------- Area 6 · Quiz or follow-up questions ---------------- */

type DemoQuizQuestion = { question: string; options: string[]; correctIndex: number };

export function QuizFlip({ q }: { q: DemoQuizQuestion }) {
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
  const anyCardTool = (project.gameTools || []).find(tool => tool.enabled && (tool.type === "question-card" || tool.type === "blank-card"));
  return (
    <TalkStepShell stepId="quiz" step={props.step}>
      <div className="gsw-cols">
        <div>
          <div className="gsw-display" style={{ fontSize: 22, marginBottom: 10 }}>Quiz your class or create follow up questions for your prompt</div>

          <div className="gsw-seclabel">Path one — a quiz</div>
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
                : "Your questions are saved. They present on quiz cards — make the cards yourself with the card maker, or ask Jewel to create them."}</p>
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
              <p>Jewel asks how you want your quiz to work — how many questions, on what — then she generates it. Your audience sees the choices; the answer stays yours until the reveal.</p>
              <div className="gsw-chipsrow">
                <button type="button" className="gsw-jchip" onClick={() => onAsk("I want a quiz for my class — ask me how I want it to work, then build it")}>Start my quiz with Jewel</button>
              </div>
            </div>
          )}

          <div className="gsw-seclabel" style={{ marginTop: 22 }}>Path two — follow-up questions</div>
          <div className="gsw-card">
            <h4>Follow-ups, on cards you design</h4>
            <p>No right-or-wrong answers — questions that keep the conversation going after your prompt. You design the cards: your own background, text color, font and all. Jewel helps suggest good follow-up questions based on your initial prompt.</p>
            <div className="gsw-chipsrow">
              <button type="button" className="gsw-jchip" onClick={() => onAsk("Suggest good follow-up questions based on my opening prompt")}>Ask Jewel to suggest follow-ups</button>
              <button type="button" className="gsw-jchip" onClick={() => anyCardTool ? doors.openCardEditor(anyCardTool.id) : doors.createQuizCards()}>{anyCardTool ? "Open the card designer" : "Design my cards"}</button>
            </div>
          </div>
          <ChangeList title="What you can change — your questions" items={QUIZ_CHANGES} onAsk={onAsk} />
        </div>
        <TalkAskStrip {...props} stepId="quiz" extra={TALK_STEPS.quiz.adjust} />
      </div>
    </TalkStepShell>
  );
}

/* ---------------- Area 7 · Media ---------------- */

export function MediaStep(props: ScreenProps) {
  const { project, doors, onAskJewel: onAsk } = props;
  const youtube = (project.gameTools || []).find(t => t.enabled && t.type === "youtube");
  const backdrop = demoBackdrop(project);
  const media = (project.assets || []).filter(asset => asset.role !== "background");
  const examples: { img: string; kind: string; title: string; say: string }[] = [
    { img: "/redesign/kind-talkshow.webp", kind: "Opening", title: "Opening sequence & theme song", say: "Make an opening sequence and theme song for my show" },
    { img: "/redesign/kind-radio.webp", kind: "Cutscene", title: "Short commercial cutscene", say: "Make a short commercial cutscene for my show" },
  ];
  return (
    <TalkStepShell stepId="media" step={props.step}>
      <div className="gsw-cols">
        <div>
          <div className="gsw-seclabel">Examples — tap one and Jewel makes it with you</div>
          <div className="gsw-shelf">
            {examples.map(example => (
              <button key={example.title} type="button" className="gsw-asset" onClick={() => onAsk(example.say)}>
                <img src={example.img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                <div className="gsw-shade" />
                <span className="gsw-ak">{example.kind} · Example</span>
                <span className="gsw-an">{example.title}<br /><span style={{ color: "#cfc8e6", fontWeight: 600, fontSize: 12 }}>Tap — ask Jewel for yours</span></span>
              </button>
            ))}
            <button type="button" className="gsw-asset" onClick={() => onAsk("Add the YouTube feature to my show")}>
              {backdrop ? <BackdropStageMedia asset={backdrop} /> : <ExampleStageMedia />}
              <div className="gsw-shade" style={{ background: "rgba(8,6,14,.38)" }} />
              <div className="tsw-ytcenter"><div className="tsw-ytplay" aria-hidden="true">▶</div></div>
              <span className="gsw-ak">Video moment · Example</span>
              <span className="gsw-an">A YouTube video, playing on your backdrop<br /><span style={{ color: "#cfc8e6", fontWeight: 600, fontSize: 12 }}>{youtube ? "✓ YouTube is on your dashboard" : "Tap — add it to your dashboard"}</span></span>
            </button>
          </div>

          <div className="gsw-grid2" style={{ marginTop: 14 }}>
            <div className="gsw-card">
              <h4>Upload your media</h4>
              <p>Your own clips, images, and sounds file here — ready for your show.</p>
              <div className="gsw-chipsrow"><button type="button" className="gsw-demobtn gold" onClick={doors.uploadMedia}>Upload media</button></div>
            </div>
            <div className="gsw-card">
              <h4>{youtube ? "✓ YouTube is on your dashboard" : "YouTube, on your dashboard"}</h4>
              <p>{youtube ? "It waits in your toolbox until Set the Stage, where you decide which dashboard button opens it." : "Add the YouTube option to your dashboard — during the show you search privately and send the video to your backdrop."}</p>
              <div className="gsw-chipsrow">
                {youtube
                  ? <button type="button" className="gsw-jchip" onClick={doors.showSavedWork}>See it in your toolbox</button>
                  : <button type="button" className="gsw-demobtn" onClick={doors.addYoutube}>Add YouTube</button>}
              </div>
            </div>
          </div>

          <div className="gsw-seclabel" style={{ marginTop: 22 }}>Your media</div>
          {media.length ? (
            <div className="gsw-shelf">
              {media.map(asset => {
                const index = (project.assets || []).indexOf(asset);
                return (
                  <button key={assetKey(asset)} type="button" className="gsw-asset" onClick={() => doors.openMediaEditor(index)}>
                    <AssetThumbnail asset={asset} kind={assetCategory(asset)} />
                    <div className="gsw-shade" />
                    <span className="gsw-ak">{asset.type}</span>
                    <span className="gsw-an">{asset.name}<br /><span style={{ color: "#cfc8e6", fontWeight: 600, fontSize: 12 }}>Tap to open the media editor</span></span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="gsw-hint">Nothing filed yet — your uploads and the clips Jewel makes for you land on this shelf.</p>
          )}
          <ChangeList title="What you can change — your media" items={MEDIA_CHANGES} onAsk={onAsk} />
        </div>
        <TalkAskStrip {...props} stepId="media" extra={TALK_STEPS.media.adjust} />
      </div>
    </TalkStepShell>
  );
}

/* ---------------- Area 8 · Anything we missed? (deck + toolbox doors live here) ---------------- */

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

/** The hand-arranged deck, kept whole from the earlier Slides step — it
 * lives in the Anything-we-missed topic now. Narrow props (the project,
 * the page's save path, an optional Jewel-ask for its change list) so the
 * visual stage can render it bare — the deck itself, no change list. */
export function DeckArranger({ project, onSaveProject, onAskJewel, bare }: {
  project: TalkshowWorkshopProps["project"];
  onSaveProject: TalkshowWorkshopProps["onSaveProject"];
  onAskJewel?: TalkshowWorkshopProps["onAskJewel"];
  bare?: boolean;
}) {
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
    <div>
      <div className="gsw-seclabel">Your deck — line up your show’s moments, in order</div>
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
      {!bare && onAskJewel && <ChangeList title="What you can change — your slides" items={SLIDES_CHANGES} onAsk={onAskJewel} />}
    </div>
  );
}

export function MissedStep(props: ScreenProps) {
  const { project, doors, onNavigateStep, onOpenJewel } = props;
  // Talk space holds talk pieces only: gameshow tools a project may carry
  // are never pictured or listed here (Jessica, 2026-11-03).
  const tools = (project.gameTools || []).filter(tool => TALK_TOOL_TYPES.includes(tool.type));
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
    { icon: "✂", title: "Media editor", description: "Trim · Resize · Save an edited copy", action: () => project.assets.length ? doors.openMediaEditor(0) : onNavigateStep(0, "media") },
    { icon: "⚡", title: "Asset Composer", description: "The timeline workbench", action: doors.openComposer },
    { icon: "⚙", title: "Tool editors", description: "Name · Setup · Look · Preview — per tool", action: doors.showSavedWork },
    { icon: "✎", title: "Theme & sign", description: "Your show’s theme, and its title sign", action: () => onNavigateStep(0, "theme") },
  ];
  return (
    <TalkStepShell stepId="missed" step={props.step}>
      <div className="gsw-card" style={{ borderColor: "#e9c979" }}>
        <h4>Any other ideas for your show?</h4>
        <p>Anything we haven’t mentioned — a segment, a moment, a wild idea — tell Jewel, and she’ll try to handle it for you.</p>
        <div className="gsw-chipsrow">
          <button type="button" className="gsw-demobtn gold" onClick={onOpenJewel}>✦ Tell Jewel my idea</button>
        </div>
      </div>

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
        <p className="gsw-hint">Nothing in the toolbox yet — the things you make in the earlier areas land here.</p>
      )}
      <div className="gsw-seclabel" style={{ marginTop: 22 }}>Your backdrops &amp; sign</div>
      {backgrounds.length ? (
        <div className="gsw-shelf">
          {backgrounds.map(asset => {
            const lettering = assetBackdropText(asset);
            return (
              <button key={assetKey(asset)} type="button" className="gsw-asset" onClick={() => onNavigateStep(0, "background")}>
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
        <p>{deck.length ? deck.map((slide, i) => `${i + 1}. ${slide.label}`).join("  ·  ") : "No slides arranged yet — line up your show’s moments in the deck below."}</p>
      </div>
      <div style={{ marginTop: 16 }}>
        <DeckArranger project={props.project} onSaveProject={props.onSaveProject} onAskJewel={props.onAskJewel} />
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
          <div className="gsw-chipsrow"><button type="button" className="gsw-jchip" onClick={onOpenJewel}>Open Jewel</button></div></div>
      </div>
      <div className="gsw-cols">
        <div />
        <TalkAskStrip {...props} stepId="missed" />
      </div>
    </TalkStepShell>
  );
}
