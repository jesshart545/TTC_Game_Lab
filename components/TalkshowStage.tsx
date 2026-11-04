"use client";

import type { ReactNode } from "react";
import type { BackdropTextSpec, Project, ProjectAsset } from "../lib/project";
import type { WorkflowEvaluation } from "../lib/workflow-progress";
import { assetBackdropText, assetPromptText, backgroundAssets, promptAsset } from "../lib/backdrop-text";
import { assetCategory } from "../lib/asset-folders";
import { quizQuestionsOf } from "../lib/quiz";
import { isVideo } from "../lib/workshop-libraries";
import {
  DEMO_FONTS, EXAMPLE_QUIZ, SAMPLE_PROMPT, SAMPLE_RESEARCH, TALK_CREATIVITY_BANNER, TALK_TOOL_TYPES,
  demoBackdrop, demoTextSpec,
} from "../lib/talkshow-path";
import AssetThumbnail from "./AssetThumbnail";
import BackdropTextLayer from "./BackdropText";
import JewelAvatar from "./JewelAvatar";
import { AnimatedExampleMedia, BackdropStageMedia, DeckArranger, ExampleStageMedia, QuizFlip } from "./TalkshowSteps";
import type { TalkshowDoors } from "./TalkshowWorkshop";
import "./gameshow-workshop.css";
import "./talkshow-workshop.css";

/**
 * The Talk Show or Classroom visual stage (Jessica, 2026-11-04): the
 * sequence lives in the conversation with Jewel — she checks topics off
 * and directs — so the page carries NO path, no area panels, no ask
 * strips, no skip buttons. The movement into Jewel lives inside the
 * topic she is on: in the background area the flat/animated examples
 * come first, and Jewel's conversation panel stands open directly
 * after them — the eye flows examples → step into Jewel → the
 * backdrops shelf where the work is stored. The same placement holds
 * in every later topic: her panel renders inside the current topic's
 * section, after that topic's examples. What stands around the panel
 * is storage and demonstration for the ONE topic Jewel is working on
 * (the workflow model's current talk step): the creator's own saved
 * work for that topic when it exists
 * (their real background with its title lettering, their prompt rendered
 * on it, their questions, their filed media, their deck), and the honest
 * examples only while nothing is made yet. The only controls are the
 * genuine manual doors for the current topic — the backdrops shelf on
 * background, upload on media, the card designer on quiz/follow-ups.
 * There is deliberately no upload-your-own-sign button here — no
 * sign-specific upload path exists anywhere: the sign and the
 * background always go together, uploads live in the media upload
 * area, and Jewel builds the combined piece, working with media the
 * creator already uploaded like any other asset. Jewel's avatar
 * stands in the liberty banner as the continuity reminder, and again
 * where the creator steps into her conversation in the background
 * area — there in her LANDING PAGE presentation (Jessica,
 * 2026-11-04: "we need the enter Jewel area to show the same way it
 * does on the landing page"): the glowing 112px bubble of the home
 * Tips card that introduces her as their magic wand, bobbing gently,
 * her wand badge at its standard size. (An earlier cut — a plain
 * 104px bubble with a 46px wand — was rejected as "too damn big":
 * what made it wrong was not the pixels but that it was a treatment
 * invented for this page instead of the way the site introduces her.)
 */

const TALK_TOPICS = ["background", "prompt", "research", "quiz", "media", "missed"] as const;
type TalkTopic = (typeof TALK_TOPICS)[number];

type StageProps = {
  project: Project;
  doors: TalkshowDoors;
  onSaveProject: (project: Project) => void;
  jewelPanel?: ReactNode;
};

const assetKey = (asset: ProjectAsset) => asset.storageKey || asset.name;

/* ---------------- Background — the combined background + sign piece ---------------- */

