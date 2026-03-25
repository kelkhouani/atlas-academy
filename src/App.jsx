import { useEffect, useState } from 'react';
import { fetchLessons } from './DataLoader';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Lock, Star, CheckCircle, X, ChevronRight, Trophy, Shield, Home, BookOpen, Gamepad2, User, Volume2 } from 'lucide-react';

// ─── Fix 4: playAudio helper ─────────────────────────────────────────────────
function playAudio(slug) {
  if (!slug) return;
  const filename = slug.endsWith('.mp3') ? slug : `${slug}.mp3`;
  const audio = new Audio(`/audio/${filename}`);
  audio.play().catch(() => {});
}

// ─── Fix 5: SpeakerButton component ──────────────────────────────────────────
function SpeakerButton({ slug }) {
  if (!slug) return null;
  return (
    <button
      onClick={() => playAudio(slug)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '4px 6px', borderRadius: '8px', color: 'var(--zgh-blue)',
        display: 'inline-flex', alignItems: 'center', flexShrink: 0,
        opacity: 0.8,
      }}
      aria-label="Hoor de uitspraak"
      title="Hoor de uitspraak"
    >
      <Volume2 size={20} />
    </button>
  );
}

// ─── Fix 2: parsePrompt — renders Image_Tag tokens as <img> elements ─────────
function parsePrompt(text) {
  if (!text) return text;
  const parts = text.split(/(Image_Tag:\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('Image_Tag:')) {
      const filename = part.replace('Image_Tag:', '');
      return (
        <img
          key={i}
          src={`/images/${filename}`}
          alt={filename.replace(/\.[^.]+$/, '')}
          style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 12, margin: '8px auto', display: 'block' }}
        />
      );
    }
    return part;
  });
}

// ─── Fix 3: streak helpers ────────────────────────────────────────────────────
function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}
function calcNewStreak(currentStreak, lastStreakDate) {
  const today = getTodayString();
  if (lastStreakDate === today) return { streak: currentStreak, lastStreakDate };
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
  if (lastStreakDate === yStr) return { streak: currentStreak + 1, lastStreakDate: today };
  return { streak: 1, lastStreakDate: today };
}

