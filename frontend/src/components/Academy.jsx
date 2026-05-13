import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parseQuestion } from '../utils/questionParser';
import { cleanContentMd } from '../utils/contentCleaner';
import { recordAnswer, selectAdaptiveQuestions, getChapterStats } from '../utils/adaptiveEngine';

function ProgressRing({ pct=0, size=52, stroke=4, color='#4F8EF7' }) {
  const r=(size-stroke*2)/2, circ=2*Math.PI*r, dash=(pct/100)*circ;
  return <svg width={size} height={size} className="rotate-[-90deg]"><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth={stroke}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{transition:'stroke-dasharray 0.6s ease'}}/></svg>;
}

function ChapterCard({ ch, stats, onRead, onPractice }) {
  const ring=stats.answered>0?Math.round((stats.answered/stats.total)*100):0;
  const rc=stats.accuracy>=80?'#34D399':stats.accuracy>=50?'#F59E0B':'#F87171';
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex flex-col gap-4 hover:bg-white/8 transition-all">
      <div className="flex justify-between items-start">
        <div className="flex-1 ml-3"><span className="text-blue-400 text-xs font-bold">פרק {ch.chapter_number}</span><h3 className="text-white font-bold text-base leading-tight mt-1">{ch.title}</h3></div>
        <div className="relative shrink-0">
          <ProgressRing pct={ring} color={stats.answered>0?rc:'#334155'}/>
          <div className="absolute inset-0 flex items-center justify-center"><span className="text-xs font-black" style={{color:stats.answered>0?rc:'#64748b'}}>{stats.answered>0?`${ring}%`:'—'}</span></div>
        </div>
      </div>
      {stats.answered>0&&<div className="flex items-center gap-2 text-xs"><span className="text-slate-400">{stats.answered}/{stats.total} שאלות</span><span className="text-slate-600">•</span><span style={{color:rc}} className="font-bold">{stats.accuracy}% הצלחה</span></div>}
      <div className="flex gap-2">
        <button onClick={onRead} className="flex-1 bg-white/5 border border-white/10 text-slate-300 font-bold py-2.5 rounded-xl text-sm hover:bg-blue-600/20 hover:text-blue-300 hover:border-blue-500/30 transition-all active:scale-95">📖 קרא</button>
        <button onClick={onPractice} className="flex-1 bg-blue-600/20 border border-blue-500/30 text-blue-300 font-bold py-2.5 rounded-xl text-sm hover:bg-blue-600/40 transition-all active:scale-95">🎯 תרגל</button>
      </div>
    </div>
  );
}

