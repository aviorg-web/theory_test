import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parseQuestion } from '../utils/questionParser';

export function Academy({ student, onBack }) {
  const [chapters, setChapters] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [activeChapter, setActiveChapter] = useState(null);
  const [viewState, setViewState] = useState('list'); // 'list', 'read', 'practice', 'quiz_result'
  const [showPdf, setShowPdf] = useState(true);
  
  // Game state
  const [gameQIdx, setGameQIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [coins, setCoins] = useState(0);
  const [gameQuestions, setGameQuestions] = useState([]);
  const [currentAnswers, setCurrentAnswers] = useState([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(null);
  const [lastSelected, setLastSelected] = useState(null);
  
  // AI Help
  const [aiHint, setAiHint] = useState("");
  const [loadingHint, setLoadingHint] = useState(false);
  
  // Image error handling for practice mode
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    loadData();
  }, [student]);

  const loadData = async () => {
    // טעינת פרקי הלימוד
    const { data: chData } = await supabase.from('study_chapters').select('*').order('chapter_number');
    if (chData) setChapters(chData.filter(ch => String(ch.chapter_number) !== '1'));
    
    // טעינת התקדמות אישית
    if (student) {
      const { data: progData } = await supabase.from('learning_progress').select('*').eq('student_id', student.tz);
      if (progData) {
        // מיפוי ההתקדמות לתוך הפרקים או סטייט נפרד
        let totalCoins = 0;
        progData.forEach(p => { totalCoins += p.score; });
        setCoins(totalCoins);
      }
    }
  };

  const openReading = (chapter) => {
    setActiveChapter(chapter);
    setViewState('read');
  };

  const startPractice = async (chapter) => {
    setActiveChapter(chapter);
    
    // שאיבת שאלות שקשורות לפרק זה מתוך המאגר המרכזי
    const { data: qData } = await supabase.from('questions').select('*').eq('chapter_number', chapter.chapter_number);
    
    if (qData && qData.length > 0) {
      // ערבוב שאלות
      const shuffled = qData.sort(() => Math.random() - 0.5).slice(0, 15); // מקסימום 15 שאלות לסשן תרגול
      setGameQuestions(shuffled);
      setGameQIdx(0);
      setStreak(0);
      setAiHint("");
      setCurrentAnswers([]);
      setShowExplanation(false);
      setImgErr(false);
      setViewState('practice');
    } else {
      alert("אין עדיין שאלות משויכות לפרק זה במאגר.");
    }
  };

  const currentQ = useMemo(() => {
    if (!gameQuestions[gameQIdx]) return null;
    return parseQuestion(gameQuestions[gameQIdx]);
  }, [gameQuestions, gameQIdx]);


  const handleAnswer = async (selIdx) => {
    const isCorrect = selIdx === currentQ.correctIdx;
    setLastSelected(selIdx);
    setLastAnswerCorrect(isCorrect);
    setCurrentAnswers([...currentAnswers, { q: currentQ, correct: isCorrect }]);
    
    if (isCorrect) {
      setStreak(s => s + 1);
      const earned = 10 + (streak * 5); // בונוס רצף
      setCoins(c => c + earned);
      
      // עדכון בסיס נתונים באופן אסינכרוני
      if (student) {
         await supabase.rpc('increment_learning_progress', { 
           p_student_id: String(student.tz), 
           p_name: student.name,
           p_class_id: student.class_id,
           p_chapter: activeChapter.chapter_number,
           p_score_add: earned
         });
      }
    } else {
      setStreak(0);
    }

    setAiHint("");
    setShowExplanation(true);
  };

  const nextQuestion = () => {
    setShowExplanation(false);
    if (gameQIdx + 1 < gameQuestions.length) {
      setGameQIdx(i => i + 1);
      setImgErr(false);
    } else {
      setViewState('quiz_result');
    }
  };

  const askAiHint = async () => {
    if (!currentQ) return;
    setLoadingHint(true);
    try {
      const selectedOptText = showExplanation ? (lastSelected !== null ? currentQ.displayOpts[lastSelected] : "לא נבחר") : "אני מתלבט, תן לי רמז קטן מבלי לגלות את התשובה";
      const { data, error } = await supabase.functions.invoke('explain-error', {
        body: {
          question: currentQ.displayQ,
          selectedOption: selectedOptText,
          correctOption: currentQ.displayOpts[currentQ.correctIdx]
        }
      });
      if (data && data.explanation) {
        setAiHint(data.explanation);
      } else {
        setAiHint("מצטער, המורה AI כרגע לא מצליח לגבש הסבר ברור.");
      }
    } catch (e) {
      setAiHint("שגיאת תקשורת מול מערכת הרמזים.");
    }
    setLoadingHint(false);
  };


  // ============= VIEWS =============

  if (viewState === 'list') return (
    <div className="min-h-screen bg-[#f0f7ff] p-6 rtl font-sans text-slate-800">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl shadow-sm mb-8 border border-blue-100">
         <div>
           <h1 className="text-3xl font-black text-blue-900 tracking-tight">האקדמיה לנהיגה</h1>
           <p className="text-slate-500 font-bold mt-1">אזור הלימוד והתרגול החכם שלך, {student?.name}</p>
         </div>
         <div className="flex items-center gap-4 mt-4 md:mt-0">
           <div className="bg-amber-100 text-amber-800 flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black border border-amber-200">
              <span className="text-2xl">🪙</span>
              <span className="text-xl">{coins}</span>
           </div>
           <button onClick={onBack} className="bg-slate-100 text-slate-700 font-bold px-6 py-2.5 rounded-2xl hover:bg-slate-200 active:scale-95 transition">חזור לראשי</button>
         </div>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {chapters.length === 0 ? (
          <div className="col-span-full text-center py-20 bg-white rounded-3xl border border-dashed border-blue-200 text-blue-400 font-bold text-xl">
             חומרי הלימוד טרם נטענו למערכת. בקש מהמורה להריץ את סיווג החומר.
          </div>
        ) : (
          chapters.map(ch => (
            <div key={ch.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-blue-100 text-blue-800 text-xs font-black px-3 py-1 rounded-lg">פרק {ch.chapter_number}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2 leading-tight">{ch.title}</h3>
              </div>
              <div className="mt-6 flex gap-2">
                <button onClick={() => openReading(ch)} className="flex-1 bg-slate-50 text-slate-700 font-bold py-2.5 rounded-xl border border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition">📖 חומר עיוני</button>
                <button onClick={() => startPractice(ch)} className="flex-1 bg-indigo-50 text-indigo-700 font-bold py-2.5 rounded-xl border border-indigo-200 hover:bg-indigo-600 hover:text-white transition">🎯 תרגל!</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (viewState === 'read') {
    let pdfPage = 1;
    let mdContent = activeChapter.content_md || "";
    
    // תמיכה בפורמט הישן של ה-PDF אם יש [PDF_PAGE]
    const pageMatch = mdContent.match(/\[PDF_PAGE:(\d+)\]/);
    if (pageMatch) {
      pdfPage = Number(pageMatch[1]);
    } else {
      // ננסה לחלץ את העמוד מהתמונה הראשונה בפורמט החדש
      const imgPageMatch = mdContent.match(/_p_(\d+)_/);
      if (imgPageMatch) {
        pdfPage = Number(imgPageMatch[1]);
      }
    }

    const hasRichContent = mdContent.includes('![Image]') || mdContent.includes('[Link:');

    return (
      <div className="min-h-screen bg-[#f0f7ff] p-4 md:p-6 rtl font-sans">
        <div className="max-w-6xl mx-auto bg-white rounded-[2.5rem] p-8 shadow-xl border border-blue-50 relative overflow-hidden flex flex-col h-[90vh]">
           <button onClick={() => setViewState('list')} className="absolute top-6 right-6 z-50 bg-slate-100 hover:bg-slate-200 w-10 h-10 rounded-full flex items-center justify-center font-bold text-slate-600 transition">✕</button>
           
           <div className="mb-4 pr-12 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
             <div>
               <span className="text-blue-500 font-bold text-sm tracking-widest">פרק {activeChapter.chapter_number}</span>
               <h2 className="text-3xl font-black text-slate-900 mt-2">{activeChapter.title}</h2>
             </div>
             
             {hasRichContent && (
               <button onClick={() => setShowPdf(!showPdf)} className="bg-blue-100 text-blue-700 px-4 py-2 rounded-xl font-bold hover:bg-blue-200 transition">
                 {showPdf ? "📄 הצג טקסט חכם (בטא)" : "🖼️ הצג PDF מקורי"}
               </button>
             )}
           </div>
           
           <div className="flex-1 overflow-y-auto rounded-3xl border border-slate-200 relative bg-slate-50 p-2 md:p-6">
               {(showPdf || !hasRichContent) ? (
                 <iframe src={`/study_book.pdf#page=${pdfPage}`} className="w-full h-full border-0 rounded-2xl" title="PDF Reader"></iframe>
               ) : (
                 <div className="prose prose-lg prose-blue max-w-none text-slate-800 rtl text-right markdown-content p-4" dir="rtl">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        img: ({node, ...props}) => <img {...props} className="mx-auto rounded-xl shadow-md my-6 max-h-96 bg-white" />,
                        h1: ({node, ...props}) => <h1 {...props} className="text-3xl font-black text-blue-900 mb-6" dir="rtl" />,
                        h2: ({node, ...props}) => <h2 {...props} className="text-2xl font-bold text-blue-800 mb-4 mt-8" dir="rtl" />,
                        h3: ({node, ...props}) => <h3 {...props} className="text-xl font-bold text-blue-700 mb-3 mt-6" dir="rtl" />,
                        p: ({node, ...props}) => <p {...props} className="mb-4 leading-relaxed text-lg" dir="rtl" />,
                        strong: ({node, ...props}) => <strong {...props} className="font-black text-slate-900" />,
                        a: ({node, ...props}) => {
                          if (props.href && (props.href.includes('youtube.com') || props.href.includes('youtu.be') || props.href.includes('vimeo.com'))) {
                            return <div className="my-6 text-center text-blue-600 font-bold bg-blue-50 p-4 rounded-xl border border-blue-100"><a {...props} target="_blank" rel="noreferrer">🎥 לחץ כאן לצפייה בסרטון (נפתח בחלון חדש)</a></div>;
                          }
                          return <a {...props} target="_blank" rel="noreferrer" className="text-blue-600 underline hover:text-blue-800" />;
                        }
                      }}
                    >
                      {mdContent}
                    </ReactMarkdown>
                 </div>
               )}
           </div>

           <div className="mt-6 shrink-0 flex justify-center">
              <button onClick={() => startPractice(activeChapter)} className="bg-gradient-to-l from-indigo-600 to-blue-500 text-white font-black text-lg px-12 py-4 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all">סיימתי לקרוא, יאללה לתרגל! 🚀</button>
           </div>
        </div>
      </div>
    );
  }

  if (viewState === 'practice' && currentQ) return (
    <div className="min-h-screen bg-slate-900 p-4 flex flex-col rtl font-sans text-white">
      <div className="max-w-4xl mx-auto w-full flex justify-between items-center mb-6 px-4">
         <div className="bg-slate-800 border border-slate-700 px-5 py-2 rounded-2xl font-bold flex gap-4">
           <span>🪙 {coins} מטבעות</span>
           <span className="text-amber-400">🔥 רצף {streak}</span>
         </div>
         <div className="font-bold text-slate-400">שאלה {gameQIdx+1} / {gameQuestions.length}</div>
         <button onClick={() => setViewState('list')} className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl font-bold hover:bg-red-500 hover:text-white transition">יציאה</button>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full flex flex-col justify-center items-center relative z-10">
        
        {currentQ.vId && (
          <div className="mb-8 rounded-3xl overflow-hidden aspect-video w-full max-w-2xl bg-black shadow-2xl border-4 border-slate-800">
            <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${currentQ.vId}`} frameBorder="0" allowFullScreen></iframe>
          </div>
        )}
        
        {currentQ.image && !currentQ.vId && !imgErr && (
          <div className="mb-6 rounded-3xl overflow-hidden border-[4px] border-slate-800 bg-white p-2 shadow-2xl max-w-xs mx-auto">
            <img src={currentQ.image} alt="sign" className="h-40 object-contain w-full" onError={() => setImgErr(true)} onLoad={(e) => { if (e.target.naturalWidth < 20) setImgErr(true); }} />
          </div>
        )}

        <h2 className={`font-black text-center mb-10 leading-tight bg-gradient-to-r from-blue-100 to-white bg-clip-text text-transparent px-4 ${currentQ.displayQ.length > 80 ? 'text-xl md:text-2xl' : 'text-2xl md:text-4xl'}`} dir="rtl">
          {currentQ.displayQ}&#x200F;
        </h2>

        {!showExplanation ? (
          <div className="w-full grid md:grid-cols-2 gap-4">
            {currentQ.displayOpts.map((opt, i) => opt && (
              <button key={i} onClick={() => handleAnswer(i)} className="relative group overflow-hidden bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-blue-400 p-6 rounded-[2rem] text-right transition-all active:scale-95 shadow-xl">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="text-xl font-bold text-slate-100 relative z-10" dir="rtl">{opt}&#x200F;</span>
                <span className="absolute top-1/2 -translate-y-1/2 left-6 w-10 h-10 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center font-black group-hover:bg-blue-500 group-hover:text-white transition-all z-10">{['א', 'ב', 'ג', 'ד'][i]}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="w-full max-w-3xl bg-slate-800 p-8 rounded-[2rem] border border-slate-600 text-center animate-in slide-in-from-bottom-4 duration-500">
            <div className="text-6xl mb-4">{lastAnswerCorrect ? '✅' : '❌'}</div>
            <h3 className={`text-3xl font-black mb-6 ${lastAnswerCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
              {lastAnswerCorrect ? 'כל הכבוד! תשובה נכונה' : 'טעות, לא נורא!'}
            </h3>
            
            <div className="bg-slate-900/50 p-6 rounded-2xl mb-8 border border-slate-700 text-right">
               <p className="text-slate-400 font-bold mb-2 text-sm">התשובה הנכונה היא:</p>
               <p className="text-xl text-emerald-400 font-black">{currentQ.displayOpts[currentQ.correctIdx]}</p>
            </div>

            {!aiHint ? (
              <button onClick={askAiHint} disabled={loadingHint} className="bg-blue-900/40 text-blue-300 border border-blue-800 hover:bg-blue-800/60 font-bold px-8 py-3 rounded-full flex items-center gap-2 mx-auto active:scale-95 transition mb-8">
                {loadingHint ? "⏳ מפעיל רשתות מורה AI..." : "🤖 קבל הסבר מלא מהמורה AI לגבי התשובה"}
              </button>
            ) : (
              <div className="bg-[#1e293b] border border-amber-500/30 p-6 text-amber-200 rounded-3xl font-medium leading-relaxed text-right mb-8 shadow-inner shadow-amber-900/20 relative animate-in zoom-in-95 duration-500">
                 <div className="absolute -top-4 -right-4 bg-slate-900 border border-amber-500/50 w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-lg">💡</div>
                 <p className="whitespace-pre-wrap">{aiHint}</p>
              </div>
            )}

            <button onClick={nextQuestion} className="bg-gradient-to-l from-blue-600 to-indigo-500 text-white font-black text-xl px-12 py-4 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all">
              המשך לשאלה הבאה ⏭️
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (viewState === 'quiz_result') {
    const correctCount = currentAnswers.filter(a => a.correct).length;
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex flex-col justify-center items-center rtl font-sans text-center">
         <div className="bg-slate-800 p-12 rounded-[3.5rem] shadow-[0_0_50px_rgba(30,64,175,0.2)] border border-slate-700 max-w-md w-full relative overflow-hidden">
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20"></div>
            <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-amber-500 rounded-full blur-[100px] opacity-10"></div>
            
            <div className="text-8xl mb-6 relative z-10">{correctCount >= gameQuestions.length * 0.8 ? "👑" : "👏"}</div>
            <h2 className="text-4xl font-black text-white mb-2 relative z-10">סיום אימון!</h2>
            <p className="text-slate-400 mb-8 font-bold text-lg relative z-10">ענית נכונה על {correctCount} מתוך {gameQuestions.length} במקבץ זה.</p>
            
            <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-700 mb-8 relative z-10">
               <p className="text-sm text-slate-500 font-bold mb-1">סך מטבעות שצברת מבונוסים והצלחות:</p>
               <p className="text-3xl font-black text-amber-400">🪙 {coins}</p>
            </div>

            <button onClick={() => setViewState('list')} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-xl py-5 rounded-2xl active:scale-95 transition-all shadow-lg shadow-blue-900/50 relative z-10">חזור למפת הלמידה</button>
         </div>
      </div>
    );
  }

  return null;
}