function App() {
  // --- 1. STATE MANAGEMENT ---
  const [allLessons, setAllLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('map');
  const [activeUnit, setActiveUnit] = useState(null);
  const [activeSubUnit, setActiveSubUnit] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [selectedWords, setSelectedWords] = useState([]);
  const [isCorrect, setIsCorrect] = useState(null);
  const [isFinished, setIsFinished] = useState(false);
  const [hearts, setHearts] = useState(3);
  // Fix 1: track the correct answer to show on wrong response
  const [correctAnswerToShow, setCorrectAnswerToShow] = useState(null);

  // App Shell & User States
  const [activeTab, setActiveTab] = useState('home');
  const [xp, setXp] = useState(parseInt(localStorage.getItem('zgh_xp')) || 0);
  // Fix 3: streak now tracked with a date string
  const [streak, setStreak] = useState(parseInt(localStorage.getItem('zgh_streak')) || 0);
  const [lastStreakDate, setLastStreakDate] = useState(localStorage.getItem('zgh_lastStreakDate') || '');
  const [userName, setUserName] = useState(localStorage.getItem('zgh_user_name') || 'Leerling');
  const [userAvatar, setUserAvatar] = useState(localStorage.getItem('zgh_user_avatar') || '🦁');
  const [showXpPopup, setShowXpPopup] = useState(false);
  const [currentLessonSet, setCurrentLessonSet] = useState([]);
  const [completedSubUnits, setCompletedSubUnits] = useState(
    JSON.parse(localStorage.getItem('zgh_completed_subunits')) || []
  );

  // --- 2. DATA LADEN ---
  useEffect(() => {
    fetchLessons().then(data => {
      setAllLessons(data);
      setLoading(false);
    }).catch(err => {
      console.error("Fout bij laden:", err);
      setLoading(false);
    });
  }, []);

  // --- 3. DATA ORGANISATIE ---
  const units = [...new Set(allLessons.map(l => parseInt(l.Unit_ID)))]
    .sort((a, b) => a - b)
    .map(uId => {
      const unitLessons = allLessons.filter(l => parseInt(l.Unit_ID) === uId);
      const subUnitIds = [...new Set(unitLessons.map(l => l.SubUnit_ID))];
      return {
        id: uId,
        name: unitLessons[0]?.Unit_Name || `Unit ${uId}`,
        subUnits: subUnitIds.map(sId => ({
          id: sId,
          name: unitLessons.find(l => l.SubUnit_ID === sId)?.SubUnit_Name || `Les ${sId}`,
          isFinal: String(sId).toLowerCase() === 'final'
        }))
      };
    });

  const calculateLevel = (currentXp) => Math.floor(currentXp / 500) + 1;
  const xpToNextLevel = 500 - (xp % 500);
  const currentLevel = calculateLevel(xp);

  const addXp = (amount) => {
    const newXp = xp + amount;
    setXp(newXp);
    localStorage.setItem('zgh_xp', newXp);
    setShowXpPopup(true);
    setTimeout(() => setShowXpPopup(false), 1000);
  };

  // --- 4. INTERACTIE ---
  const startLesson = (uId, sId) => {
    // Fix 3: update streak with proper date comparison on lesson start
    const { streak: newStreak, lastStreakDate: newDate } = calcNewStreak(streak, lastStreakDate);
    setStreak(newStreak);
    setLastStreakDate(newDate);
    localStorage.setItem('zgh_streak', newStreak);
    localStorage.setItem('zgh_lastStreakDate', newDate);

    let questions = [];
    if (String(sId).toLowerCase() === 'final') {
      const pool = allLessons.filter(l => parseInt(l.Unit_ID) === uId && String(l.SubUnit_ID).toLowerCase() !== 'final');
      questions = pool.sort(() => 0.5 - Math.random()).slice(0, 10);
    } else {
      questions = allLessons.filter(l => parseInt(l.Unit_ID) === uId && l.SubUnit_ID === sId);
    }

    if (questions.length === 0) return;

    setCurrentIndex(0);
    setSelectedOption(null);
    setSelectedWords([]);
    setIsCorrect(null);
    setCorrectAnswerToShow(null); // Fix 1: reset on new lesson
    setIsFinished(false);
    setHearts(3);
    setCurrentLessonSet(questions);
    setActiveUnit(uId);
    setActiveSubUnit(sId);
    setView('lesson');
  };

  const addWord = (word) => { if (isCorrect === null) setSelectedWords([...selectedWords, word]); };
  const removeWord = (index) => {
    if (isCorrect === null) {
      const n = [...selectedWords];
      n.splice(index, 1);
      setSelectedWords(n);
    }
  };

  const handleCheck = () => {
    const currentLesson = currentLessonSet[currentIndex];
    const userAnswer = currentLesson.Type === 'translate' ? selectedWords.join(' ') : selectedOption;
    const clean = (str) => str?.toLowerCase().trim().replace(/[.,!?;]$/, '');

    if (clean(userAnswer) === clean(currentLesson.Solution)) {
      setIsCorrect(true);
      setCorrectAnswerToShow(null); // Fix 1: no need to show on correct
      addXp(10);
      // Fix 4: play the question's audio on a correct answer
      playAudio(currentLesson.Audio_Slug);
    } else {
      setIsCorrect(false);
      setCorrectAnswerToShow(currentLesson.Solution); // Fix 1: stash the right answer
      setHearts(prev => Math.max(0, prev - 1));
      setCurrentLessonSet(prev => [...prev, { ...currentLesson }]);
    }
  };

  const handleNext = () => {
    if (currentIndex < currentLessonSet.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setSelectedWords([]);
      setIsCorrect(null);
      setCorrectAnswerToShow(null); // Fix 1: clear on advance
    } else {
      setIsFinished(true);
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      addXp(hearts === 3 ? 50 : 25);

      const subUnitKey = `${activeUnit}-${activeSubUnit}`;
      if (activeUnit && !completedSubUnits.includes(subUnitKey)) {
        const nProgress = [...completedSubUnits, subUnitKey];
        setCompletedSubUnits(nProgress);
        localStorage.setItem('zgh_completed_subunits', JSON.stringify(nProgress));
      }
      setTimeout(() => { setView('map'); setIsFinished(false); }, 3500);
    }
  };

  // --- 5. RENDER HELPERS ---
  const renderHome = () => (
    <div className="app-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <section style={{ backgroundColor: 'var(--zgh-blue)', borderRadius: '25px', padding: '30px', color: 'white', margin: '20px 0 30px', boxShadow: '0 10px 20px rgba(0,153,204,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px' }}>Salam, {userName}! {userAvatar}</h2>
            <p style={{ fontSize: '18px', opacity: 0.9 }}>Level {currentLevel} • {streak} dagen streak</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold' }}>NOG {xpToNextLevel} XP</div>
            <div style={{ width: '80px', height: '8px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '10px', marginTop: '5px' }}>
              <div style={{ width: `${((xp % 500) / 500) * 100}%`, height: '100%', backgroundColor: 'var(--zgh-yellow)', borderRadius: '10px' }} />
            </div>
          </div>
        </div>
        <button onClick={() => setActiveTab('lessons')} style={{ backgroundColor: 'white', color: 'var(--zgh-blue)', border: 'none', padding: '15px 30px', borderRadius: '15px', fontWeight: 'bold', marginTop: '20px', cursor: 'pointer' }}>
          VERDER LEREN
        </button>
      </section>
      <h3 style={{ fontSize: '20px', marginBottom: '20px' }}>Jouw Voortgang</h3>
      <div style={{ display: 'grid', gap: '20px' }}>
        {units.length > 0 ? units.slice(0, 2).map(unit => {
          const completedCount = unit.subUnits.filter(s => completedSubUnits.includes(`${unit.id}-${s.id}`)).length;
          const progress = Math.round((completedCount / unit.subUnits.length) * 100);
          return (
            <div key={unit.id} style={{ border: '2px solid var(--zgh-gray)', padding: '20px', borderRadius: '20px', backgroundColor: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontWeight: 'bold' }}>{unit.name}</span>
                <span style={{ color: 'var(--zgh-blue)', fontWeight: 'bold' }}>{progress}%</span>
              </div>
              <div style={{ height: '12px', backgroundColor: 'var(--zgh-gray)', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', backgroundColor: 'var(--zgh-green)', transition: 'width 1s ease' }}></div>
              </div>
            </div>
          );
        }) : <p>Lessen worden geladen...</p>}
      </div>
    </div>
  );

  const renderMap = () => (
    <div className="app-container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 20px 100px' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: 'var(--zgh-blue)', fontSize: '36px', marginBottom: '5px' }}>Lessenoverzicht</h1>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '30px' }}>
        {units.map((unit, unitIdx) => {
          const previousUnit = units[unitIdx - 1];
          let isUnitLocked = previousUnit ? !previousUnit.subUnits.every(s => completedSubUnits.includes(`${previousUnit.id}-${s.id}`)) : false;
          return (
            <div key={unit.id} style={{ border: '2px solid var(--zgh-gray)', borderRadius: '25px', backgroundColor: 'white', overflow: 'hidden', opacity: isUnitLocked ? 0.6 : 1 }}>
              <div style={{ padding: '25px', backgroundColor: '#f7f7f7', borderBottom: '2px solid var(--zgh-gray)', display: 'flex', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, fontSize: '18px' }}>Unit {unit.id}: {unit.name}</h2>
                {isUnitLocked && <Lock size={18} color="#ccc" />}
              </div>
              <div style={{ padding: '15px' }}>
                {unit.subUnits.map((sub, subIdx) => {
                  const isDone = completedSubUnits.includes(`${unit.id}-${sub.id}`);
                  const isSubLocked = isUnitLocked || (subIdx > 0 && !completedSubUnits.includes(`${unit.id}-${unit.subUnits[subIdx - 1].id}`));
                  return (
                    <div key={sub.id} onClick={() => !isSubLocked && startLesson(unit.id, sub.id)} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', cursor: isSubLocked ? 'default' : 'pointer', opacity: isSubLocked ? 0.5 : 1 }}>
                      <div style={{ width: '35px', height: '35px', borderRadius: '50%', backgroundColor: isSubLocked ? '#ccc' : (isDone ? 'var(--zgh-green)' : (sub.isFinal ? 'var(--zgh-yellow)' : 'var(--zgh-blue)')), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                        {isDone ? <CheckCircle size={18} /> : <Star size={18} />}
                      </div>
                      <span style={{ flex: 1, fontWeight: 'bold' }}>{sub.name}</span>
                      {!isSubLocked && <ChevronRight size={18} color="#ccc" />}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="app-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{ fontSize: '64px' }}>{userAvatar}</div>
        <h2 style={{ color: 'var(--zgh-blue)', margin: '10px 0' }}>{userName}</h2>
        <div style={{ color: 'var(--zgh-yellow)', fontWeight: 'bold' }}>LEVEL {currentLevel}</div>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <div style={{ border: '2px solid var(--zgh-gray)', padding: '20px', borderRadius: '20px', backgroundColor: 'white' }}>
          <h4 style={{ color: 'var(--zgh-red)', marginTop: 0 }}>Naam</h4>
          <input type="text" value={userName} onChange={(e) => { setUserName(e.target.value); localStorage.setItem('zgh_user_name', e.target.value); }} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid var(--zgh-gray)' }} />
        </div>
        <div style={{ border: '2px solid var(--zgh-gray)', padding: '20px', borderRadius: '20px', backgroundColor: 'white' }}>
          <h4 style={{ color: 'var(--zgh-red)', marginTop: 0 }}>Avatar</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {["🦁", "🏔️", "🌴", "🍲", "⭐", "🐪"].map(a => (
              <button key={a} onClick={() => { setUserAvatar(a); localStorage.setItem('zgh_user_avatar', a); }} style={{ fontSize: '20px', padding: '10px', borderRadius: '10px', border: userAvatar === a ? '2px solid var(--zgh-green)' : '1px solid var(--zgh-gray)', backgroundColor: 'white' }}>{a}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // --- 6. HOOFD RENDER LOGICA ---
  if (loading) return <div style={{ textAlign: 'center', padding: '100px' }}><h2>Atlas Academy laden...</h2></div>;

  if (view === 'lesson') {
    const currentLesson = currentLessonSet[currentIndex];
    if (hearts === 0) return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <h1>💔</h1>
        <button onClick={() => setView('map')} style={{ padding: '15px 30px', borderRadius: '15px', backgroundColor: 'var(--zgh-blue)', color: 'white', border: 'none' }}>TERUG</button>
      </div>
    );
    if (isFinished) return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <Trophy size={80} color="gold" /><h1>Mabrouk! 🎉</h1>
      </div>
    );

    return (
      <div className="app-container" style={{ maxWidth: '1100px', width: '95%', margin: '0 auto', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px' }}>
          <X onClick={() => setView('map')} style={{ cursor: 'pointer' }} color="#afafaf" size={32} />
          <div style={{ flex: 1, height: '12px', background: 'var(--zgh-gray)', borderRadius: '10px' }}>
            <motion.div animate={{ width: `${(currentIndex / currentLessonSet.length) * 100}%` }} style={{ height: '100%', background: 'var(--zgh-green)', borderRadius: '10px' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--zgh-red)' }}>❤️ {hearts}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          {/* Fix 5: speaker button next to the question prompt */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '8px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '28px', margin: 0 }}>
              {currentLesson?.Type === 'translate' ? 'Vertaal deze zin:' : parsePrompt(currentLesson?.Prompt_NL)}
            </h2>
            <SpeakerButton slug={currentLesson?.Audio_Slug} />
          </div>
          {/* Fix 2: parsePrompt renders Image_Tag tokens in the Tarifit source sentence */}
          {currentLesson?.Type === 'translate' && (
            <div style={{ padding: '30px', backgroundColor: '#f7f7f7', borderRadius: '20px', marginBottom: '20px', fontSize: '24px', fontWeight: 'bold', color: 'var(--zgh-blue)' }}>
              {parsePrompt(currentLesson?.Prompt_ZGH)}
            </div>
          )}
          {currentLesson?.Type === 'translate' && (
            <div style={{ minHeight: '60px', borderBottom: '2px solid var(--zgh-gray)', marginBottom: '30px', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {selectedWords.map((word, i) => (
                <button key={i} onClick={() => removeWord(i)} style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--zgh-gray)', marginBottom: '20px', backgroundColor: 'white' }}>{word}</button>
              ))}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
            {currentLesson?.Options.map((opt, i) => {
              const isUsed = currentLesson.Type === 'translate' && selectedWords.includes(opt);
              return (
                <button key={i} disabled={isUsed || isCorrect !== null} onClick={() => currentLesson.Type === 'translate' ? addWord(opt) : setSelectedOption(opt)}
                  style={{ padding: '20px', borderRadius: '15px', border: `2px solid ${selectedOption === opt ? 'var(--zgh-blue)' : 'var(--zgh-gray)'}`, backgroundColor: isUsed ? 'var(--zgh-gray)' : 'white', fontWeight: 'bold' }}>
                  {opt}
                </button>
              );
            })}
          </div>
          {/* Fix 1: feedback bar now shows correct answer when wrong */}
          <AnimatePresence>
            {isCorrect !== null && (
              <motion.div initial={{ y: 100 }} animate={{ y: 0 }} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '30px', backgroundColor: isCorrect ? '#d7ffb8' : '#ffdfe0', zIndex: 2000 }}>
                <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ fontWeight: 'bold', color: isCorrect ? 'var(--zgh-green)' : 'var(--zgh-red)', display: 'block' }}>
                      {isCorrect ? 'Goed gedaan! ✅' : 'Oeps! ❌'}
                    </span>
                    {/* Fix 1: show correct answer on wrong response */}
                    {!isCorrect && correctAnswerToShow && (
                      <span style={{ fontSize: '14px', color: 'var(--zgh-red)', display: 'block', marginTop: '4px' }}>
                        Juist antwoord: <strong>{correctAnswerToShow}</strong>
                      </span>
                    )}
                  </div>
                  <button onClick={handleNext} style={{ padding: '12px 25px', borderRadius: '12px', border: 'none', backgroundColor: isCorrect ? 'var(--zgh-green)' : 'var(--zgh-red)', color: 'white', fontWeight: 'bold', flexShrink: 0 }}>
                    VOLGENDE
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {isCorrect === null && (
            <button disabled={!selectedOption && selectedWords.length === 0} onClick={handleCheck}
              style={{ marginTop: '30px', padding: '15px 50px', borderRadius: '15px', backgroundColor: (selectedOption || selectedWords.length > 0) ? 'var(--zgh-green)' : 'var(--zgh-gray)', color: 'white', border: 'none', fontWeight: 'bold' }}>
              CONTROLEER
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fcfcfc' }}>
      <header style={{ position: 'sticky', top: 0, backgroundColor: 'white', borderBottom: '2px solid var(--zgh-gray)', padding: '10px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1000 }}>
        <div style={{ fontWeight: '900', color: 'var(--zgh-blue)', fontSize: '16px' }}>ATLAS ACADEMY</div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: '#f0f7ff', padding: '4px 10px', borderRadius: '20px' }}>
            <Shield size={14} color="var(--zgh-blue)" fill="var(--zgh-blue)" />
            <span style={{ fontWeight: '800', color: 'var(--zgh-blue)', fontSize: '13px' }}>{currentLevel}</span>
          </div>
          <div style={{ position: 'relative' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--zgh-yellow)', fontSize: '15px' }}>🏆 {xp}</span>
            <AnimatePresence>
              {showXpPopup && (
                <motion.span initial={{ y: 0, opacity: 1 }} animate={{ y: -25, opacity: 0 }}
                  style={{ position: 'absolute', right: 0, color: 'var(--zgh-green)', fontWeight: 'bold', fontSize: '12px' }}>
                  +XP
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <span style={{ fontWeight: 'bold', color: 'var(--zgh-red)', fontSize: '15px' }}>🔥 {streak}</span>
        </div>
      </header>
      <main style={{ paddingBottom: '90px' }}>
        {activeTab === 'home' && renderHome()}
        {activeTab === 'lessons' && renderMap()}
        {activeTab === 'fun' && <div style={{ textAlign: 'center', padding: '100px' }}><h2>🎮 Mini-games komen eraan!</h2></div>}
        {activeTab === 'profile' && renderProfile()}
      </main>
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '75px', backgroundColor: 'white', borderTop: '2px solid var(--zgh-gray)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 1000 }}>
        <button onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', color: activeTab === 'home' ? 'var(--zgh-blue)' : '#ccc', cursor: 'pointer' }}><Home size={24} /><br /><span style={{ fontSize: '10px', fontWeight: 'bold' }}>HOME</span></button>
        <button onClick={() => setActiveTab('lessons')} style={{ background: 'none', border: 'none', color: activeTab === 'lessons' ? 'var(--zgh-blue)' : '#ccc', cursor: 'pointer' }}><BookOpen size={24} /><br /><span style={{ fontSize: '10px', fontWeight: 'bold' }}>LESSEN</span></button>
        <button onClick={() => setActiveTab('fun')} style={{ background: 'none', border: 'none', color: activeTab === 'fun' ? 'var(--zgh-blue)' : '#ccc', cursor: 'pointer' }}><Gamepad2 size={24} /><br /><span style={{ fontSize: '10px', fontWeight: 'bold' }}>FUN</span></button>
        <button onClick={() => setActiveTab('profile')} style={{ background: 'none', border: 'none', color: activeTab === 'profile' ? 'var(--zgh-blue)' : '#ccc', cursor: 'pointer' }}><User size={24} /><br /><span style={{ fontSize: '10px', fontWeight: 'bold' }}>PROFIEL</span></button>
      </nav>
    </div>
  );
}

export default App;
