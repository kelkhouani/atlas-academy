import { useEffect, useState } from 'react';
import { fetchLessons } from './DataLoader';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Flame, Home, BookOpen, Gamepad2, User, Zap, Medal, CheckCircle2 } from 'lucide-react';
import LessonView from './components/LessonView';
import LessonMap from './components/LessonMap';
import './App.css';

// ─── Amazigh flag — exact official SVG ───────────────────────────────────────
function AmazighFlag({ height = 20 }) {
  const w = Math.round(height * 1.5);
  return (
    <svg
      width={w} height={height}
      viewBox="0 0 900 600"
      style={{ borderRadius: 3, display: 'block', flexShrink: 0 }}
      aria-label="Amazigh flag"
    >
      <rect fill="#0090DA" width="900" height="200" />
      <rect fill="#78BE20" y="200" width="900" height="200" />
      <rect fill="#FEDD00" y="400" width="900" height="200" />
      {/* Yaz symbol — vertical bar */}
      <polygon fill="#CC0033" points="429.675,477.64 458.13,507.721 466.26,97.9695 450,80.8966" />
      {/* Yaz symbol — lower arc */}
      <path fill="#CC0033" d="M657.315 515.851l54.4711 -23.5769c-104.877,-104.064 -165.039,-142.275 -264.225,-144.714 -126.015,8.94308 -208.128,59.3489 -243.087,159.348l24.3898 -4.87785c99.9991,-123.576 156.909,-109.755 220.323,-117.072 67.4791,2.43908 136.584,46.3409 208.128,130.893l0 -0.000307692z" />
      {/* Yaz symbol — upper arc */}
      <path fill="#CC0033" d="M289.839 93.0917l-52.032 13.8209c50.4058,89.4298 122.763,143.901 215.445,147.966 122.763,0.812923 193.494,-82.1129 242.274,-156.909l-41.4631 12.1951c-78.8609,111.381 -164.226,115.446 -202.437,109.755 -64.2271,-4.87785 -117.072,-57.7231 -161.787,-126.828z" />
    </svg>
  );
}

// ─── Atlas Lion mascot ────────────────────────────────────────────────────────
function LionMascot({ size = 80 }) {
  return (
    <img
      src="/lion.png"
      alt="Atlas Lion"
      className="lion-mascot"
      style={{ height: size, width: 'auto' }}
    />
  );
}

// ─── Audio helper ─────────────────────────────────────────────────────────────
function playAudio(slug) {
  if (!slug) return;
  const filename = slug.endsWith('.mp3') ? slug : `${slug}.mp3`;
  const audio = new Audio(`/audio/${filename}`);
  audio.play().catch(() => {});
}

// ─── Sound effects via Web Audio API ─────────────────────────────────────────
function playSfx(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (type === 'correct') {
      // Cheerful ascending two-note chime
      [[440, 0, 0.12], [660, 0.13, 0.25]].forEach(([freq, start, end]) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.35, ctx.currentTime + start);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + end);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + end);
      });
    } else {
      // Low descending "oops" tone
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.3);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (_) {}
}

