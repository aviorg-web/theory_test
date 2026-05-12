import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabase';
import { StudentLogin } from './components/StudentLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { Academy } from './components/Academy';
import './index.css';
import { parseQuestion } from './utils/questionParser';
function App() {
  const [view, setView] = useState('landing');
  const [student, setStudent] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(2400); // defaults overridden by settings
  const [testTotalQ, setTestTotalQ] = useState(30);
  const [userAnswers, setUserAnswers] = useState([]);
  const [imgErr, setImgErr] = useState(false);
  const [classes, setClasses] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [hasSavedTarget, setHasSavedTarget] = useState(false);
  const [zoomImg, setZoomImg] = useState(null);
  const [nextViewAfterLogin, setNextViewAfterLogin] = useState(null);

  // טעינת נתונים
  useEffect(() => {
    const load = async () => {
      // 1. Fetch settings filter (מיקוד) and test settings
      const { data: setts } = await supabase.from('test_settings').select('*').single();
      const blocked = setts && setts.excluded_chapters ? setts.excluded_chapters : [];
      const dynamicLimit = setts && setts.test_length ? Number(setts.test_length) : 30;
      const dynamicTime = setts && setts.test_time_seconds ? Number(setts.test_time_seconds) : 2400;

      setTimeLeft(dynamicTime);
      setTestTotalQ(dynamicLimit);

      // 2. Fetch classes
      const { data: clss } = await supabase.from('classes').select('*');
      if (clss) setClasses(clss);

      // 3. Fetch questions
      const { data } = await supabase.from('questions').select('*');
      if (data) {
        const uniqueChapters = [...new Set(data.map(q => String(q.chapter_number)))].filter(Boolean).sort();
        setChapters(uniqueChapters);
        
        const allowed = data.filter(q => !blocked.includes(String(q.chapter_number)));
        setQuestions(allowed.sort(() => Math.random() - 0.5).slice(0, dynamicLimit));
      }
    };
    load();
  }, []);

  // טיימר
  useEffect(() => {
    let timer;
    if (view === 'test' && timeLeft > 0) timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
    return () => clearInterval(timer);
  }, [view, timeLeft]);

  // שמירת תוצאות למסד התלמידים ברגע סיום (מניעת כפילויות)
  useEffect(() => {
    if (view === 'results' && student && !hasSavedTarget) {
      setHasSavedTarget(true);
      const saveRes = async () => {
        await supabase.from('test_results').insert([
          { student_name: student.name, student_id: student.tz, class_id: student.class_id, score }
        ]);
      };
      saveRes();
    }
  }, [view, student, score, hasSavedTarget]);

  // עיבוד שאלה (לוגיקה משוריינת)
  const currentQ = useMemo(() => {
    return parseQuestion(questions[idx]);
  }, [questions, idx]);

  const handleAnswer = (selIdx) => {
    const isCorrect = selIdx === currentQ.correctIdx;
    setUserAnswers([...userAnswers, { question: currentQ, selected: selIdx, isCorrect }]);
    if (isCorrect) setScore(s => s + 1);

    if (idx + 1 < questions.length) { setIdx(idx + 1); setImgErr(false); }
    else setView('results');
  };

  // --- VIEWS ---
  if (view === 'landing') return (
    <div className="h-screen w-full bg-[#f0f7ff] flex items-center justify-center p-6 rtl font-sans">
      <div className="w-full max-w-md bg-white/90 backdrop-blur-xl p-10 rounded-[3rem] shadow-2xl text-center text-slate-800">
        <h1 className="text-5xl font-black text-blue-700 mb-2">Theory AI</h1>
        <p className="text-blue-500 mb-10 italic">by Avi Schwartz</p>
        <button onClick={() => { setNextViewAfterLogin('test'); setView('student_login'); }} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-xl active:scale-95 shadow-lg mb-4">התחל מבחן</button>
        <button onClick={() => { setNextViewAfterLogin('academy'); setView('student_login'); }} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-xl active:scale-95 shadow-lg mb-4 flex items-center justify-center gap-2"><span>📚</span> אקדמיה לתאוריה</button>
        <button onClick={() => setView('admin_login')} className="w-full bg-slate-100 text-slate-600 border border-slate-200 py-3 rounded-2xl font-bold active:scale-95 transition-all">כניסת צוות (Admin)</button>
      </div>
    </div>
  );

  if (view === 'admin_login' || view === 'admin_dashboard') return (
    <AdminDashboard 
      onLogout={() => setView('landing')} 
      onEnterAcademy={() => setView('academy')}
    />
  );

  if (view === 'student_login') return (
    <StudentLogin 
      onLogin={(studentInfo) => {
        setStudent(studentInfo);
        setView(nextViewAfterLogin || 'student_dashboard'); // Go to selected view or fallback to dashboard
      }}
      onCancel={() => setView('landing')} 
      intendedView={nextViewAfterLogin}
    />
  );

  if (view === 'student_dashboard') return (
    <div className="h-screen w-full bg-[#f0f7ff] flex flex-col items-center justify-center p-6 rtl font-sans">
      <div className="w-full max-w-lg bg-white/90 p-10 rounded-[3rem] shadow-2xl text-center text-slate-800 border border-blue-50">
        <h2 className="text-4xl font-black text-blue-900 mb-2">שלום, {student?.name}! 👋</h2>
        <p className="text-slate-500 font-bold mb-10">בחר מסלול פעילות להיום:</p>
        
        <div className="grid gap-4">
          <button onClick={() => setView('academy')} className="group flex flex-col items-center justify-center p-8 bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-100 hover:border-indigo-400 rounded-3xl transition-all shadow-sm hover:shadow-xl active:scale-95">
            <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">📚</span>
            <span className="text-2xl font-black text-indigo-900">האקדמיה לנהיגה</span>
            <span className="text-sm font-bold text-indigo-600/70 mt-2">לימוד נושאים, חומר מדריך ותרגול ממוקד חכם</span>
          </button>

          <button onClick={() => setView('test')} className="group flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-100 hover:border-emerald-400 hover:bg-emerald-50 rounded-3xl transition-all shadow-sm hover:shadow-xl active:scale-95">
            <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">⏱️</span>
            <span className="text-2xl font-black text-slate-800">מבחן תיאוריה מסכם</span>
            <span className="text-sm font-bold text-slate-500 mt-2">סימולציית בחינה רשמית (30 שאלות, טיימר)</span>
          </button>
        </div>

        <button onClick={() => { setStudent(null); setView('landing'); }} className="mt-8 text-slate-400 font-bold text-sm hover:text-red-500 transition-colors">החלף משתמש / התנתק</button>
      </div>
    </div>
  );

  if (view === 'academy') return (
    <Academy student={student} onBack={() => setView(student ? 'student_dashboard' : 'admin_dashboard')} />
  );

  if (view === 'test' && currentQ) return (
    <div className="h-screen bg-[#f0f7ff] p-4 flex flex-col overflow-hidden rtl font-sans">
      <div className="flex justify-between items-center mb-4 max-w-4xl mx-auto w-full px-2 mt-4">
        <button onClick={() => setView('student_dashboard')} className="bg-slate-200 text-slate-800 hover:bg-red-500 hover:text-white transition-colors px-5 py-1.5 rounded-full text-sm font-black shadow-sm mr-2">יציאה</button>
        <div className="bg-white px-4 py-1.5 rounded-full text-blue-900 font-bold border border-blue-100 shadow-sm text-xs ml-auto mr-4">נבחן: {student.name} | שאלה {idx + 1} / {testTotalQ}</div>
        <div className="font-mono font-bold text-lg px-4 py-1 rounded-full bg-blue-600 text-white shadow-md">
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')} ⏱️
        </div>
      </div>
      <div className="flex-1 max-w-4xl mx-auto w-full bg-white rounded-[2.5rem] p-8 border border-blue-50 shadow-2xl flex flex-col justify-between overflow-hidden relative">
        <div className="overflow-y-auto flex-1 scrollbar-hide text-center">
          {currentQ.vId ? (
            <div className="mb-6 rounded-2xl overflow-hidden aspect-video bg-black shadow-lg"><iframe className="w-full h-full" src={`https://www.youtube.com/embed/${currentQ.vId}`} frameBorder="0" allowFullScreen></iframe></div>
          ) : (currentQ.image && !imgErr) ? (
            <div className="mb-6 rounded-2xl overflow-hidden bg-slate-50 flex justify-center border border-slate-100 p-2 cursor-pointer hover:bg-slate-100 transition-colors relative group" onClick={() => setZoomImg(currentQ.image)}>
              <img src={currentQ.image} alt="Sign" className="max-h-72 w-full object-contain" onLoad={(e) => { if (e.target.naturalWidth < 20 || e.target.naturalHeight < 20) setImgErr(true); }} onError={() => setImgErr(true)} />
              <div className="absolute bottom-4 left-4 bg-white/90 px-3 py-1.5 rounded-full shadow-md text-xs font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center gap-1"><span>🔍</span> <span>הגדל</span></div>
            </div>
          ) : null}
          <h2 className="text-xl md:text-2xl font-bold mb-8 leading-relaxed text-slate-800" dir="rtl">{currentQ.displayQ}&#x200F;</h2>
          <div className="grid gap-3">
            {currentQ.displayOpts.map((opt, i) => opt && (
              <button key={i} onClick={() => handleAnswer(i)} className="w-full text-right p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-blue-50 active:scale-[0.98] flex items-center group transition-all">
                <span className="flex-1 text-lg text-slate-700 font-semibold" dir="rtl">{opt}&#x200F;</span>
                <span className="mr-4 w-9 h-9 rounded-xl border border-blue-100 flex items-center justify-center text-blue-600 font-black group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">{['א', 'ב', 'ג', 'ד'][i]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-between pt-4 border-t border-slate-100 mt-2 px-2">
          <button onClick={() => idx > 0 && setIdx(idx - 1)} className="text-slate-400 text-sm font-bold">הקודם</button>
          <button onClick={() => handleAnswer(-1)} className="bg-blue-600 text-white font-bold py-3 px-12 rounded-2xl shadow-lg active:scale-95">דלג</button>
        </div>
      </div>
      
      {zoomImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm transition-all" onClick={() => setZoomImg(null)}>
          <div className="relative max-w-5xl w-full flex justify-center animate-in zoom-in-95 duration-200">
            <button className="absolute -top-12 right-0 md:-right-12 md:-top-4 bg-white text-slate-900 w-10 h-10 rounded-full font-bold text-xl flex items-center justify-center shadow-xl hover:bg-slate-100 z-50 transition-transform hover:scale-110">✕</button>
            <img src={zoomImg} className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain bg-white p-2" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}
    </div>
  );

  if (view === 'results') return (
    <div className="h-screen bg-[#f0f7ff] flex flex-col items-center justify-center p-6 rtl text-center font-sans">
      <div className="w-full max-w-md bg-white p-12 rounded-[3rem] shadow-2xl border border-blue-100">
        <div className="text-6xl mb-6">{score >= (testTotalQ * 0.9) ? "🏆" : "💪"}</div>
        <h2 className="text-4xl font-bold mb-2 text-slate-900">{score >= (testTotalQ * 0.9) ? "עברת!" : "כמעט שם!"}</h2>
        <p className="text-xl text-slate-500 mb-8">{student?.name}, הציון שלך: {score} / {testTotalQ}</p>
        <button onClick={() => setView('review')} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg mb-4 active:scale-95">סקירה פדגוגית עם AI 🤖</button>
        <button onClick={() => window.location.reload()} className="bg-emerald-500 text-white w-full py-4 rounded-2xl font-bold shadow-lg active:scale-95">מבחן חדש</button>
      </div>
    </div>
  );

  if (view === 'review') return (
    <div className="h-screen bg-[#f0f7ff] p-4 flex flex-col rtl font-sans" dir="rtl">
      <div className="flex justify-between items-center mb-6 max-w-4xl mx-auto w-full px-2">
        <h2 className="text-2xl font-bold text-blue-800">סקירה פדגוגית</h2>
        <button onClick={() => setView('results')} className="bg-white text-blue-600 px-6 py-2 rounded-full text-sm font-bold border border-blue-100 active:scale-95 shadow-sm">חזור לתוצאות</button>
      </div>
      <div className="flex-1 max-w-4xl mx-auto w-full space-y-6 overflow-y-auto pb-10 scrollbar-hide">
        {userAnswers.map((ans, i) => <ReviewItem key={i} ans={ans} index={i} setZoomImg={setZoomImg} />)}
      </div>
      
      {zoomImg && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm transition-all" onClick={() => setZoomImg(null)}>
          <div className="relative max-w-5xl w-full flex justify-center animate-in zoom-in-95 duration-200">
            <button className="absolute -top-12 right-0 md:-right-12 md:-top-4 bg-white text-slate-900 w-10 h-10 rounded-full font-bold text-xl flex items-center justify-center shadow-xl hover:bg-slate-100 z-50 transition-transform hover:scale-110">✕</button>
            <img src={zoomImg} className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain bg-white p-2" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}
    </div>
  );

  return <div className="h-screen bg-[#f0f7ff] flex items-center justify-center font-bold text-2xl">טוען...</div>;
}

function ReviewItem({ ans, index, setZoomImg }) {
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);

  const askAI = async () => {
    setLoading(true);
    try {
      const actualCorrect = ans.question.displayOpts[ans.question.correctIdx] || "לא אותרה תשובה במערכת";
      const selectedText = ans.selected === -1 ? 'דילגתי על השאלה' : (ans.question.displayOpts[ans.selected] || "לא ברור");
      
      const { data, error } = await supabase.functions.invoke('explain-error', {
        body: {
          question: ans.question.displayQ,
          selectedOption: selectedText,
          correctOption: actualCorrect
        }
      });
      
      if (error) {
        console.error("Supabase Invoke Error:", error);
        setExplanation(`שגיאת שרת: ${error.message || 'שגיאה לא ידועה'}. ודא ש-API KEY מוגדר והפונקציה פרוסה.`);
      } else if (data && data.explanation) {
        setExplanation(data.explanation);
      } else if (data && data.error) {
        setExplanation(`שגיאת תשובת AI: ${data.error}`);
      } else {
        setExplanation("לא התקבל הסבר ברור מהפונקציה.");
      }
    } catch (e) {
      console.error("Network Error:", e);
      setExplanation(`שגיאת תקשורת עם המורה AI: ${e.message}`);
    }
    setLoading(false);
  };

  const isSkipped = ans.selected === -1;
  const isCorrect = ans.isCorrect;
  const aiBtnText = isCorrect ? "📚 הרחב ידע: הסבר המורה AI" : (isSkipped ? "💡 הסבר: למה זו התשובה הנכונה?" : "✨ למה טעיתי? שאל את המורה AI");
  const aiBtnClass = isCorrect ? "text-slate-500 hover:text-blue-600 py-2 text-sm" : "text-blue-700 bg-blue-50 px-4 py-3 rounded-xl border border-blue-100 hover:bg-blue-100 w-full justify-center shadow-sm text-base text-center";

  return (
    <div className="bg-white p-6 rounded-3xl border border-blue-50 shadow-md text-right">
      <div className="flex justify-between items-center mb-4 text-xs font-bold text-slate-900">
        <p className="opacity-40 text-sm">שאלה {index + 1}</p>
        {isSkipped ? <span className="text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 font-bold">⏭️ דולג</span> :
          (isCorrect ? <span className="text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 font-bold">✅ נכון</span> : <span className="text-red-700 bg-red-50 px-3 py-1 rounded-full border border-red-100 font-bold">❌ טעות</span>)}
      </div>
      
      {ans.question.vId ? (
        <div className="mb-5 rounded-xl overflow-hidden aspect-video bg-black shadow-sm"><iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ans.question.vId}`} frameBorder="0" allowFullScreen></iframe></div>
      ) : ans.question.image ? (
        <div className="mb-5 rounded-xl overflow-hidden bg-slate-50 flex justify-center border border-slate-100 p-2 cursor-pointer hover:bg-slate-100 transition-colors relative group" onClick={() => setZoomImg && setZoomImg(ans.question.image)}>
          <img src={ans.question.image} alt="Sign" className="max-h-48 object-contain" />
          <div className="absolute bottom-2 left-2 bg-white/90 px-2 py-1 rounded-md shadow-sm text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">🔍</div>
        </div>
      ) : null}

      <h3 className="text-lg font-bold mb-5 leading-relaxed text-slate-900">{ans.question.displayQ}</h3>
      <div className="space-y-2.5">
        {ans.question.displayOpts.map((opt, oIdx) => {
          const isCorrectOpt = ans.question.correctIdx === oIdx;
          const isSelected = ans.selected === oIdx;
          let bg = "bg-slate-50", border = "border-slate-100", text = "text-slate-600";
          if (isCorrectOpt) { bg = "bg-emerald-50"; border = "border-emerald-200"; text = "text-emerald-950 font-black"; }
          if (isSelected && !isCorrectOpt) { bg = "bg-red-50"; border = "border-red-200"; text = "text-red-950"; }
          return opt && <div key={oIdx} className={`p-4 rounded-xl border ${bg} ${border} ${text} flex items-center justify-between`}><span>{opt}</span><span className="text-xs opacity-40 font-bold">{['א', 'ב', 'ג', 'ד'][oIdx]}</span></div>;
        })}
      </div>
      <div className="mt-6 pt-6 border-t border-slate-50 text-right">
        {!explanation ? (
          <button onClick={askAI} disabled={loading} className={`font-bold flex items-center gap-2 transition-all ${aiBtnClass}`}>
            {loading ? <span className="animate-pulse">⏳ המורה AI מנתח...</span> : aiBtnText}
          </button>
        ) : (
          <div className="bg-[#fffdf0] p-5 rounded-2xl border border-amber-200 text-sm text-slate-800 leading-relaxed mt-4 shadow-inner relative text-right animate-in fade-in duration-500">
            <div className="absolute top-0 right-0 -mt-4 mr-4 bg-white w-8 h-8 flex items-center justify-center text-lg shadow-sm rounded-full border border-amber-200">🤖</div>
            <h4 className="font-bold text-amber-800 mb-2">הסבר המורה AI:</h4>
            <p className="whitespace-pre-wrap">{explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;