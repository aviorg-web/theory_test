import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { question, selectedOption, correctOption } = await req.json()

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "מפתח API חסר בשרת." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const prompt = `
      אתה מורה נהיגה מומחה. תלמיד טעה בשאלה בבחינת התיאוריה.
      השאלה: "${question}"
      התלמיד בחר: "${selectedOption}"
      התשובה הנכונה היא: "${correctOption}"
      
      אנא הסבר לתלמיד בצורה קצרה, סבלנית ומקצועית (עד 3 משפטים):
      1. למה הבחירה שלו שגויה?
      2. מה ההיגיון שמאחורי התשובה הנכונה?
      3. טיפ קטן לזכור את זה להבא.
      כתוב בעברית רהוטה וברורה.
    `

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    })

    if (!response.ok) {
       const text = await response.text();
       return new Response(JSON.stringify({ error: `שגיאת Google API: ${response.status} - ${text}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const data = await response.json()
    if (!data.candidates || !data.candidates[0]) {
       return new Response(JSON.stringify({ error: `שגיאת AI חריגה: ${JSON.stringify(data)}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    const explanation = data.candidates[0].content.parts[0].text

    return new Response(JSON.stringify({ explanation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 })
  }
})