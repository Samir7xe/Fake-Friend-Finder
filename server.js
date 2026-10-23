require('dotenv').config();
const express=require('express'),session=require('express-session'),bcrypt=require('bcryptjs'),{Pool}=require('pg'),crypto=require('crypto'),path=require('path');
const app=express(),PORT=process.env.PORT||3000,prod=process.env.NODE_ENV==='production';
if(!process.env.DATABASE_URL||!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32||!process.env.ADMIN_PASSWORD_HASH){console.error('Set DATABASE_URL, SESSION_SECRET (32+ chars), and ADMIN_PASSWORD_HASH.');process.exit(1)}
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='true'?{rejectUnauthorized:false}:undefined});
app.set('trust proxy',1);app.use(express.json({limit:'150kb'}));app.use(express.static(path.join(__dirname,'public')));app.use(session({name:'rff.sid',secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,cookie:{httpOnly:true,secure:prod,sameSite:'lax',maxAge:28800000}}));
const rid=()=>crypto.randomBytes(9).toString('base64url'),clean=(x,n=120)=>String(x??'').trim().slice(0,n),admin=(req,res,next)=>req.session.isAdmin?next():res.status(401).json({error:'Unauthorized'});
app.get('/api/health',(q,s)=>s.json({ok:true}));
app.get('/api/settings',async(q,s)=>{try{let r=await pool.query("SELECT value FROM site_settings WHERE key='profile'");s.json(r.rows[0]?.value||{displayName:'Your Name',avatar:'',links:[{label:'Instagram',url:''},{label:'Facebook',url:''},{label:'YouTube',url:''}]})}catch{s.status(500).json({error:'Could not load settings'})}});
app.post('/creator-room-7f3c/login',async(q,s)=>{if(!await bcrypt.compare(String(q.body?.password||''),process.env.ADMIN_PASSWORD_HASH))return s.status(401).json({error:'Incorrect password'});q.session.isAdmin=true;s.json({ok:true})});app.post('/creator-room-7f3c/logout',(q,s)=>q.session.destroy(()=>s.json({ok:true})));app.get('/api/admin/me',admin,(q,s)=>s.json({ok:true}));
app.put('/api/admin/settings',admin,async(q,s)=>{let profile={displayName:clean(q.body?.displayName,70)||'Your Name',avatar:clean(q.body?.avatar,1000),links:(Array.isArray(q.body?.links)?q.body.links.slice(0,30):[]).map(x=>({label:clean(x.label,50),url:clean(x.url,1000)})).filter(x=>x.label&&/^https?:\/\//i.test(x.url))};await pool.query("INSERT INTO site_settings(key,value) VALUES('profile',$1::jsonb) ON CONFLICT(key) DO UPDATE SET value=$1::jsonb,updated_at=NOW()",[JSON.stringify(profile)]);s.json({ok:true,profile})});
app.get('/api/admin/quizzes',admin,async(q,s)=>{let r=await pool.query(`SELECT q.id,q.creator_name,q.created_at,(SELECT COUNT(*) FROM questions x WHERE x.quiz_id=q.id)::int question_count,(SELECT COUNT(*) FROM submissions a JOIN quiz_sessions b ON b.id=a.session_id WHERE b.quiz_id=q.id)::int submission_count FROM quizzes q ORDER BY q.created_at DESC LIMIT 100`);s.json(r.rows)});app.get('/api/admin/quizzes/:id/results',admin,async(q,s)=>{let r=await pool.query('SELECT player_name,score,total,created_at FROM submissions s JOIN quiz_sessions ss ON ss.id=s.session_id WHERE ss.quiz_id=$1 ORDER BY s.created_at DESC LIMIT 200',[q.params.id]);s.json(r.rows)});
app.post('/api/quizzes',async(q,s)=>{let name=clean(q.body?.creatorName,50),gender=clean(q.body?.creatorGender,40)||'prefer-not-to-say',qs=Array.isArray(q.body?.questions)?q.body.questions:[];if(!name)return s.status(400).json({error:'Please enter your name'});if(qs.length<20||qs.length>30)return s.status(400).json({error:'A quiz must contain 20–30 questions'});for(let x of qs){let opts=Array.isArray(x.options)?x.options.map(y=>clean(y,120)).filter(Boolean):[],correct=clean(x.correctAnswer,120);if(!clean(x.prompt,300)||opts.length<4||opts.length>12||new Set(opts).size!==opts.length||!opts.includes(correct))return s.status(400).json({error:'Each question needs 4–12 unique options and one correct answer'})}let quiz=rid(),c=await pool.connect();try{await c.query('BEGIN');await c.query('INSERT INTO quizzes(id,creator_name,creator_gender) VALUES($1,$2,$3)',[quiz,name,gender]);for(let x of qs)await c.query('INSERT INTO questions(quiz_id,prompt,options,correct_answer) VALUES($1,$2,$3::jsonb,$4)',[quiz,clean(x.prompt,300),JSON.stringify(x.options.map(y=>clean(y,120)).filter(Boolean)),clean(x.correctAnswer,120)]);await c.query('COMMIT');s.status(201).json({id:quiz,shareUrl:`${q.protocol}://${q.get('host')}/play/${quiz}`})}catch(e){await c.query('ROLLBACK');console.error(e);s.status(500).json({error:'Quiz could not be saved'})}finally{c.release()}});
app.get('/api/quizzes/:id',async(q,s)=>{let quiz=await pool.query('SELECT id,creator_name FROM quizzes WHERE id=$1',[q.params.id]);if(!quiz.rowCount)return s.status(404).json({error:'Quiz not found'});let qs=await pool.query('SELECT id,prompt,options FROM questions WHERE quiz_id=$1 ORDER BY id',[q.params.id]);s.json({id:quiz.rows[0].id,creatorName:quiz.rows[0].creator_name,questions:qs.rows})});
app.post('/api/quizzes/:id/start',async(q,s)=>{let ids=Array.isArray(q.body?.questionIds)?q.body.questionIds.map(Number):[],name=clean(q.body?.playerName,50);if(!name)return s.status(400).json({error:'Enter your name'});if(ids.length!==10||new Set(ids).size!==10)return s.status(400).json({error:'Choose exactly 10 different questions'});let exists=await pool.query('SELECT id FROM quizzes WHERE id=$1',[q.params.id]);if(!exists.rowCount)return s.status(404).json({error:'Quiz not found'});let r=await pool.query('SELECT id,prompt,options,correct_answer FROM questions WHERE quiz_id=$1 AND id=ANY($2::bigint[])',[q.params.id,ids]);if(r.rowCount!==10)return s.status(400).json({error:'Invalid question selection'});let sid=rid(),presented=r.rows.map(x=>({id:x.id,prompt:x.prompt,options:[...x.options.filter(a=>a!==x.correct_answer).sort(()=>Math.random()-.5).slice(0,3),x.correct_answer].sort(()=>Math.random()-.5)}));await pool.query('INSERT INTO quiz_sessions(id,quiz_id,question_order) VALUES($1,$2,$3::jsonb)',[sid,q.params.id,JSON.stringify(presented.map(x=>x.id))]);s.json({sessionId:sid,playerName:name,questions:presented})});
app.post('/api/sessions/:id/submit',async(q,s)=>{let name=clean(q.body?.playerName,50),answers=q.body?.answers&&typeof q.body.answers==='object'?q.body.answers:{},sr=await pool.query('SELECT id,quiz_id,question_order FROM quiz_sessions WHERE id=$1',[q.params.id]);if(!sr.rowCount)return s.status(404).json({error:'Session not found'});let order=sr.rows[0].question_order,qs=await pool.query('SELECT id,correct_answer FROM questions WHERE quiz_id=$1 AND id=ANY($2::bigint[])',[sr.rows[0].quiz_id,order]),correct=new Map(qs.rows.map(x=>[String(x.id),x.correct_answer]));let score=order.filter(id=>String(answers[id]||'')===correct.get(String(id))).length,saved={};for(let id of order)saved[id]=clean(answers[id],120);await pool.query('INSERT INTO submissions(session_id,player_name,answers,score,total) VALUES($1,$2,$3::jsonb,$4,10)',[q.params.id,name||'Guest',JSON.stringify(saved),score]);s.json({score,total:10})});
// PUBLIC QUESTIONS
app.post('/api/public-questions', async (req, res) => {
  try {
    const question = clean(req.body?.question, 500);
    const name = clean(req.body?.name, 50) || 'Anonymous';
    if (question.length < 3)
      return res.status(400).json({ error: 'Question is too short' });

    await pool.query(
      'INSERT INTO public_questions(question, submitter_name) VALUES($1,$2)',
      [question, name]
    );
    res.status(201).json({ ok: true, message: 'Submitted for review' });
  } catch {
    res.status(500).json({ error: 'Could not submit question' });
  }
});

app.get('/api/public-questions', async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id, question, created_at FROM public_questions WHERE status='approved' ORDER BY created_at DESC LIMIT 100"
    );
    res.json(r.rows);
  } catch {
    res.status(500).json({ error: 'Could not load questions' });
  }
});

app.get('/api/admin/public-questions', admin, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT * FROM public_questions WHERE status='pending' ORDER BY created_at DESC"
    );
    res.json(r.rows);
  } catch {
    res.status(500).json({ error: 'Could not load pending questions' });
  }
});

