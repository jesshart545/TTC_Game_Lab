import { NextResponse } from "next/server";
import type { Project } from "../../../lib/project";

// Public practice data is deliberately independent of accounts and published snapshots.
const project: Project = {
  id: "builtin-practice", slug: "builtin-practice", name: "Practice Game",
  description: "A self-contained practice game", status: "Draft", theme: "cyan",
  updatedAt: "2026-10-07", prompt: "", messages: [], assets: [{storageKey:"practice-circle",name:"Circle",type:"image",url:"/practice-circle.svg",inProject:false},{storageKey:"practice-star",name:"Star",type:"image",url:"/practice-star.svg",inProject:false}],
  assetPools:[{id:"practice-images",name:"Practice images",assetKeys:["practice-circle","practice-star"]}],
  overlay: { title: "Practice Game", subtitle: "Try the dashboard controls", showChat: false, showAlerts: false, showCharacter: false },
  wheel: { enabled: false, title: "", segments: [], spinning: false, visible: false },
  controls: [
    {id:"images",label:"Draw random image: Practice images",action:"cards.toggle.practice-picker",detail:"Draw one unused image; press again to remove it",toolIds:["practice-picker"]},
    {id:"scores",label:"Show Scores",action:"cards.toggle.practice-scores",detail:"Show or remove scores",toolIds:["practice-scores"]},
    {id:"prizes",label:"Show Prizes",action:"cards.toggle.practice-prizes",detail:"Show or remove prizes",toolIds:["practice-prizes"]},
    {id:"gifts",label:"Show Gift Guide",action:"cards.toggle.practice-gifts",detail:"Show or remove gift rules",toolIds:["practice-gifts"]},
    { id: "show", label: "Show Question", action: "cards.show.practice-cards", detail: "Draw an unused practice question", toolIds: ["practice-cards"] },
    { id: "reveal", label: "Reveal Answer", action: "cards.reveal.practice-cards", detail: "Reveal the matching answer", toolIds: ["practice-cards"] },
    { id: "clear", label: "Clear Card", action: "cards.clear.practice-cards", detail: "Hide the question or answer", toolIds: ["practice-cards"] },
    { id: "reset", label: "New Card Game", action: "cards.new-game.practice-cards", detail: "Reset used questions", toolIds: ["practice-cards"] },
  ],
  gameTools: [
    {id:"practice-picker",name:"Practice images",type:"random-picker",enabled:true,inToolbox:true,inOverlayBuild:true,config:{source:"images",assetPoolId:"practice-images"}},
    {id:"practice-scores",name:"Scores",type:"scoreboard",enabled:true,inToolbox:true,inOverlayBuild:true,config:{entries:[{id:"a",name:"Team A",score:0},{id:"b",name:"Team B",score:0}]}},
    {id:"practice-prizes",name:"Prizes",type:"prize-list",enabled:true,inToolbox:true,inOverlayBuild:true,config:{entries:[{id:"p",name:"Bonus round"}]}},
    {id:"practice-gifts",name:"Gift Guide",type:"game-tool-list",enabled:true,inToolbox:true,inOverlayBuild:true,config:{entries:[{id:"rose",name:"Rose",meaning:"Skip one question"}]}},
    { id: "practice-pool", type: "trivia-list", name: "Practice Question Pool", enabled: true, inToolbox: false, config: { questions: [
      { question: "What is 2 + 2?", answer: "4", category: "Arithmetic" },
      { question: "How many sides does a triangle have?", answer: "3", category: "Geometry" },
      { question: "What is 5 × 3?", answer: "15", category: "Arithmetic" },
    ] } },
    { id: "practice-cards", type: "question-card", name: "Practice Question Cards", enabled: true, inToolbox: true, inOverlayBuild: true, config: { poolId: "practice-pool", questionCard: { backgroundColor: "#101827", textColor: "#ffffff", accentColor: "#20e8ff", fontSize: 36 }, answerCard: { backgroundColor: "#241139", textColor: "#ffffff", accentColor: "#ef70ff", fontSize: 36 } } },
    { id: "practice-wheel", type: "wheel", name: "Spin Practice Wheel", enabled: true, inToolbox: true, inOverlayBuild: true, config: { segments: ["Bonus", "Challenge", "Mystery", "Prize"] } },
    { id: "practice-dice", type: "dice", name: "Roll Practice Dice", enabled: true, inToolbox: true, inOverlayBuild: true, config: { sides: 6 } },
    { id: "practice-timer", type: "countdown", name: "Start Optional Timer", enabled: true, inToolbox: true, inOverlayBuild: true, config: { seconds: 10 } },
  ],
};

export async function GET() {
  return NextResponse.json({ project }, { headers: { "Cache-Control": "no-store" } });
}