export function Academy({ student, allQuestions=[], onBack }) {
  const [chapters,setChapters]=useState([]);
  const [viewState,setViewState]=useState('list');
  const [activeChapter,setActiveChapter]=useState(null);
  const [showPdf,setShowPdf]=useState(false);
  const [gameQuestions,setGameQuestions]=useState([]);
  const [qIdx,setQIdx]=useState(0);
  const [streak,setStreak]=useState(0);
  const [coins,setCoins]=useState(0);
  const [answers,setAnswers]=useState([]);
  const [selected,setSelected]=useState(null);
  const [showExpl,setShowExpl]=useState(false);
  const [aiHint,setAiHint]=useState('');
  const [loadingHint,setLoadingHint]=useState(false);
  const [imgErr,setImgErr]=useState(false);
  const [zoomImg,setZoomImg]=useState(null);

  useEffect(()=>{
    supabase.from('study_chapters').select('*').order('chapter_number').then(({data})=>{if(data)setChapters(data.filter(ch=>String(ch.chapter_number)!=='1'));});
    if(student){supabase.from('learning_progress').select('*').eq('student_id',student.tz).then(({data})=>{if(data)setCoins(data.reduce((s,p)=>s+(p.score||0),0));});}
  },[student]);

  const chapterQMap=useMemo(()=>{const m={};allQuestions.forEach(q=>{const c=String(q.chapter_number||'');if(!m[c])m[c]=[];m[c].push(q);});return m;},[allQuestions]);
  const currentQ=useMemo(()=>gameQuestions[qIdx]?parseQuestion(gameQuestions[qIdx]):null,[gameQuestions,qIdx]);

  const startPractice=async(ch)=>{
    setActiveChapter(ch);
    const{data:qData}=await supabase.from('questions').select('*').eq('chapter_number',ch.chapter_number);
    if(!qData?.length){alert('אין עדיין שאלות לפרק זה.');return;}
    const adaptive=student?selectAdaptiveQuestions(student.tz,qData,15):qData.sort(()=>Math.random()-0.5).slice(0,15);
    setGameQuestions(adaptive);setQIdx(0);setStreak(0);setAnswers([]);setSelected(null);setShowExpl(false);setAiHint('');setImgErr(false);
    setViewState('practice');
  };

  /* LIST */
  if(viewState==='list')return(
    <div className="min-h-screen bg-gradient-to-br from-[#060D1F] to-[#0D1B3E] rtl font-sans p-4 pb-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center pt-6 mb-6">
          <div><h1 className="text-2xl font-black text-white">האקדמיה לנהיגה 📚</h1><p className="text-blue-400 text-sm font-medium mt-0.5">{student?.name} • {chapters.length} פרקים</p></div>
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-4 py-1.5 rounded-xl font-black text-sm flex items-center gap-1.5">🪙 {coins}</div>
            <button onClick={onBack} className="text-slate-500 font-bold text-sm hover:text-red-400 transition-colors">יציאה</button>
          </div>
        </div>
        {chapters.length===0?<div className="text-center py-20 text-slate-500 font-bold">טוען פרקים...</div>:
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {chapters.map(ch=>{
              const chQs=chapterQMap[String(ch.chapter_number)]||[];
              const stats=student?getChapterStats(student.tz,chQs):{answered:0,total:chQs.length,accuracy:0};
              return <ChapterCard key={ch.id} ch={ch} stats={stats} onRead={()=>{setActiveChapter(ch);setViewState('read');}} onPractice={()=>startPractice(ch)}/>;
            })}
          </div>}
      </div>
    </div>
  );

  /* READ */
  if(viewState==='read'&&activeChapter){
    let pdfPage=1,mdContent=cleanContentMd(activeChapter.content_md||'');
    const pm=mdContent.match(/\[PDF_PAGE:(\d+)\]/);if(pm){pdfPage=Number(pm[1]);mdContent=mdContent.replace(/\[PDF_PAGE:\d+\]\n?/,'');}
    const hasRich=mdContent.includes('![Image]')||mdContent.includes('[Link:');
    return(
      <div className="min-h-screen bg-[#f8faff] rtl font-sans flex flex-col" dir="rtl">
        <div className="bg-white border-b border-slate-100 px-4 py-3 flex justify-between items-center sticky top-0 z-10 shadow-sm">
          <button onClick={()=>setViewState('list')} className="text-slate-500 font-bold text-sm hover:text-slate-800 transition-colors">← חזור</button>
          <div className="text-center"><p className="text-xs text-blue-500 font-bold">פרק {activeChapter.chapter_number}</p><p className="text-sm font-black text-slate-800 truncate max-w-[180px]">{activeChapter.title}</p></div>
          {hasRich?<button onClick={()=>setShowPdf(!showPdf)} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">{showPdf?'📄 טקסט':'🖼️ PDF'}</button>:<div className="w-16"/>}
        </div>
        <div className="flex-1 max-w-2xl mx-auto w-full p-4">
          {(showPdf||!hasRich)?<div className="h-[70vh] rounded-2xl overflow-hidden border border-slate-200 shadow-sm"><iframe src={`/study_book.pdf#page=${pdfPage}`} className="w-full h-full border-0" title="PDF"/></div>:
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="prose prose-blue max-w-none rtl text-right" dir="rtl">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                  img:({node,...p})=><img {...p} className="mx-auto rounded-xl shadow-md my-4 max-h-72"/>,
                  h1:({node,...p})=><h1 {...p} className="text-2xl font-black text-blue-900 mb-4" dir="rtl"/>,
                  h2:({node,...p})=><h2 {...p} className="text-xl font-bold text-blue-800 mb-3 mt-6" dir="rtl"/>,
                  h3:({node,...p})=><h3 {...p} className="text-lg font-bold text-blue-700 mb-2 mt-5" dir="rtl"/>,
                  p:({node,...p})=><p {...p} className="mb-3 leading-relaxed text-slate-700" dir="rtl"/>,
                  li:({node,...p})=><li {...p} className="mb-1 text-slate-700" dir="rtl"/>,
                  a:({node,...p})=>{if(p.href?.includes('youtu'))return <div className="my-4 bg-blue-50 p-4 rounded-xl border border-blue-100 text-center"><a {...p} target="_blank" rel="noreferrer" className="text-blue-600 font-bold">🎥 לצפייה בסרטון</a></div>;return <a {...p} target="_blank" rel="noreferrer" className="text-blue-600 underline"/>;}
                }}>{mdContent}</ReactMarkdown>
              </div>
            </div>}
        </div>
        <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-slate-100 p-4">
          <button onClick={()=>startPractice(activeChapter)} className="w-full max-w-2xl mx-auto block bg-gradient-to-l from-blue-600 to-indigo-600 text-white font-black text-lg py-4 rounded-2xl shadow-lg active:scale-95 transition-all">סיימתי לקרוא, יאללה לתרגל! 🚀</button>
        </div>
      </div>
    );
  }

  /* PRACTICE */
  if(viewState==='practice'&&currentQ){
    const isC=selected===currentQ.correctIdx;
    const prog=(qIdx/gameQuestions.length)*100;
    const handleAnswer=async(i)=>{
      if(showExpl)return;setSelected(i);
      const correct=i===currentQ.correctIdx;
      if(student)recordAnswer(student.tz,currentQ.id||currentQ.question_id,correct);
      if(correct){setStreak(s=>s+1);const e=10+streak*5;setCoins(c=>c+e);if(student)supabase.rpc('increment_learning_progress',{p_student_id:String(student.tz),p_name:student.name,p_class_id:student.class_id,p_chapter:activeChapter.chapter_number,p_score_add:e});}
      else{setStreak(0);}
      setAnswers(prev=>[...prev,{q:currentQ,selected:i,correct}]);setAiHint('');setShowExpl(true);
    };
    const nextQ=()=>{setShowExpl(false);setSelected(null);setAiHint('');setImgErr(false);if(qIdx+1<gameQuestions.length)setQIdx(i=>i+1);else setViewState('result');};
    const askAI=async()=>{setLoadingHint(true);try{const{data}=await supabase.functions.invoke('explain-error',{body:{question:currentQ.displayQ,selectedOption:showExpl&&selected!==null?currentQ.displayOpts[selected]:'אני מתלבט',correctOption:currentQ.displayOpts[currentQ.correctIdx]}});setAiHint(data?.explanation||'לא התקבל הסבר.');}catch{setAiHint('שגיאת תקשורת.');}setLoadingHint(false);};
    return(
      <div className="min-h-screen bg-[#0A0F1E] rtl font-sans flex flex-col" dir="rtl">
        <div className="px-4 pt-4 pb-3 flex justify-between items-center">
          <button onClick={()=>setViewState('list')} className="text-slate-500 font-bold text-sm hover:text-red-400 transition-colors bg-white/5 px-3 py-1.5 rounded-xl">יציאה</button>
          <div className="flex items-center gap-3">
            <span className="text-amber-400 font-black text-sm">🪙 {coins}</span>
            {streak>1&&<span className="text-orange-400 font-black text-sm">🔥 {streak}</span>}
            <span className="text-slate-400 text-xs font-bold">{qIdx+1}/{gameQuestions.length}</span>
          </div>
          <div className="w-16"/>
        </div>
        <div className="h-1 bg-white/5 mx-4 rounded-full"><div className="h-1 bg-blue-500 rounded-full transition-all duration-500" style={{width:`${prog}%`}}/></div>
        <div className="flex-1 max-w-2xl mx-auto w-full p-4 pt-6 flex flex-col">
          {currentQ.vId&&<div className="mb-5 rounded-2xl overflow-hidden aspect-video bg-black shadow-xl border border-white/10"><iframe className="w-full h-full" src={`https://www.youtube.com/embed/${currentQ.vId}`} frameBorder="0" allowFullScreen/></div>}
          {currentQ.image&&!currentQ.vId&&!imgErr&&<div className="mb-5 rounded-2xl bg-white/5 border border-white/10 p-3 flex justify-center cursor-zoom-in" onClick={()=>setZoomImg(currentQ.image)}><img src={currentQ.image} alt="sign" className="max-h-52 object-contain" onError={()=>setImgErr(true)}/></div>}
          <h2 className={`font-black text-white leading-tight text-right mb-6 ${currentQ.displayQ.length>90?'text-lg':'text-2xl'}`} dir="rtl">{currentQ.displayQ}&#x200F;</h2>
          {!showExpl?(
            <div className="space-y-3">
              {currentQ.displayOpts.map((opt,i)=>opt&&<button key={i} onClick={()=>handleAnswer(i)} className="w-full text-right p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-blue-600/20 hover:border-blue-500/40 active:scale-[0.98] flex items-center gap-4 transition-all group">
                <span className="w-9 h-9 shrink-0 rounded-xl border border-white/20 flex items-center justify-center text-slate-400 font-black text-sm group-hover:border-blue-400 group-hover:text-blue-400 transition-all">{['א','ב','ג','ד'][i]}</span>
                <span className="flex-1 text-slate-200 font-semibold" dir="rtl">{opt}&#x200F;</span>
              </button>)}
            </div>
          ):(
            <div className="space-y-3">
              <div className={`rounded-2xl p-4 mb-1 text-center font-black text-lg ${isC?'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400':'bg-red-500/20 border border-red-500/30 text-red-400'}`}>{isC?'✅ נכון! כל הכבוד':'❌ לא נכון — בפעם הבאה!'}</div>
              {currentQ.displayOpts.map((opt,i)=>{const isCO=i===currentQ.correctIdx,isSO=i===selected,isWO=isSO&&!isCO;return opt&&<div key={i} className={`p-4 rounded-2xl border flex items-center gap-4 ${isCO?'bg-emerald-500/15 border-emerald-500/40':isWO?'bg-red-500/15 border-red-500/40':'bg-white/3 border-white/5 opacity-40'}`}><span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-black text-sm ${isCO?'bg-emerald-500 text-white':isWO?'bg-red-500 text-white':'border border-white/10 text-slate-600'}`}>{isCO?'✓':isWO?'✗':['א','ב','ג','ד'][i]}</span><span className={`flex-1 font-semibold ${isCO?'text-emerald-300 font-black':isWO?'text-red-300':'text-slate-600'}`} dir="rtl">{opt}&#x200F;</span></div>;})}
              {!aiHint?<button onClick={askAI} disabled={loadingHint} className="w-full mt-1 bg-blue-600/10 border border-blue-500/20 text-blue-400 font-bold py-3 rounded-2xl text-sm hover:bg-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2">{loadingHint?<span className="animate-pulse">⏳ מורה AI...</span>:'🤖 הסבר מהמורה AI'}</button>:<div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl text-sm text-amber-100 leading-relaxed"><p className="font-black text-amber-400 mb-2">💡 הסבר:</p><p className="whitespace-pre-wrap">{aiHint}</p></div>}
              <button onClick={nextQ} className="w-full bg-gradient-to-l from-blue-600 to-indigo-600 text-white font-black text-xl py-4 rounded-2xl shadow-[0_0_20px_rgba(79,142,247,0.3)] active:scale-95 transition-all mt-1">{qIdx+1<gameQuestions.length?'הבא ⏭️':'סיים סשן 🏁'}</button>
            </div>
          )}
        </div>
        {zoomImg&&<div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-sm" onClick={()=>setZoomImg(null)}><img src={zoomImg} className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain bg-white p-2" onClick={e=>e.stopPropagation()}/></div>}
      </div>
    );
  }

  /* RESULT */
  if(viewState==='result'){
    const correct=answers.filter(a=>a.correct).length,pct=Math.round((correct/answers.length)*100),great=pct>=80;
    return(
      <div className="min-h-screen bg-[#0A0F1E] rtl font-sans flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8"><div className="text-7xl mb-4">{great?'🌟':'💪'}</div><h2 className="text-3xl font-black text-white">{great?'עבודה מצוינת!':'ממשיכים!'}</h2><p className="text-slate-400 font-bold mt-1">{activeChapter?.title}</p></div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-6 text-center">
            <div className="relative inline-block mb-4"><ProgressRing pct={pct} size={100} stroke={8} color={great?'#34D399':'#F59E0B'}/><div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl font-black" style={{color:great?'#34D399':'#F59E0B'}}>{pct}%</span></div></div>
            <p className="text-slate-400 font-bold">{correct} / {answers.length} נכונות</p>
            <p className="text-amber-400 font-bold text-sm mt-1">🪙 {coins} מטבעות</p>
          </div>
          {answers.filter(a=>!a.correct).length>0&&<div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-4"><p className="text-red-400 font-bold text-sm mb-2">שאלות לחזרה ({answers.filter(a=>!a.correct).length}):</p>{answers.filter(a=>!a.correct).slice(0,3).map((a,i)=><p key={i} className="text-slate-400 text-xs mb-1 truncate" dir="rtl">• {a.q.displayQ.slice(0,50)}...</p>)}</div>}
          <div className="space-y-3">
            <button onClick={()=>startPractice(activeChapter)} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black active:scale-95 transition-all">תרגל שוב 🔁</button>
            <button onClick={()=>setViewState('list')} className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-bold active:scale-95 transition-all">חזור לפרקים</button>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