app.put('/api/admin/public-questions/:id', admin, async (req, res) => {
  const status = clean(req.body?.status, 20);
  if (!['approved', 'rejected'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  try {
    const r = await pool.query(
      "UPDATE public_questions SET status=$1, reviewed_at=NOW() WHERE id=$2 RETURNING id, status",
      [status, req.params.id]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Question not found' });
    res.json({ ok: true, question: r.rows[0] });
  } catch {
    res.status(500).json({ error: 'Could not review question' });
  }
});

// WEBSITE QUESTIONS: ADMIN MANAGEMENT
app.get('/api/website-questions', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, question, options FROM website_questions WHERE active=TRUE ORDER BY id DESC'
    );
    res.json(r.rows);
  } catch {
    res.status(500).json({ error: 'Could not load website questions' });
  }
});

app.post('/api/admin/website-questions', admin, async (req, res) => {
  const question = clean(req.body?.question, 300);
  const options = Array.isArray(req.body?.options)
    ? req.body.options.map(x => clean(x, 120)).filter(Boolean)
    : [];
  const correct = clean(req.body?.correctAnswer, 120);

  if (!question || options.length < 2 ||
      new Set(options).size !== options.length || !options.includes(correct))
    return res.status(400).json({ error: 'Add a question, unique options, and a correct answer' });

  try {
    const r = await pool.query(
      'INSERT INTO website_questions(question, options, correct_answer) VALUES($1,$2::jsonb,$3) RETURNING id',
      [question, JSON.stringify(options), correct]
    );
    res.status(201).json({ ok: true, id: r.rows[0].id });
  } catch {
    res.status(500).json({ error: 'Could not save question' });
  }
});

