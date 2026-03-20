import { useState } from 'react';
import { GENERAL_PATH } from './data/generalPath';
import { PHAROS_PATH } from './data/monadPath';
import NFTGate from './components/NFTGate';
import PathSelect from './components/PathSelect';
import ModuleView from './components/ModuleView';
import ConceptLesson from './components/ConceptLesson';
import CodeLesson from './components/CodeLesson';
import FillBlankLesson from './components/FillBlankLesson';
import FixBugLesson from './components/FixBugLesson';
import ReorderLesson from './components/ReorderLesson';
import OutputPredictLesson from './components/OutputPredictLesson';
import CelebrationScreen from './components/CelebrationScreen';
import { useProgress } from './hooks/useProgress';
import './styles/academy.css';

const LESSON_COMPONENTS = {
  concept: ConceptLesson,
  code: CodeLesson,
  'fill-blank': FillBlankLesson,
  'fix-bug': FixBugLesson,
  reorder: ReorderLesson,
  'output-predict': OutputPredictLesson,
};

export default function DevAcademy() {
  const [screen, setScreen] = useState("gate");
  const [dev, setDev] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);
  const [currentModule, setCurrentModule] = useState(null);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [celebration, setCelebration] = useState(null);

  const wallet = null;
  const { progress, xp, completeLesson } = useProgress(wallet, dev?.devId);

  const handleVerified = d => { setDev(d); setScreen("paths"); };
  const handleSkip = () => { setDev({ devId: 0, species: "Demo", demo: true }); setScreen("paths"); };
  const handleSelectPath = id => { setSelectedPath(id === "general" ? GENERAL_PATH : PHAROS_PATH); setScreen("modules"); };
  const handleStartLesson = (mod, lesson) => { setCurrentModule(mod); setCurrentLesson(lesson); setScreen("lesson"); };

  const handleLessonComplete = correct => {
    if (!correct) return;
    const pathId = selectedPath.id;
    completeLesson(currentLesson.id, pathId, currentLesson.xp);

    const all = selectedPath.modules.flatMap(m => m.lessons.map(l => ({ mod: m, lesson: l })));
    const idx = all.findIndex(x => x.lesson.id === currentLesson.id);

    // Check if this completes a module
    const modLessons = currentModule.lessons;
    const modDoneAfter = modLessons.filter(l => progress[l.id] || l.id === currentLesson.id).length;
    const moduleJustCompleted = modDoneAfter === modLessons.length;

    // Check if this completes the entire path
    const pathDoneAfter = all.filter(x => progress[x.lesson.id] || x.lesson.id === currentLesson.id).length;
    const pathJustCompleted = pathDoneAfter === all.length;

    if (pathJustCompleted) {
      const totalXp = all.reduce((sum, x) => sum + x.lesson.xp, 0);
      setCelebration({ type: 'path', data: { pathName: selectedPath.name, xpEarned: totalXp, lessonsCompleted: all.length } });
      setScreen("celebration");
    } else if (moduleJustCompleted) {
      const modXp = modLessons.reduce((sum, l) => sum + l.xp, 0);
      setCelebration({ type: 'module', data: { moduleName: currentModule.title, corp: currentModule.corp, xpEarned: modXp, lessonsCompleted: modLessons.length } });
      setScreen("celebration");
    } else if (idx < all.length - 1) {
      setCurrentModule(all[idx + 1].mod);
      setCurrentLesson(all[idx + 1].lesson);
    } else {
      setScreen("modules");
    }
  };

  const handleCelebrationContinue = () => {
    if (celebration?.type === 'path') {
      setScreen("paths");
    } else {
      setScreen("modules");
    }
    setCelebration(null);
  };

  const renderLesson = () => {
    if (!currentLesson) return null;
    const LessonComponent = LESSON_COMPONENTS[currentLesson.type];
    if (!LessonComponent) return <div style={{ padding: 40, color: '#f43f5e' }}>Unknown lesson type: {currentLesson.type}</div>;
    return <LessonComponent lesson={currentLesson} corp={currentModule.corp} onComplete={handleLessonComplete} />;
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
          {screen !== "paths" && screen !== "celebration" && (
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
      {screen === "lesson" && renderLesson()}
      {screen === "celebration" && celebration && <CelebrationScreen type={celebration.type} data={celebration.data} onContinue={handleCelebrationContinue} />}
    </div>
  );
}
