CREATE TABLE IF NOT EXISTS study_chapters (
  id SERIAL PRIMARY KEY,
  chapter_number INT,
  title TEXT,
  content_md TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_progress (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL,
  student_name TEXT,
  class_id UUID REFERENCES classes(id),
  chapter_number INT,
  questions_answered INT DEFAULT 0,
  score INT DEFAULT 0,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, chapter_number)
);

CREATE OR REPLACE FUNCTION increment_learning_progress(p_student_id TEXT, p_name TEXT, p_class_id UUID, p_chapter INT, p_score_add INT)
RETURNS void AS $$
BEGIN
  INSERT INTO learning_progress (student_id, student_name, class_id, chapter_number, questions_answered, score, last_activity)
  VALUES (p_student_id, p_name, p_class_id, p_chapter, 1, p_score_add, NOW())
  ON CONFLICT (student_id, chapter_number) DO UPDATE
  SET student_name = EXCLUDED.student_name,
      class_id = EXCLUDED.class_id,
      questions_answered = learning_progress.questions_answered + 1,
      score = learning_progress.score + p_score_add,
      last_activity = NOW();
END;
$$ LANGUAGE plpgsql;