app.put('/api/admin/website-questions/:id', admin, async (req, res) => {
  const question = clean(req.body?.question, 300);
  const options = Array.isArray(req.body?.options)
    ? req.body.options.map(x => clean(x, 120)).filter(Boolean)
    : [];
  const correct = clean(req.body?.correctAnswer, 120);

  if (!question || options.length < 2 ||
      new Set(options).size !== options.length || !options.includes(correct))
    return res.status(400).json({ error: 'Invalid question or options' });

  try {
    const r = await pool.query(
      'UPDATE website_questions SET question=$1, options=$2::jsonb, correct_answer=$3, updated_at=NOW() WHERE id=$4 RETURNING id',
      [question, JSON.stringify(options), correct, req.params.id]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Question not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Could not update question' });
  }
});

app.delete('/api/admin/website-questions/:id', admin, async (req, res) => {
  try {
    const r = await pool.query(
      'UPDATE website_questions SET active=FALSE, updated_at=NOW() WHERE id=$1 RETURNING id',
      [req.params.id]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Question not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Could not delete question' });
  }
});

// SAVE WEBSITE QUIZ ANSWERS
app.post('/api/website-answers', async (req, res) => {
  const name = clean(req.body?.playerName, 50);
  const answers = req.body?.answers;

  if (!name || !answers || typeof answers !== 'object' || Array.isArray(answers))
    return res.status(400).json({ error: 'Enter your name and answers' });

  try {
    const ids = Object.keys(answers).map(Number);
    if (!ids.length || ids.some(id => !Number.isSafeInteger(id) || id <= 0))
      return res.status(400).json({ error: 'Invalid answers' });

    const r = await pool.query(
      'SELECT id, correct_answer FROM website_questions WHERE active=TRUE AND id=ANY($1::bigint[])',
      [ids]
    );

    if (r.rowCount !== ids.length)
      return res.status(400).json({ error: 'Some questions are unavailable' });

    const correct = new Map(r.rows.map(x => [String(x.id), x.correct_answer]));
    let score = 0;
    const saved = {};

    for (const id of ids) {
      const answer = clean(answers[id], 120);
      if (!r.rows.some(x => String(x.id) === String(id) &&
          x.correct_answer === answer)) {
        saved[id] = answer;
      } else {
        saved[id] = answer;
        score++;
      }
    }

    await pool.query(
      'INSERT INTO website_answers(player_name, answers, score, total) VALUES($1,$2::jsonb,$3,$4)',
      [name, JSON.stringify(saved), score, ids.length]
    );

    res.json({ ok: true, score, total: ids.length });
  } catch {
    res.status(500).json({ error: 'Could not save answers' });
  }
});

app.get('/api/admin/website-answers', admin, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, player_name, score, total, created_at FROM website_answers ORDER BY created_at DESC LIMIT 200'
    );
    res.json(r.rows);
  } catch {
    res.status(500).json({ error: 'Could not load results' });
  }
});
app.get('/play/:id',(q,s)=>s.sendFile(path.join(__dirname,'public','index.html')));app.get('/creator-room-7f3c',(q,s)=>s.sendFile(path.join(__dirname,'public','index.html')));app.get('*',(q,s)=>s.sendFile(path.join(__dirname,'public','index.html')));const fs = require('fs');

pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'))
  .then(() => {
    app.listen(PORT, () => console.log(`Real Friend Finder on ${PORT}`));
  })
  .catch(err => {
    console.error('Database setup failed:', err.message);
    process.exit(1);
  });
