import { useState } from 'react';
import { GENERAL_PATH } from './data/generalPath';
import { MONAD_PATH } from './data/monadPath';
import NFTGate from './components/NFTGate';
import PathSelect from './components/PathSelect';
import ModuleView from './components/ModuleView';
import ConceptLesson from './components/ConceptLesson';
import CodeLesson from './components/CodeLesson';
import { useProgress } from './hooks/useProgress';
import './styles/academy.css';

export default function DevAcademy() {
  const [screen, setScreen] = useState("gate");
  const [dev, setDev] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);
  const [currentModule, setCurrentModule] = useState(null);
  const [currentLesson, setCurrentLesson] = useState(null);

  const wallet = null; // Will use portal wallet when available
  const { progress, xp, completeLesson } = useProgress(wallet, dev?.devId);

  const handleVerified = d => { setDev(d); setScreen("paths"); };
  const handleSkip = () => { setDev({ devId: 0, species: "Demo", demo: true }); setScreen("paths"); };
  const handleSelectPath = id => { setSelectedPath(id === "general" ? GENERAL_PATH : MONAD_PATH); setScreen("modules"); };
  const handleStartLesson = (mod, lesson) => { setCurrentModule(mod); setCurrentLesson(lesson); setScreen("lesson"); };

  const handleLessonComplete = correct => {
    if (!correct) return;
    const pathId = selectedPath.id;
    completeLesson(currentLesson.id, pathId, currentLesson.xp);
    const all = selectedPath.modules.flatMap(m => m.lessons.map(l => ({ mod: m, lesson: l })));
    const idx = all.findIndex(x => x.lesson.id === currentLesson.id);
    if (idx < all.length - 1) { setCurrentModule(all[idx + 1].mod); setCurrentLesson(all[idx + 1].lesson); }
    else setScreen("modules");
  };

  return (
    <div className="dev-academy-root">
      {dev && screen !== "gate" && (
        <nav className="da-nav">
          <span style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, fontFamily: "monospace", letterSpacing: "-0.5px" }}>DA</span>
          <span style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600 }}>Dev Academy</span>
          <div style={{ flex: 1 }} />
          <span style={{ color: "#eab308", fontSize: 13, fontWeight: 600 }}>{xp} XP</span>
          <span style={{ color: "#64748b", fontSize: 12 }}>{Object.values(progress).filter(Boolean).length} lessons</span>
          <span style={{ background: "#1e293b", borderRadius: 6, padding: "3px 9px", color: "#94a3b8", fontSize: 12 }}>
            {dev.demo ? "Demo" : `#${dev.devId}`}
          </span>
          {screen !== "paths" && (
            <button onClick={() => screen === "lesson" ? setScreen("modules") : setScreen("paths")}
              style={{ background: "none", border: "1px solid #1e293b", borderRadius: 6, color: "#64748b", cursor: "pointer", padding: "3px 10px", fontSize: 12, fontFamily: "system-ui, sans-serif" }}>
              &larr;
            </button>
          )}
        </nav>
      )}

      {screen === "gate" && <NFTGate onVerified={handleVerified} onSkip={handleSkip} />}
      {screen === "paths" && <PathSelect dev={dev} onSelect={handleSelectPath} progress={progress} />}
      {screen === "modules" && selectedPath && <ModuleView pathData={selectedPath} progress={progress} xp={xp} onStartLesson={handleStartLesson} onBack={() => setScreen("paths")} />}
      {screen === "lesson" && currentLesson && (
        currentLesson.type === "concept"
          ? <ConceptLesson lesson={currentLesson} corp={currentModule.corp} onComplete={handleLessonComplete} />
          : <CodeLesson lesson={currentLesson} corp={currentModule.corp} onComplete={handleLessonComplete} />
      )}
    </div>
  );
}