function BackgroundStage({ project, doors, jewelPanel }: StageProps) {
  const backgrounds = backgroundAssets(project);
  const animated = backgrounds.find(asset => isVideo(asset)) || null;
  const flat = backgrounds.find(asset => !isVideo(asset)) || null;
  const hero = animated || flat;
  const heroSign = hero ? assetBackdropText(hero) : null;
  const heroPrompt = hero ? assetPromptText(hero) : null;
  return (
    <div>
      <div className="gsw-display" style={{ fontSize: 22, marginBottom: 10 }}>First let’s decide on a background (flat/animated)</div>
      <div className="gsw-grid2">
        <div>
          <span className="gsw-demotag">Flat — a still, artistic backdrop</span>
          <div className="gsw-stage-visual" style={{ minHeight: 190, position: "relative" }}>
            {flat ? <BackdropStageMedia asset={flat} /> : <ExampleStageMedia />}
            {flat
              ? assetBackdropText(flat) && <BackdropTextLayer spec={assetBackdropText(flat)!} />
              : <BackdropTextLayer spec={demoTextSpec(project, null)} />}
            <div style={{ position: "absolute", left: 12, bottom: 10 }}>
              <span className="gsw-vchip gold">{flat ? `Your flat backdrop · ${flat.name}` : "Example · a pictured talk-show stage, your title lettered on it"}</span>
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

      <div style={{ marginTop: 20, marginBottom: 12 }}>
        <JewelAvatar size={112} landing />
      </div>
      {jewelPanel}

      {hero && (
        <>
          <span className="gsw-demotag" style={{ marginTop: 22 }}>Your background — stored here, sign and all</span>
          <div className="gsw-stage-visual" style={{ minHeight: 260, position: "relative" }}>
            <BackdropStageMedia asset={hero} />
            {heroSign && <BackdropTextLayer spec={heroSign} />}
            {heroPrompt && <BackdropTextLayer spec={heroPrompt} placement="lower" />}
            <div style={{ position: "absolute", left: 14, top: 10 }}>
              <span className="gsw-vchip gold">{animated ? `Animated — playing · ${hero.name}` : `Flat · ${hero.name}`}{heroSign ? " · your title sign is lettered on it" : ""}</span>
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
        <p className="gsw-hint">Nothing here yet — the background you design with Jewel is stored on this shelf.</p>
      )}

    </div>
  );
}

/* ---------------- Opening prompt ---------------- */

function PromptStage({ project, jewelPanel }: StageProps) {
  const backgrounds = backgroundAssets(project);
  const target = backgrounds.find(asset => asset.inProject) || backgrounds[0] || null;
  const current = target ? assetPromptText(target) : null;
  const exampleSpec = (presentation: NonNullable<BackdropTextSpec["presentation"]>): BackdropTextSpec => ({
    text: SAMPLE_PROMPT,
    fontFamily: DEMO_FONTS[1]?.family || "Georgia, serif",
    textColor: presentation === "bubble" ? "#3b2a63" : "#ffffff",
    accentColor: "#e9c979",
    presentation,
  });
  if (target && current) {
    const sign = assetBackdropText(target);
    return (
      <div>
        <div className="gsw-seclabel">Yours — your opening prompt, on your background</div>
        <div className="gsw-stage-visual" style={{ minHeight: 300, position: "relative" }}>
          <BackdropStageMedia asset={target} />
          {sign && <BackdropTextLayer spec={sign} />}
          <BackdropTextLayer spec={current} placement="lower" />
          <div style={{ position: "absolute", left: 14, bottom: 12 }}>
            <span className="gsw-vchip gold">Your opening prompt · “{current.text}”</span>
          </div>
        </div>
        <p className="gsw-hint" style={{ marginTop: 10 }}>Stored on your background as its own layer — Jewel can reword it, re-letter it, or move it between bubble, frame, and plain whenever you ask her.</p>
        {jewelPanel}
      </div>
    );
  }
  return (
    <div>
      <div className="gsw-seclabel">Examples — your talking point, three ways, on real backgrounds</div>
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
      <p className="gsw-hint" style={{ marginTop: 10 }}>Examples for now — the prompt you settle on with Jewel is stored here, lettered on your own background.</p>
      {jewelPanel}
    </div>
  );
}

/* ---------------- Research ---------------- */

function ResearchStage({ project, jewelPanel }: StageProps) {
  const theme = (project.gamePlan?.theme || "").trim();
  const promptSpec = assetPromptText(promptAsset(project));
  const researched = project.workflowProgress?.researched === true;
  return (
    <div>
      <div className="gsw-display" style={{ fontSize: 22, marginBottom: 10 }}>Research on your topic — Jewel gathers the data points</div>
      <div className="gsw-card">
        <h4>{promptSpec ? `Your talking point: “${promptSpec.text}”` : theme ? `Your show is about: ${theme}` : "Your talking point"}</h4>
        <p>That is what Jewel researches in your conversation — data points about it, from the web, with the sources attached.</p>
      </div>

      <span className="gsw-demotag" style={{ marginTop: 22 }}>Demonstration — what Jewel’s research looks like</span>
      <div className="gsw-qcard" style={{ textAlign: "left" }}>
        <div className="gsw-qk">Sample question · a classroom show</div>
        <div className="gsw-qq" style={{ fontSize: 17 }}>{SAMPLE_RESEARCH.question}</div>
      </div>
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {SAMPLE_RESEARCH.findings.map(finding => (
          <div key={finding.text} className="gsw-card">
            <p style={{ margin: 0 }}>{finding.text}</p>
            <div className="gsw-chipsrow"><span className="gsw-vchip">{finding.source}</span></div>
          </div>
        ))}
      </div>
      <p className="gsw-demostatus" style={{ marginTop: 10 }}>{SAMPLE_RESEARCH.note}</p>
      {jewelPanel}
      <p className="gsw-demostatus" style={{ marginTop: 10 }}>
        {researched ? "✓ Jewel has researched in this project — the data points and sources are in your conversation with her." : "No research yet — the first lookup you ask Jewel for in your conversation checks this topic off."}
      </p>
    </div>
  );
}

