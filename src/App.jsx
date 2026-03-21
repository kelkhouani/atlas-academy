import { useEffect, useState } from 'react';
import { fetchLessons } from './DataLoader';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Lock, Star, CheckCircle, X, ChevronRight, Trophy } from 'lucide-react';

function App() {
  // --- 1. STATE MANAGEMENT ---
  const [allLessons, setAllLessons] = useState([]);      
  const [view, setView] = useState('map');               
  const [activeUnit, setActiveUnit] = useState(null);    
  const [activeSubUnit, setActiveSubUnit] = useState(null); 
  const [currentIndex, setCurrentIndex] = useState(0);   
  const [selectedOption, setSelectedOption] = useState(null); 
  const [selectedWords, setSelectedWords] = useState([]);    
  const [isCorrect, setIsCorrect] = useState(null);      
  const [isFinished, setIsFinished] = useState(false);   
  const [hearts, setHearts] = useState(3);               
  
  // Deze state houdt de huidige lijst met vragen bij voor de actieve sessie
  const [currentLessonSet, setCurrentLessonSet] = useState([]);

  // Progress: Laadt voltooide lessen uit het geheugen
  const [completedSubUnits, setCompletedSubUnits] = useState(
    JSON.parse(localStorage.getItem('zgh_completed_subunits')) || []
  );

  // --- 2. DATA LADEN ---
  useEffect(() => {
    fetchLessons().then(data => setAllLessons(data));
  }, []);

  // --- 3. DATA ORGANISATIE ---
  const units = [...new Set(allLessons.map(l => parseInt(l.Unit_ID)))].sort((a,b) => a-b).map(uId => {
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

  // Start een nieuwe les en bouw de vragenlijst op
  const startLesson = (uId, sId) => {
    let questions = [];
    if (String(sId).toLowerCase() === 'final') {
      const pool = allLessons.filter(l => parseInt(l.Unit_ID) === uId && String(l.SubUnit_ID).toLowerCase() !== 'final');
      questions = pool.sort(() => 0.5 - Math.random()).slice(0, 10);
    } else {
      questions = allLessons.filter(l => parseInt(l.Unit_ID) === uId && l.SubUnit_ID === sId);
    }
    
    // CRUCIAAL: Reset alles voordat de nieuwe les begint
    setCurrentIndex(0);
    setSelectedOption(null);
    setSelectedWords([]);
    setIsCorrect(null);
    setIsFinished(false);
    setHearts(3);
    
    setCurrentLessonSet(questions);
    setActiveUnit(uId);
    setActiveSubUnit(sId);
    setView('lesson');
  };

  const currentLesson = currentLessonSet[currentIndex];

  // --- 4. INTERACTIE ---

  const handleWordClick = (word) => {
    if (isCorrect !== null) return;
    if (selectedWords.includes(word)) {
      setSelectedWords(selectedWords.filter(w => w !== word));
    } else {
      setSelectedWords([...selectedWords, word]);
    }
  };

  const handleCheck = () => {
    const userAnswer = currentLesson.Type === 'translate' ? selectedWords.join(' ') : selectedOption;
    const clean = (str) => str?.toLowerCase().trim().replace(/[.,!?;]$/, "");

    if (clean(userAnswer) === clean(currentLesson.Solution)) {
      setIsCorrect(true);
    } else {
      setIsCorrect(false);
      setHearts(prev => Math.max(0, prev - 1));

      // LOGICA: Voeg de fout gemaakte vraag toe aan het einde van de lijst
      const failedQuestion = { ...currentLesson };
      setCurrentLessonSet(prev => [...prev, failedQuestion]);
    }
  };

  const handleNext = () => {
      // Check of we nog meer vragen hebben (inclusief de herhalingen onderaan)
    if (currentIndex < currentLessonSet.length - 1) {
      setCurrentIndex(currentIndex + 1);
      // Reset de selecties voor de VOLGENDE vraag
      setSelectedOption(null);
      setSelectedWords([]);
      setIsCorrect(null);
    } else {
      // Les is pas ECHT klaar als de laatste vraag in de lijst (die goed moet zijn) is beantwoord
      setIsFinished(true);
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      
      const subUnitKey = `${activeUnit}-${activeSubUnit}`;
      if (!completedSubUnits.includes(subUnitKey)) {
        const newProgress = [...completedSubUnits, subUnitKey];
        setCompletedSubUnits(newProgress);
        localStorage.setItem('zgh_completed_subunits', JSON.stringify(newProgress));
      }

      setTimeout(() => {
        setView('map');
        setIsFinished(false);
        setActiveUnit(null);
        setActiveSubUnit(null);
        setHearts(3);
        setCurrentIndex(0);
        setCurrentLessonSet([]);
      }, 3000);
    }
  };

  // --- 5. RENDER: KAART (HOME) ---
  if (view === 'map') {
    return (
      <div className="app-container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 20px', fontFamily: 'sans-serif' }}>
        <header style={{ textAlign: 'center', marginBottom: '50px' }}>
          <h1 style={{ color: '#1cb0f6', fontSize: '48px', marginBottom: '10px' }}>Atlas Academy</h1>
          <p style={{ color: '#afafaf', fontSize: '20px' }}>Tamazight Leerpad</p>
        </header>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>
          {units.map((unit, unitIdx) => {
            // Blokkeer-logica voor Hoofdunits
            const previousUnit = units[unitIdx - 1];
            let isUnitLocked = false;
            
            if (previousUnit) {
              const allPrevSubUnitsDone = previousUnit.subUnits.every(s => 
                completedSubUnits.includes(`${previousUnit.id}-${s.id}`)
              );
              if (!allPrevSubUnitsDone) isUnitLocked = true;
            }

            const completedCount = unit.subUnits.filter(s => completedSubUnits.includes(`${unit.id}-${s.id}`)).length;
            const progressPercent = Math.round((completedCount / unit.subUnits.length) * 100);

            return (
              <div key={unit.id} style={{ border: '2px solid #e5e5e5', borderRadius: '25px', backgroundColor: 'white', overflow: 'hidden', opacity: isUnitLocked ? 0.6 : 1 }}>
                {/* Unit Header */}
                <div style={{ padding: '25px', backgroundColor: '#f7f7f7', borderBottom: '2px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '22px' }}>Unit {unit.id}: {unit.name}</h2>
                    <span style={{ fontSize: '14px', color: '#afafaf' }}>{progressPercent}% voltooid</span>
                  </div>
                  {isUnitLocked ? <Lock color="#ccc" /> : <div style={{ fontWeight: 'bold', color: '#1cb0f6' }}>{progressPercent}%</div>}
                </div>
                
                <div style={{ padding: '15px' }}>
                  {unit.subUnits.map((sub, subIdx) => {
                    const subUnitKey = `${unit.id}-${sub.id}`;
                    const isDone = completedSubUnits.includes(subUnitKey);
                    
                    // Blokkeer-logica voor Sub-units
                    const prevSubUnitKey = subIdx > 0 ? `${unit.id}-${unit.subUnits[subIdx - 1].id}` : null;
                    const isSubLocked = isUnitLocked || (subIdx > 0 && !completedSubUnits.includes(prevSubUnitKey));

                    return (
                      <div 
                        key={sub.id} 
                        onClick={() => { if(!isSubLocked) startLesson(unit.id, sub.id); }}
                        style={{ 
                          display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', 
                          cursor: isSubLocked ? 'default' : 'pointer', 
                          opacity: isSubLocked ? 0.5 : 1,
                          borderRadius: '15px',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => !isSubLocked && (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {/* Icoontjes */}
                        <div style={{ 
                          width: '40px', height: '40px', borderRadius: '50%', 
                          backgroundColor: isSubLocked ? '#e5e5e5' : (isDone ? '#58cc02' : (sub.isFinal ? '#ffc800' : '#1cb0f6')), 
                          display: 'flex', alignItems: 'center', justifyContent: 'center' 
                        }}>
                          {isSubLocked ? <Lock size={18} color="white" /> : (isDone ? <CheckCircle size={20} color="white" /> : (sub.isFinal ? <Trophy size={20} color="white" /> : <Star size={20} color="white" />))}
                        </div>

                        <span style={{ flex: 1, fontWeight: 'bold', color: isSubLocked ? '#afafaf' : '#3c3c3c' }}>{sub.name}</span>
                        
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
  }

  if (hearts === 0) return (
    <div style={{ textAlign: 'center', padding: '100px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '100px' }}>💔</h1>
      <h2>Geen hartjes meer! Probeer het opnieuw.</h2>
      <button onClick={() => setView('map')} style={{ padding: '15px 40px', borderRadius: '15px', backgroundColor: '#1cb0f6', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>TERUG NAAR MENU</button>
    </div>
  );

  if (isFinished) return (
    <div style={{ textAlign: 'center', padding: '150px 20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#58cc02', fontSize: '60px' }}>Mabrouk! 🎉</h1>
      <p style={{ fontSize: '24px' }}>Je hebt alle vragen in deze les beheerst!</p>
    </div>
  );

  if (!currentLesson) return null;

  // --- 6. RENDER: LES ENGINE ---
  return (
    <div className="app-container" style={{ maxWidth: '1100px', width: '95%', margin: '0 auto', padding: '40px 20px', fontFamily: 'sans-serif' }}>
      
      {/* Voortgangsbalk */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
        <X onClick={() => setView('map')} style={{ cursor: 'pointer' }} color="#afafaf" size={32}/>
        <div style={{ flex: 1, height: '16px', background: '#e5e5e5', borderRadius: '20px' }}>
          {/* De voortgangsbalk kijkt nu naar de voortgang binnen de dynamic list */}
          <motion.div animate={{ width: `${(currentIndex / currentLessonSet.length) * 100}%` }} style={{ height: '100%', background: '#58cc02', borderRadius: '20px' }} />
        </div>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4b4b' }}>❤️ {hearts}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        
        {currentLesson.Image_Tag && currentLesson.Image_Tag.startsWith('http') && (
          <img src={currentLesson.Image_Tag} alt="vraag" style={{ maxWidth: '250px', borderRadius: '25px', marginBottom: '30px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }} />
        )}

        <div style={{ width: '100%', textAlign: 'center' }}>
          <h2 style={{ fontSize: '32px', marginBottom: '20px' }}>{currentLesson.Type === 'translate' ? 'Vertaal deze zin:' : currentLesson.Prompt_NL}</h2>

          {currentLesson.Type === 'translate' && (
            <div style={{ padding: '30px', backgroundColor: '#f7f7f7', borderRadius: '20px', marginBottom: '20px', fontSize: '28px', fontWeight: 'bold', color: '#1cb0f6', border: '2px solid #e5e5e5' }}>
              {currentLesson.Prompt_ZGH}
            </div>
          )}

          {currentLesson.Type === 'translate' && (
            <div style={{ minHeight: '80px', borderBottom: '2px solid #e5e5e5', marginBottom: '30px', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', padding: '10px' }}>
              {selectedWords.map((word, i) => (
                <button key={i} onClick={() => handleWordClick(word)} style={{ padding: '12px 24px', borderRadius: '15px', border: '2px solid #e5e5e5', backgroundColor: 'white', fontSize: '18px', boxShadow: '0 3px 0 #e5e5e5' }}>{word}</button>
              ))}
            </div>
          )}

          {/* Opties Grid: Desktop breedte geforceerd door de Grid columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', width: '100%' }}>
            {currentLesson.Options.map((opt, i) => {
              const isUsed = currentLesson.Type === 'translate' && selectedWords.includes(opt);
              const isSelected = selectedOption === opt;
              return (
                <button 
                  key={i} disabled={isUsed || isCorrect !== null} 
                  onClick={() => currentLesson.Type === 'translate' ? handleWordClick(opt) : setSelectedOption(opt)}
                  style={{ 
                    padding: '25px', fontSize: '22px', borderRadius: '20px', 
                    border: `2px solid ${isSelected ? '#1cb0f6' : '#e5e5e5'}`,
                    backgroundColor: isUsed ? '#e5e5e5' : (isSelected ? '#ddf4ff' : 'white'),
                    color: isUsed ? 'transparent' : '#3c3c3c', boxShadow: isUsed ? 'none' : '0 5px 0 #e5e5e5',
                    minHeight: '90px', fontWeight: 'bold'
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Feedback Bar */}
      <AnimatePresence>
        {isCorrect !== null && (
          <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '40px', backgroundColor: isCorrect ? '#d7ffb8' : '#ffdfe0', display: 'flex', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ maxWidth: '1100px', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: isCorrect ? '#58a700' : '#ea2b2b', fontSize: '28px' }}>{isCorrect ? 'Uitstekend!' : 'Oeps! Geen zorgen.'}</h3>
                {!isCorrect && <p style={{ margin: '10px 0 0', color: '#ea2b2b', fontSize: '18px' }}>Deze vraag komt aan het eind terug. Oplossing: <b>{currentLesson.Solution}</b></p>}
              </div>
              <button onClick={handleNext} style={{ backgroundColor: isCorrect ? '#58cc02' : '#ff4b4b', color: 'white', border: 'none', padding: '20px 60px', borderRadius: '20px', fontWeight: 'bold', fontSize: '20px', cursor: 'pointer' }}>DOORGAAN</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Check Button */}
      {isCorrect === null && (
        <div style={{ marginTop: '80px', display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid #e5e5e5', paddingTop: '30px' }}>
          <button 
            disabled={currentLesson.Type === 'translate' ? selectedWords.length === 0 : !selectedOption} 
            onClick={handleCheck}
            style={{ width: '350px', padding: '20px', borderRadius: '20px', backgroundColor: (selectedOption || selectedWords.length > 0) ? '#58cc02' : '#e5e5e5', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '20px', cursor: 'pointer' }}
          >
            CONTROLEER
          </button>
        </div>
      )}
    </div>
  );
}

export default App;