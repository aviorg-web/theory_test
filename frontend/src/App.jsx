import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabase';
import { StudentLogin } from './components/StudentLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { Academy } from './components/Academy';
import './index.css';
import { parseQuestion } from './utils/questionParser';
import { recordAnswer, getWeakAreas, getReadinessScore } from './utils/adaptiveEngine';

const fireConfetti = async () => {
  try { const c = (await import('canvas-confetti')).default; c({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#4F8EF7','#F59E0B','#34D399'] }); } catch {}
};

function App() {
  const [view, setView]                     = useState('landing');
  const [student, setStudent]               = useState(null);
  const [questions, setQuestions]           = useState([]);
  const [allQuestions, setAllQuestions]     = useState([]);
  const [idx, setIdx]                       = useState(0);
  const [score, setScore]                   = useState(0);
  const [timeLeft, setTimeLeft]             = useState(2400);
  const [testTotalQ, setTestTotalQ]         = useState(30);
  const [userAnswers, setUserAnswers]       = useState([]);
  const [imgErr, setImgErr]                 = useState(false);
  const [hasSavedTarget, setHasSavedTarget] = useState(false);
  const [zoomImg, setZoomImg]               = useState(null);
  const [nextViewAfterLogin, setNextViewAfterLogin] = useState(null);
  const [showAnswer, setShowAnswer]         = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: setts } = await supabase.from('test_settings').select('*').single();
      const blocked = setts?.excluded_chapters ?? [];
      setTimeLeft(Number(setts?.test_time_seconds ?? 2400));
      setTestTotalQ(Number(setts?.test_length ?? 30));
      const { data: clss } = await supabase.from('classes').select('*');
      const { data } = await supabase.from('questions').select('*');
      if (data) {
        setAllQuestions(data);
        setQuestions(data.filter(q => !blocked.includes(String(q.chapter_number))).sort(() => Math.random() - 0.5).slice(0, Number(setts?.test_length ?? 30)));
      }
    };
    load();
  }, []);

  useEffect(() => {
    let t;
    if (view === 'test' && timeLeft > 0) t = setInterval(() => setTimeLeft(p => p - 1), 1000);
    if (view === 'test' && timeLeft === 0) setView('results');
    return () => clearInterval(t);
  }, [view, timeLeft]);

  useEffect(() => {
    if (view === 'results' && student && !hasSavedTarget) {
      setHasSavedTarget(true);
      supabase.from('test_results').insert([{ student_name: student.name, student_id: student.tz, class_id: student.class_id, score }]);
      if (score / testTotalQ >= 0.9) fireConfetti();
    }
  }, [view, student, score, hasSavedTarget]);

  const currentQ = useMemo(() => parseQuestion(questions[idx]), [questions, idx]);

  const handleAnswer = (selIdx) => {
    const isCorrect = selIdx === currentQ.correctIdx;
    if (student) recordAnswer(student.tz, currentQ.id || currentQ.question_id, isCorrect);
    if (isCorrect) setScore(s => s + 1);
    setUserAnswers(prev => [...prev, { question: currentQ, selected: selIdx, isCorrect }]);
    setShowAnswer(true);
  };

  const nextQuestion = () => {
    setShowAnswer(false); setImgErr(false);
    if (idx + 1 < questions.length) setIdx(idx + 1); else setView('results');
  };

  /* ── LANDING ── */
  if (view === 'landing') return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#060D1F] via-[#0D1B3E] to-[#0A1628] flex items-center justify-center p-4 rtl font-sans relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]"/>
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_0_40px_rgba(79,142,247,0.4)] mb-5">
            <span className="text-4xl">🚗</span>
          </div>
          <h1 className="text-4xl font-black text-white">Theory AI</h1>
          <p className="text-blue-400 text-sm font-medium mt-1">מערכת הכנה חכמה לתאוריה</p>
        </div>
        <div className="space-y-3">
          <button onClick={() => { setNextViewAfterLogin('test'); setView('student_login'); }} className="w-full bg-white text-slate-900 py-4 rounded-2xl font-black text-lg shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 hover:bg-blue-50">
            <span className="text-2xl">⏱️</span> התחל מבחן
          </button>
          <button onClick={() => { setNextViewAfterLogin('academy'); setView('student_login'); }} className="w-full bg-blue-600/20 text-blue-300 border border-blue-500/30 py-4 rounded-2xl font-bold text-lg active:scale-95 transition-all flex items-center justify-center gap-3 hover:bg-blue-600/30">
            <span className="text-2xl">📚</span> האקדמיה לנהיגה
          </button>
          <button onClick={() => setView('admin_login')} className="w-full bg-white/5 border border-white/15 text-slate-400 py-3 rounded-2xl font-bold text-sm hover:bg-white/10 hover:text-white transition-all">🔐 כניסת צוות (Admin)</button>
          <p className="text-center text-slate-600 text-xs mt-4">© כל הזכויות שמורות — אבי שוורץ</p>
          <p className="text-center text-slate-700 text-xs mt-1">v1.1</p>
        </div>
      </div>
    </div>
  );

  if (view === 'admin_login' || view === 'admin_dashboard') return <AdminDashboard onLogout={() => setView('landing')} onEnterAcademy={() => setView('academy')} />;
  if (view === 'student_login') return <StudentLogin onLogin={(info) => { setStudent(info); setView(nextViewAfterLogin || 'student_dashboard'); }} onCancel={() => setView('landing')} intendedView={nextViewAfterLogin} />;

  /* ── DASHBOARD ── */
  if (view === 'student_dashboard') {
    const readiness = student ? getReadinessScore(student.tz, allQuestions) : 0;
    const weakAreas = student ? getWeakAreas(student.tz, allQuestions) : [];
    const rc = readiness >= 80 ? '#34D399' : readiness >= 50 ? '#F59E0B' : '#F87171';
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#060D1F] to-[#0D1B3E] rtl font-sans p-4 pb-10">
        <div className="max-w-md mx-auto pt-8">
          <div className="flex justify-between items-start mb-8">
            <div><p className="text-blue-400 text-sm font-bold">שלום,</p><h1 className="text-3xl font-black text-white">{student?.name} 👋</h1></div>
            <button onClick={() => { setStudent(null); setView('landing'); }} className="text-slate-500 text-xs font-bold mt-2 hover:text-red-400 transition-colors">יציאה</button>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px]" style={{ background: rc+'20' }}/>
            <p className="text-slate-400 text-sm font-bold mb-1">ציון מוכנות</p>
            <div className="flex items-end gap-3"><span className="text-6xl font-black" style={{ color: rc }}>{readiness}</span><span className="text-slate-500 font-bold text-lg mb-2">/ 100</span></div>
            {readiness === 0 && <p className="text-slate-500 text-sm mt-2">התחל לתרגל כדי לראות את המוכנות שלך</p>}
            {readiness > 0 && readiness < 60 && <p className="text-amber-400 text-sm mt-2 font-bold">💪 המשך לתרגל!</p>}
            {readiness >= 60 && readiness < 85 && <p className="text-blue-300 text-sm mt-2 font-bold">📈 כמעט מוכן!</p>}
            {readiness >= 85 && <p className="text-emerald-400 text-sm mt-2 font-bold">🏆 מוכן למבחן!</p>}
          </div>
          {weakAreas.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-5 mb-4">
              <p className="text-red-400 font-bold text-sm mb-3">⚠️ נושאים לחזרה</p>
              {weakAreas.map(w => <div key={w.chapter} className="flex justify-between mb-1"><span className="text-white font-bold text-sm">פרק {w.chapter}</span><span className="text-red-400 text-xs font-bold">{Math.round(w.errorRate*100)}% שגיאות</span></div>)}
            </div>
          )}
          <div className="space-y-3">
            <button onClick={() => setView('academy')} className="w-full bg-gradient-to-l from-blue-600 to-indigo-600 text-white py-5 rounded-3xl font-black text-xl shadow-[0_0_30px_rgba(79,142,247,0.3)] active:scale-95 transition-all flex items-center justify-center gap-3">
              <span className="text-2xl">📚</span>
              <div className="text-right"><div>האקדמיה לנהיגה</div><div className="text-xs font-medium text-blue-200">לימוד + תרגול חכם אדפטיבי</div></div>
            </button>
            <button onClick={() => setView('test')} className="w-full bg-white/5 border border-white/10 text-white py-5 rounded-3xl font-black text-xl active:scale-95 transition-all flex items-center justify-center gap-3 hover:bg-white/10">
              <span className="text-2xl">⏱️</span>
              <div className="text-right"><div>מבחן תיאוריה מסכם</div><div className="text-xs font-medium text-slate-400">סימולציית בחינה • {testTotalQ} שאלות</div></div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'academy') return <Academy student={student} allQuestions={allQuestions} onBack={() => setView(student ? 'student_dashboard' : 'landing')} />;

  /* ── TEST ── */
  if (view === 'test' && currentQ) {
    const pBar = (idx / questions.length) * 100;
    const tc = timeLeft < 300 ? 'text-red-400' : timeLeft < 600 ? 'text-amber-400' : 'text-slate-700';
    return (
      <div className="min-h-screen bg-[#f0f7ff] rtl font-sans flex flex-col" dir="rtl">
        <div className="bg-white border-b border-slate-100 px-4 py-3 flex justify-between items-center sticky top-0 z-10 shadow-sm">
          <button onClick={() => setView('student_dashboard')} className="bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-600 transition-all px-4 py-1.5 rounded-xl text-sm font-bold">יציאה</button>
          <span className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">{idx+1} / {questions.length}</span>
          <span className={`font-mono font-black text-lg ${tc}`}>{Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}</span>
        </div>
        <div className="h-1 bg-slate-100"><div className="h-1 bg-blue-500 transition-all duration-500" style={{ width: `${pBar}%` }}/></div>
        <div className="flex-1 max-w-2xl mx-auto w-full p-4 pt-6 flex flex-col">
          {currentQ.vId && <div className="mb-5 rounded-2xl overflow-hidden aspect-video bg-black shadow-lg"><iframe className="w-full h-full" src={`https://www.youtube.com/embed/${currentQ.vId}`} frameBorder="0" allowFullScreen/></div>}
          {currentQ.image && !currentQ.vId && !imgErr && <div className="mb-5 rounded-2xl bg-white border-2 border-slate-200 p-4 flex justify-center cursor-zoom-in shadow-sm" onClick={() => setZoomImg(currentQ.image)}><img src={currentQ.image} alt="sign" className="max-h-56 object-contain" onError={() => setImgErr(true)}/></div>}
          <h2 className="text-xl font-bold text-slate-900 mb-6 leading-relaxed" dir="rtl">{currentQ.displayQ}&#x200F;</h2>
          {!showAnswer ? (
            <div className="space-y-3">
              {currentQ.displayOpts.map((opt, i) => opt && (
                <button key={i} onClick={() => handleAnswer(i)} className="w-full text-right p-4 rounded-2xl bg-white border-2 border-slate-100 hover:border-blue-300 hover:bg-blue-50 active:scale-[0.98] flex items-center gap-4 transition-all shadow-sm group">
                  <span className="w-9 h-9 shrink-0 rounded-xl border-2 border-slate-200 flex items-center justify-center text-slate-500 font-black text-sm group-hover:border-blue-400 group-hover:text-blue-600 transition-all">{['א','ב','ג','ד'][i]}</span>
                  <span className="flex-1 text-slate-800 font-semibold" dir="rtl">{opt}&#x200F;</span>
                </button>
              ))}
              <button onClick={() => handleAnswer(-1)} className="mt-2 text-center text-slate-400 font-bold text-sm hover:text-slate-600 w-full py-2">דלג על שאלה</button>
            </div>
          ) : (
            <div className="space-y-3">
              {currentQ.displayOpts.map((opt, i) => {
                const isC = i === currentQ.correctIdx, isS = i === userAnswers[userAnswers.length-1]?.selected, isW = isS && !isC;
                return opt && <div key={i} className={`p-4 rounded-2xl border-2 flex items-center gap-4 ${isC?'bg-emerald-50 border-emerald-300':isW?'bg-red-50 border-red-300':'bg-white border-slate-100 opacity-50'}`}>
                  <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-black text-sm ${isC?'bg-emerald-500 text-white':isW?'bg-red-500 text-white':'border-2 border-slate-200 text-slate-400'}`}>{isC?'✓':isW?'✗':['א','ב','ג','ד'][i]}</span>
                  <span className={`flex-1 font-semibold ${isC?'text-emerald-900 font-black':isW?'text-red-900':'text-slate-400'}`} dir="rtl">{opt}&#x200F;</span>
                </div>;
              })}
              <button onClick={nextQuestion} className="w-full mt-2 bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg active:scale-95">{idx+1 < questions.length ? 'שאלה הבאה ➜' : 'סיים מבחן'}</button>
            </div>
          )}
        </div>
        {zoomImg && <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm" onClick={() => setZoomImg(null)}><img src={zoomImg} className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain bg-white p-2" onClick={e => e.stopPropagation()}/></div>}
      </div>
    );
  }

  /* ── RESULTS ── */
  if (view === 'results') {
    const pct = Math.round((score/testTotalQ)*100), passed = pct >= 90;
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#060D1F] to-[#0D1B3E] rtl font-sans flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-7xl mb-4">{passed?'🏆':'💪'}</div>
          <h2 className="text-4xl font-black text-white mb-1">{passed?'עברת!':'כמעט שם!'}</h2>
          <p className="text-slate-400 font-bold mb-8">{student?.name}</p>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-6">
            <div className="text-7xl font-black mb-1" style={{ color: passed?'#34D399':pct>=70?'#F59E0B':'#F87171' }}>{pct}%</div>
            <p className="text-slate-400 font-bold">{score} / {testTotalQ} נכונות</p>
            {!passed && <p className="text-amber-400 text-sm mt-3 font-bold">נדרש 90% ({Math.ceil(testTotalQ*0.9)} תשובות)</p>}
          </div>
          <div className="space-y-3">
            <button onClick={() => setView('review')} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold active:scale-95">סקירה עם AI 🤖</button>
            <button onClick={() => { setScore(0); setIdx(0); setUserAnswers([]); setHasSavedTarget(false); setShowAnswer(false); setQuestions(q=>[...q].sort(()=>Math.random()-0.5)); setView('test'); }} className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-bold active:scale-95">מבחן חדש</button>
            <button onClick={() => setView('student_dashboard')} className="w-full text-slate-500 py-3 font-bold text-sm hover:text-white transition-colors">חזור לדשבורד</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── REVIEW ── */
  if (view === 'review') return (
    <div className="min-h-screen bg-[#f0f7ff] p-4 rtl font-sans" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center py-4 mb-4">
          <h2 className="text-2xl font-black text-slate-900">סקירה פדגוגית</h2>
          <button onClick={() => setView('results')} className="bg-white text-blue-600 px-5 py-2 rounded-xl text-sm font-bold border border-blue-100 shadow-sm">חזור</button>
        </div>
        <div className="space-y-4 pb-10">{userAnswers.map((ans,i) => <ReviewItem key={i} ans={ans} index={i} setZoomImg={setZoomImg}/>)}</div>
      </div>
      {zoomImg && <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm" onClick={() => setZoomImg(null)}><img src={zoomImg} className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain bg-white p-2" onClick={e=>e.stopPropagation()}/></div>}
    </div>
  );

  return <div className="h-screen bg-[#f0f7ff] flex items-center justify-center font-bold text-2xl text-slate-400">טוען...</div>;
}

function ReviewItem({ ans, index, setZoomImg }) {
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const askAI = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('explain-error', {
        body: { question: ans.question.displayQ, selectedOption: ans.selected===-1?'דילגתי':(ans.question.displayOpts[ans.selected]||''), correctOption: ans.question.displayOpts[ans.question.correctIdx]||'' }
      });
      setExplanation(data?.explanation||(error?`שגיאה: ${error.message}`:'לא התקבל הסבר.'));
    } catch(e) { setExplanation(`שגיאה: ${e.message}`); }
    setLoading(false);
  };
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <span className="text-slate-400 text-xs font-bold">שאלה {index+1}</span>
        {ans.selected===-1?<span className="bg-amber-50 text-amber-700 border border-amber-100 text-xs font-bold px-3 py-1 rounded-full">⏭️ דולג</span>:ans.isCorrect?<span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-bold px-3 py-1 rounded-full">✅ נכון</span>:<span className="bg-red-50 text-red-700 border border-red-100 text-xs font-bold px-3 py-1 rounded-full">❌ טעות</span>}
      </div>
      {ans.question.vId && <div className="mb-4 rounded-xl overflow-hidden aspect-video bg-black"><iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ans.question.vId}`} frameBorder="0" allowFullScreen/></div>}
      {ans.question.image && <div className="mb-4 rounded-xl bg-slate-50 border p-2 flex justify-center cursor-zoom-in" onClick={() => setZoomImg?.(ans.question.image)}><img src={ans.question.image} alt="sign" className="max-h-40 object-contain"/></div>}
      <h3 className="text-base font-bold text-slate-900 mb-4 leading-relaxed">{ans.question.displayQ}</h3>
      <div className="space-y-2">
        {ans.question.displayOpts.map((opt,i) => {
          const isC=i===ans.question.correctIdx,isS=i===ans.selected,isW=isS&&!isC;
          return opt&&<div key={i} className={`p-3 rounded-xl border text-sm font-semibold flex justify-between ${isC?'bg-emerald-50 border-emerald-200 text-emerald-900':isW?'bg-red-50 border-red-200 text-red-900':'bg-slate-50 border-slate-100 text-slate-500'}`}><span dir="rtl">{opt}&#x200F;</span><span className="text-xs opacity-50 mr-2">{['א','ב','ג','ד'][i]}</span></div>;
        })}
      </div>
      <div className="mt-4 pt-4 border-t border-slate-50">
        {!explanation?<button onClick={askAI} disabled={loading} className="text-blue-600 font-bold text-sm hover:text-blue-800 flex items-center gap-2">{loading?<span className="animate-pulse">⏳ מנתח...</span>:(ans.isCorrect?'📚 הרחב ידע':'💡 למה טעיתי?')}</button>:<div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-sm leading-relaxed"><p className="font-black text-amber-800 mb-2">🤖 הסבר AI:</p><p className="whitespace-pre-wrap">{explanation}</p></div>}
      </div>
    </div>
  );
}

export default App;