/* ---------------- Quiz or follow-up questions ---------------- */

function QuizStage({ project, doors, jewelPanel }: StageProps) {
  const quizTool = (project.gameTools || []).find(tool => tool.enabled && tool.type === "trivia-list" && quizQuestionsOf(tool).length > 0);
  const saved = quizTool ? quizQuestionsOf(quizTool) : [];
  const questions = saved.length
    ? saved.slice(0, 3).map(q => ({ question: q.question, options: q.options, correctIndex: q.correctIndex }))
    : EXAMPLE_QUIZ;
  const cardTools = (project.gameTools || []).filter(tool => tool.enabled && (tool.type === "question-card" || tool.type === "card-list" || tool.type === "blank-card"));
  const anyCardTool = cardTools[0];
  return (
    <div>
      <div className="gsw-display" style={{ fontSize: 22, marginBottom: 10 }}>Quiz your class or create follow up questions for your prompt</div>
      <span className="gsw-demotag">{saved.length ? "Your quiz — tap a card to see the answer side" : "Live demonstration — tap a card to see the answer side"}</span>
      {!saved.length && <p className="gsw-hint" style={{ marginBottom: 10 }}>Example questions — the quiz you build with Jewel is stored here, flipped the same way.</p>}
      <div className="gsw-grid2">
        {questions.map((q, i) => <QuizFlip key={i} q={q} />)}
      </div>
      {quizTool && (
        <p className="gsw-demostatus" style={{ marginTop: 10 }}>{quizTool.name} · {saved.length} multiple-choice question{saved.length === 1 ? "" : "s"} — the answers stay on your side until the reveal.</p>
      )}
      {cardTools.length > 0 && (
        <>
          <div className="gsw-seclabel" style={{ marginTop: 22 }}>Your question cards</div>
          <div className="gsw-shelf">
            {cardTools.map(tool => (
              <div key={tool.id} className="gsw-asset plain">
                <span className="gsw-ak">{tool.type === "card-list" ? "Question list" : "Cards"}</span>
                <span className="gsw-an" style={{ position: "static" }}>{tool.name}<br />
                  <span style={{ color: "#948bb3", fontWeight: 600, fontSize: 12 }}>{tool.type === "card-list" ? `${quizQuestionsOf(tool).length} questions` : "Your design — your background, font, and colors"}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {jewelPanel}
      <div className="gsw-card" style={{ marginTop: 14 }}>
        <h4>Follow-ups, on cards you design</h4>
        <p>No right-or-wrong answers — questions that keep the conversation going after your prompt. The cards are your design: your own background, text color, font and all. Design them yourself here; the questions themselves you settle with Jewel.</p>
        <div className="gsw-chipsrow">
          <button type="button" className="gsw-jchip" onClick={() => anyCardTool ? doors.openCardEditor(anyCardTool.id) : doors.createQuizCards()}>{anyCardTool ? "Open the card designer" : "Design my cards"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Media ---------------- */

function MediaStage({ project, doors, jewelPanel }: StageProps) {
  const youtube = (project.gameTools || []).find(t => t.enabled && t.type === "youtube");
  const backdrop = demoBackdrop(project);
  const media = (project.assets || []).filter(asset => asset.role !== "background");
  return (
    <div>
      {media.length ? (
        <>
          <div className="gsw-seclabel">Your media — stored here</div>
          <div className="gsw-shelf">
            {media.map(asset => (
              <div key={assetKey(asset)} className="gsw-asset">
                <AssetThumbnail asset={asset} kind={assetCategory(asset)} />
                <div className="gsw-shade" />
                <span className="gsw-ak">{asset.type}</span>
                <span className="gsw-an">{asset.name}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="gsw-seclabel">Examples — the media Jewel can make with you</div>
          <div className="gsw-shelf">
            <div className="gsw-asset">
              <img src="/redesign/kind-talkshow.webp" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              <div className="gsw-shade" />
              <span className="gsw-ak">Opening · Example</span>
              <span className="gsw-an">Opening sequence &amp; theme song</span>
            </div>
            <div className="gsw-asset">
              <img src="/redesign/kind-radio.webp" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              <div className="gsw-shade" />
              <span className="gsw-ak">Cutscene · Example</span>
              <span className="gsw-an">Short commercial cutscene</span>
            </div>
            <div className="gsw-asset">
              {backdrop ? <BackdropStageMedia asset={backdrop} /> : <ExampleStageMedia />}
              <div className="gsw-shade" style={{ background: "rgba(8,6,14,.38)" }} />
              <div className="tsw-ytcenter"><div className="tsw-ytplay" aria-hidden="true">▶</div></div>
              <span className="gsw-ak">Video moment · Example</span>
              <span className="gsw-an">A YouTube video, playing on your backdrop<br /><span style={{ color: "#cfc8e6", fontWeight: 600, fontSize: 12 }}>{youtube ? "✓ YouTube is on your dashboard" : "Jewel can add it to your dashboard"}</span></span>
            </div>
          </div>
        </>
      )}
      {youtube && media.length > 0 && <p className="gsw-demostatus" style={{ marginTop: 10 }}>✓ YouTube is on your dashboard — during the show you search privately and send the video to your backdrop.</p>}
      {jewelPanel}
      <div className="gsw-card" style={{ marginTop: 14 }}>
        <h4>Upload your media</h4>
        <p>Your own clips, images, and sounds file here — ready for your show.</p>
        <div className="gsw-chipsrow"><button type="button" className="gsw-demobtn gold" onClick={doors.uploadMedia}>Upload media</button></div>
      </div>
    </div>
  );
}

/* ---------------- Anything we missed? ---------------- */

function MissedStage({ project, onSaveProject, jewelPanel }: StageProps) {
  const tools = (project.gameTools || []).filter(tool => TALK_TOOL_TYPES.includes(tool.type));
  const toolStatus = (tool: (typeof tools)[number]) => tool.type === "trivia-list"
    ? `${quizQuestionsOf(tool).length} quiz questions`
    : tool.type === "youtube"
      ? "In your dashboard toolbox"
      : (tool.inToolbox ? "✓ In Dashboard Toolbox" : "Saved in toolbox");
  return (
    <div>
      <div className="gsw-display" style={{ fontSize: 22, marginBottom: 10 }}>Anything we missed?</div>
      <p className="gsw-hint" style={{ marginBottom: 14 }}>Any other idea for your show — tell Jewel in your conversation, and she’ll try to handle it. What you’ve made together is stored here.</p>
      {jewelPanel}
      <div className="gsw-seclabel">Your tools</div>
      {tools.length ? (
        <div className="gsw-shelf">
          {tools.map(tool => (
            <div key={tool.id} className="gsw-asset plain">
              <span className="gsw-ak">{tool.type.replace(/-/g, " ")}</span>
              <span className="gsw-an" style={{ position: "static" }}>{tool.name}<br /><span style={{ color: "#948bb3", fontWeight: 600, fontSize: 12 }}>{toolStatus(tool)}</span></span>
            </div>
          ))}
        </div>
      ) : (
        <p className="gsw-hint">Nothing in the toolbox yet — the things you make with Jewel land here.</p>
      )}
      <div style={{ marginTop: 16 }}>
        <DeckArranger project={project} onSaveProject={onSaveProject} bare />
      </div>
    </div>
  );
}

/* ---------------- The stage itself ---------------- */

export default function TalkshowStage({ project, workflow, doors, onSaveProject, jewelPanel }: StageProps & { workflow: WorkflowEvaluation }) {
  const steps = workflow.stages[0]?.steps || [];
  // Jewel's current topic: the model's first unfinished talk topic. Theme
  // is a creation-seeded fact, never a topic on this page — while it is
  // the only thing open, Jewel still begins at the background.
  const open = steps.find(step => !step.complete && (TALK_TOPICS as readonly string[]).includes(step.id));
  const topic: TalkTopic = (open?.id as TalkTopic) || "missed";
  const stageProps: StageProps = { project, doors, onSaveProject, jewelPanel };
  return (
    <section className="gsw" aria-label="Imagine and Create — your show, as Jewel builds it with you">
      <div className="gsw-liberty">
        <JewelAvatar size={58} />
        <div>
          <div className="gsw-lkick gsw-display">✦ Your creative liberty</div>
          <div className="gsw-ltext">{TALK_CREATIVITY_BANNER}</div>
        </div>
        <div className="gsw-lwand" aria-hidden="true">🪄</div>
      </div>
      {topic === "background" && <BackgroundStage {...stageProps} />}
      {topic === "prompt" && <PromptStage {...stageProps} />}
      {topic === "research" && <ResearchStage {...stageProps} />}
      {topic === "quiz" && <QuizStage {...stageProps} />}
      {topic === "media" && <MediaStage {...stageProps} />}
      {topic === "missed" && <MissedStage {...stageProps} />}
    </section>
  );
}