// ─── Streak helpers ───────────────────────────────────────────────────────────
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
  // ── State ──────────────────────────────────────────────────────────────────
  const [allLessons, setAllLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('map');
  const [activeUnit, setActiveUnit] = useState(null);
  const [activeSubUnit, setActiveSubUnit] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [selectedWords, setSelectedWords] = useState([]);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState(null);
  const [isFinished, setIsFinished] = useState(false);
  const [hearts, setHearts] = useState(3);
  const [correctAnswerToShow, setCorrectAnswerToShow] = useState(null);

  const [activeTab, setActiveTab] = useState('home');
  const [xp, setXp] = useState(parseInt(localStorage.getItem('zgh_xp')) || 0);
  const [streak, setStreak] = useState(parseInt(localStorage.getItem('zgh_streak')) || 0);
  const [lastStreakDate, setLastStreakDate] = useState(localStorage.getItem('zgh_lastStreakDate') || '');
  const [userName, setUserName] = useState(localStorage.getItem('zgh_user_name') || 'Leerling');
  const [userAvatar, setUserAvatar] = useState(localStorage.getItem('zgh_user_avatar') || '🦁');
  const [showXpPopup, setShowXpPopup] = useState(false);
  const [currentLessonSet, setCurrentLessonSet] = useState([]);
  const [completedSubUnits, setCompletedSubUnits] = useState(
    JSON.parse(localStorage.getItem('zgh_completed_subunits')) || []
  );

  // ── Data loading ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchLessons().then(data => {
      setAllLessons(data);
      setLoading(false);
    }).catch(err => {
      console.error("Fout bij laden:", err);
      setLoading(false);
    });
  }, []);

  // ── Data organisation ──────────────────────────────────────────────────────
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

  // ── Interaction handlers ───────────────────────────────────────────────────
  const startLesson = (uId, sId) => {
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
    setTypedAnswer('');
    setIsCorrect(null);
    setCorrectAnswerToShow(null);
    setIsFinished(false);
    setHearts(3);
    setCurrentLessonSet(questions);
    setActiveUnit(uId);
    setActiveSubUnit(sId);
    setView('lesson');
  };

  const addWord    = (word)  => { if (isCorrect === null) setSelectedWords([...selectedWords, word]); };
  const removeWord = (index) => {
    if (isCorrect === null) {
      const n = [...selectedWords];
      n.splice(index, 1);
      setSelectedWords(n);
    }
  };

  const handleCheck = () => {
    const currentLesson = currentLessonSet[currentIndex];
    const userAnswer = currentLesson.Type === 'translate'
      ? selectedWords.join(' ')
      : currentLesson.Type === 'type-answer'
      ? typedAnswer
      : selectedOption;
    const clean = (str) => str?.toLowerCase().trim().replace(/[.,!?;]$/, '');
    if (clean(userAnswer) === clean(currentLesson.Solution)) {
      setIsCorrect(true);
      setCorrectAnswerToShow(null);
      addXp(10);
      playSfx('correct');
      playAudio(currentLesson.Audio_Slug);
    } else {
      setIsCorrect(false);
      setCorrectAnswerToShow(currentLesson.Solution);
      setHearts(prev => Math.max(0, prev - 1));
      setCurrentLessonSet(prev => [...prev, { ...currentLesson }]);
      playSfx('wrong');
    }
  };

  const handleNext = () => {
    if (currentIndex < currentLessonSet.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setSelectedWords([]);
      setTypedAnswer('');
      setIsCorrect(null);
      setCorrectAnswerToShow(null);
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

  // ── Tab renderers ──────────────────────────────────────────────────────────
  const renderHome = () => (
    <div className="app-container">

      {/* Hero card */}
      <section className="home-hero">
        <div className="home-hero__mascot">
          <LionMascot size={175} />
        </div>
        <div className="home-hero__content">
          <div className="home-hero__row">
            <div>
              <h2 className="home-hero__title">Salam, {userName}! {userAvatar}</h2>
              <p className="home-hero__subtitle">Level {currentLevel} · {streak} {streak === 1 ? 'dag' : 'dagen'} streak 🔥</p>
            </div>
            <div>
              <div className="home-hero__xp-label">NOG {xpToNextLevel} XP</div>
              <div className="home-hero__xp-track">
                <div className="home-hero__xp-fill" style={{ width: `${((xp % 500) / 500) * 100}%` }} />
              </div>
            </div>
          </div>
          <button className="home-hero__cta" onClick={() => setActiveTab('lessons')}>
            VERDER LEREN →
          </button>
        </div>
      </section>

      {/* Progress section */}
      <h3 className="home-section-title">Jouw Voortgang</h3>
      <div className="home-progress-grid">
        {units.length > 0 ? units.slice(0, 2).map(unit => {
          const completedCount = unit.subUnits.filter(s => completedSubUnits.includes(`${unit.id}-${s.id}`)).length;
          const progress = Math.round((completedCount / unit.subUnits.length) * 100);
          return (
            <div key={unit.id} className="home-progress-card">
              <div className="home-progress-card__header">
                <span className="home-progress-card__name">{unit.name}</span>
                <span className="home-progress-card__pct">{progress}%</span>
              </div>
              <div className="home-progress-card__track">
                <div className="home-progress-card__fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          );
        }) : <p>Lessen worden geladen...</p>}
      </div>

      {/* Stats row */}
      <div className="home-stats-row">
        <div className="home-stat-card">
          <div className="home-stat-card__icon"><Flame size={22} color="#D4681E" fill="#D4681E" /></div>
          <div className="home-stat-card__value">{streak}</div>
          <div className="home-stat-card__label">Streak</div>
        </div>
        <div className="home-stat-card">
          <div className="home-stat-card__icon"><Zap size={22} color="#F5C300" fill="#F5C300" /></div>
          <div className="home-stat-card__value">{xp}</div>
          <div className="home-stat-card__label">XP</div>
        </div>
        <div className="home-stat-card">
          <div className="home-stat-card__icon"><Medal size={22} color="#A86840" fill="#E8B87A" /></div>
          <div className="home-stat-card__value">{currentLevel}</div>
          <div className="home-stat-card__label">Level</div>
        </div>
        <div className="home-stat-card">
          <div className="home-stat-card__icon"><CheckCircle2 size={22} color="#5AAD2A" fill="#D7F5B0" /></div>
          <div className="home-stat-card__value">{completedSubUnits.length}</div>
          <div className="home-stat-card__label">Lessen</div>
        </div>
      </div>

    </div>
  );

  const renderMap = () => (
    <LessonMap
      units={units}
      completedSubUnits={completedSubUnits}
      onStartLesson={startLesson}
    />
  );

  const renderProfile = () => (
    <div className="app-container">
      <header className="profile-header">
        <LionMascot size={72} />
        <h2 className="profile-name">{userName}</h2>
        <div className="profile-level-badge">LEVEL {currentLevel}</div>
      </header>
      <div className="profile-grid">
        <div className="profile-card">
          <h4 className="profile-card__title">Naam</h4>
          <input
            type="text"
            className="profile-name-input"
            value={userName}
            onChange={(e) => { setUserName(e.target.value); localStorage.setItem('zgh_user_name', e.target.value); }}
          />
        </div>
        <div className="profile-card">
          <h4 className="profile-card__title">Avatar</h4>
          <div className="profile-avatar-grid">
            {["🦁", "🏔️", "🌴", "🍲", "⭐", "🐪"].map(a => (
              <button
                key={a}
                className={`profile-avatar-btn${userAvatar === a ? ' profile-avatar-btn--selected' : ''}`}
                onClick={() => { setUserAvatar(a); localStorage.setItem('zgh_user_avatar', a); }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="app-loading">
        <LionMascot size={96} />
        <h2>Atlas Academy laden...</h2>
      </div>
    );
  }

  if (view === 'lesson') {
    return (
      <LessonView
        currentLessonSet={currentLessonSet}
        currentIndex={currentIndex}
        hearts={hearts}
        isCorrect={isCorrect}
        isFinished={isFinished}
        correctAnswerToShow={correctAnswerToShow}
        selectedOption={selectedOption}
        selectedWords={selectedWords}
        typedAnswer={typedAnswer}
        onExit={() => setView('map')}
        onCheck={handleCheck}
        onNext={handleNext}
        onSelectOption={setSelectedOption}
        onAddWord={addWord}
        onRemoveWord={removeWord}
        onTypeAnswer={setTypedAnswer}
        onWrong={() => { playSfx('wrong'); setHearts(prev => Math.max(0, prev - 1)); }}
      />
    );
  }

  return (
    <div className="app-shell">

      {/* ── Header ── */}
      <header className="app-header">

        {/* Left: brand */}
        <div className="app-header__brand">
          <img src="/lion-head.png" alt="" style={{ height: 32, width: 'auto', display: 'block' }} />
          <span className="app-header__brand-text">ATLAS ACADEMY</span>
        </div>

        {/* Centre: language pill with Amazigh flag */}
        <div className="app-header__language-pill">
          <AmazighFlag height={18} />
          <span className="app-header__language-name">Tarifit</span>
        </div>

        {/* Right: stats */}
        <div className="app-header__stats">
          {/* Streak */}
          <div className="app-header__stat">
            <Flame size={18} color="#D4681E" fill="#D4681E" />
            <span className="app-header__stat-value app-header__stat-value--fire">{streak}</span>
          </div>

          {/* XP */}
          <div className="app-header__stat app-header__stat--xp">
            <Zap size={16} color="#F5C300" fill="#F5C300" />
            <span className="app-header__stat-value app-header__stat-value--xp">
              {xp}
              <AnimatePresence>
                {showXpPopup && (
                  <motion.span
                    className="app-header__xp-popup"
                    initial={{ y: 0, opacity: 1 }}
                    animate={{ y: -22, opacity: 0 }}
                  >
                    +XP
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="app-main">
        {activeTab === 'home'    && renderHome()}
        {activeTab === 'lessons' && renderMap()}
        {activeTab === 'fun'     && (
          <div className="app-placeholder">
            <LionMascot size={80} />
            <h2>Mini-games komen eraan! 🎮</h2>
          </div>
        )}
        {activeTab === 'profile' && renderProfile()}
      </main>

      {/* ── Bottom nav ── */}
      <nav className="app-nav">
        <button className={`app-nav__btn${activeTab === 'home'    ? ' app-nav__btn--active' : ''}`} onClick={() => setActiveTab('home')}>
          <Home size={24} /><span>HOME</span>
        </button>
        <button className={`app-nav__btn${activeTab === 'lessons' ? ' app-nav__btn--active' : ''}`} onClick={() => setActiveTab('lessons')}>
          <BookOpen size={24} /><span>LESSEN</span>
        </button>
        <button className={`app-nav__btn${activeTab === 'fun'     ? ' app-nav__btn--active' : ''}`} onClick={() => setActiveTab('fun')}>
          <Gamepad2 size={24} /><span>FUN</span>
        </button>
        <button className={`app-nav__btn${activeTab === 'profile' ? ' app-nav__btn--active' : ''}`} onClick={() => setActiveTab('profile')}>
          <User size={24} /><span>PROFIEL</span>
        </button>
      </nav>

    </div>
  );
}

export default App;
