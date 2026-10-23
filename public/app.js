const $=id=>document.getElementById(id);let draft=[],quiz=null,sessionId='',player='',adminLinks=[{label:'Instagram',url:''},{label:'Facebook',url:''},{label:'YouTube',url:''}];const ids=['home','create','editor','play','how','profile','admin'];function show(id){ids.forEach(x=>$(x).classList.toggle('hidden',x!==id));window.scrollTo({top:0,behavior:'smooth'})}document.querySelectorAll('[data-home]').forEach(b=>b.onclick=()=>show('home'));$('createBtn').onclick=()=>show('create');$('howBtn').onclick=()=>show('how');$('profileBubble').onclick=async()=>{await loadProfile();show('profile')};$('closeProfile').onclick=()=>show(location.pathname.startsWith('/play/')?'play':'home');
$('build').onclick=()=>{if(!$('creatorName').value.trim())return alert('আগে নিজের নাম লিখুন');draft=Array.from({length:Number($('count').value)},()=>({prompt:'',options:['','','',''],correctAnswer:''}));renderEditor();show('editor')};function renderEditor(){let root=$('questionEditor');root.innerHTML='';draft.forEach((q,i)=>{let c=document.createElement('div');c.className='qcard';c.innerHTML=`<h3>প্রশ্ন ${i+1}</h3><label>প্রশ্ন লিখুন<input data-prompt="${i}" maxlength="300" placeholder="আমার প্রিয় রং কী?"></label><div data-opts="${i}"></div><button class="back" data-addopt="${i}">＋ অপশন যোগ</button><label>সঠিক উত্তর<select data-correct="${i}"><option value="">উত্তর বেছে নিন</option></select></label>`;root.append(c);c.querySelector('[data-prompt]').value=q.prompt;c.querySelector('[data-prompt]').oninput=e=>q.prompt=e.target.value;let box=c.querySelector('[data-opts]');q.options.forEach((v,j)=>{let row=document.createElement('div');row.className='option';row.innerHTML=`<input data-opt="${i}-${j}" maxlength="120" placeholder="অপশন ${j+1}"><button type="button">×</button>`;row.querySelector('input').value=v;row.querySelector('input').oninput=e=>{q.options[j]=e.target.value;refreshCorrect(c,q)};row.querySelector('button').onclick=()=>{if(q.options.length<=4)return alert('কমপক্ষে ৪টি অপশন থাকতে হবে');q.options.splice(j,1);if(!q.options.includes(q.correctAnswer))q.correctAnswer='';renderEditor()};box.append(row)});c.querySelector('[data-addopt]').onclick=()=>{if(q.options.length>=12)return alert('সর্বোচ্চ ১২টি অপশন');q.options.push('');renderEditor()};let sel=c.querySelector('[data-correct]');refreshCorrect(c,q);sel.onchange=e=>q.correctAnswer=e.target.value})}function refreshCorrect(c,q){let s=c.querySelector('[data-correct]'),old=q.correctAnswer;s.innerHTML='<option value="">উত্তর বেছে নিন</option>';q.options.map(x=>x.trim()).filter(Boolean).forEach(x=>{let o=document.createElement('option');o.value=x;o.textContent=x;s.append(o)});s.value=q.options.includes(old)?old:'';s.onchange=e=>q.correctAnswer=e.target.value}
$('addQuestion').onclick=()=>{if(draft.length>=30)return alert('সর্বোচ্চ ৩০টি প্রশ্ন');draft.push({prompt:'',options:['','','',''],correctAnswer:''});renderEditor()};$('saveQuiz').onclick=async()=>{try{let r=await fetch('/api/quizzes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({creatorName:$('creatorName').value.trim(),creatorGender:$('gender').value,questions:draft})}),d=await r.json();if(!r.ok)throw Error(d.error);$('shareResult').classList.remove('hidden');$('shareResult').innerHTML=`<b>কুইজ তৈরি হয়েছে! ✨</b><p>বন্ধুদের পাঠাও:</p><a href="${d.shareUrl}">${d.shareUrl}</a><p><button id="copyLink" class="glow pale">লিংক কপি করো</button></p>`;$('copyLink').onclick=async()=>{try{await navigator.clipboard.writeText(d.shareUrl);alert('লিংক কপি হয়েছে')}catch{prompt('লিংক কপি করুন',d.shareUrl)}}}catch(e){alert(e.message)}};
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}async function loadQuiz(id){let r=await fetch('/api/quizzes/'+encodeURIComponent(id)),d=await r.json();if(!r.ok)throw Error(d.error);quiz=d;$('playTitle').textContent=d.creatorName+'-এর কুইজ 💙';$('pickList').innerHTML='';d.questions.forEach(q=>{let l=document.createElement('label');l.className='pick';l.innerHTML=`<input type="checkbox" value="${q.id}"><span>${esc(q.prompt)}</span>`;$('pickList').append(l)});$('pickList').querySelectorAll('input').forEach(x=>x.onchange=()=>{let checked=[...$('pickList').querySelectorAll('input:checked')];if(checked.length>10){x.checked=false;alert('ঠিক ১০টি বেছে নিন')}});$('startPlay').onclick=startPlay;show('play')}async function startPlay(){player=$('playerName').value.trim();if(!player)return alert('নাম লিখুন');let questionIds=[...$('pickList').querySelectorAll('input:checked')].map(x=>+x.value);if(questionIds.length!==10)return alert('ঠিক ১০টি প্রশ্ন বেছে নিন');let r=await fetch(`/api/quizzes/${quiz.id}/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerName:player,questionIds})}),d=await r.json();if(!r.ok)return alert(d.error);sessionId=d.sessionId;$('answers').innerHTML='';d.questions.forEach((q,i)=>{let c=document.createElement('div');c.className='answercard';c.innerHTML=`<b>${i+1}. ${esc(q.prompt)}</b><div></div>`;q.options.forEach(opt=>{let l=document.createElement('label');l.className='answeroption';l.innerHTML=`<input type="radio" name="q${q.id}" value="${esc(opt)}"><span>${esc(opt)}</span>`;c.querySelector('div').append(l)});$('answers').append(c)});let b=document.createElement('button');b.className='glow';b.textContent='উত্তর জমা দাও ✨';b.onclick=submitPlay;$('answers').append(b);$('startPlay').classList.add('hidden')}async function submitPlay(){let answers={};document.querySelectorAll('.answercard').forEach(c=>{let x=c.querySelector('input:checked');if(x)answers[x.name.slice(1)]=x.value});if(Object.keys(answers).length!==10)return alert('সব ১০টি প্রশ্নের উত্তর দিন');let r=await fetch('/api/sessions/'+sessionId+'/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerName:player,answers})}),d=await r.json();if(!r.ok)return alert(d.error);$('score').innerHTML=`<div class="notice"><h3>তোমার স্কোর ✦</h3><b>${d.score} / ${d.total}</b><p>খেলা শেষ! 💙</p></div>`;document.querySelector('#answers button').disabled=true}
async function loadProfile(){let r=await fetch('/api/settings'),p=await r.json();$('profileName').textContent=p.displayName||'Your Name';$('displayName').value=p.displayName||'';$('avatarUrl').value=p.avatar||'';setAvatar(p.avatar||'');$('socialLinks').innerHTML='';(p.links||[]).filter(x=>x.url).forEach(x=>{let a=document.createElement('a');a.className='social';a.href=x.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=x.label;$('socialLinks').append(a)});adminLinks=p.links||adminLinks;renderLinks()}function setAvatar(url){['profileBubble','largeAvatar'].forEach(id=>{let el=$(id);el.innerHTML='';if(url){let img=document.createElement('img');img.src=url;img.alt='Creator avatar';img.onerror=()=>el.textContent='✧';el.append(img)}else el.textContent='✧'})}function renderLinks(){let root=$('linkEditor');root.innerHTML='';adminLinks.forEach((l,i)=>{let c=document.createElement('div');c.className='qcard';c.innerHTML=`<label>Link title<input data-lab="${i}" value="${esc(l.label)}"></label><label>URL<input data-url="${i}" value="${esc(l.url)}" placeholder="https://..."></label><button class="back">Remove link</button>`;root.append(c);c.querySelector('[data-lab]').oninput=e=>adminLinks[i].label=e.target.value;c.querySelector('[data-url]').oninput=e=>adminLinks[i].url=e.target.value;c.querySelector('button').onclick=()=>{adminLinks.splice(i,1);renderLinks()}})}$('adminLogin').onsubmit=async e=>{e.preventDefault();let r=await fetch('/creator-room-7f3c/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('adminPassword').value})}),d=await r.json();if(!r.ok)return $('adminMessage').textContent=d.error;$('adminTools').classList.remove('hidden');$('adminMessage').textContent='Private session active';$('adminPassword').value='';await loadProfile()};$('addLink').onclick=()=>{if(adminLinks.length>=30)return alert('সর্বোচ্চ ৩০টি লিংক');adminLinks.push({label:'New link',url:''});renderLinks()};$('saveProfile').onclick=async()=>{let r=await fetch('/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:$('displayName').value,avatar:$('avatarUrl').value,links:adminLinks})}),d=await r.json();if(!r.ok)return alert(d.error);alert('Profile saved');await loadProfile()};$('loadQuizzes').onclick=async()=>{let r=await fetch('/api/admin/quizzes');if(!r.ok)return alert('Please log in again');let list=await r.json();$('quizAdmin').innerHTML='';list.forEach(q=>{let d=document.createElement('div');d.className='qcard';d.innerHTML=`<b>${esc(q.creator_name)}</b><p>Questions: ${q.question_count} · Submissions: ${q.submission_count}</p><button class="back">View scores</button><div></div>`;d.querySelector('button').onclick=async()=>{let rr=await fetch('/api/admin/quizzes/'+q.id+'/results'),ss=await rr.json();d.querySelector('div').textContent=ss.map(x=>`${x.player_name}: ${x.score}/${x.total}`).join(' · ')||'No scores yet'};$('quizAdmin').append(d)})};$('logout').onclick=async()=>{await fetch('/creator-room-7f3c/logout',{method:'POST'});$('adminTools').classList.add('hidden');$('adminMessage').textContent='Logged out'};$('language').onchange=()=>alert('এই starter version-এ বাংলা মূল ভাষা। অন্যান্য ভাষার সম্পূর্ণ অনুবাদ পরবর্তী সংস্করণে যুক্ত করতে হবে।');if(location.pathname==='/creator-room-7f3c')show('admin');else if(location.pathname.startsWith('/play/'))loadQuiz(location.pathname.split('/')[2]).catch(e=>{show('play');$('playTitle').textContent=e.message});else show('home');
/* Real Friend Finder - New feature handlers */
ids.push('publicMode', 'websiteMode');

$('publicModeBtn').onclick = () => {
  show('publicMode');
  loadPublicQuestions();
};

$('websiteModeBtn').onclick = () => {
  show('websiteMode');
  loadWebsiteQuestions();
};

let musicEnabled = false;
let musicObjectUrl = '';

$('musicFile').onchange = e => {
  const file = e.target.files[0];
  if (!file) return;

  if (musicObjectUrl) URL.revokeObjectURL(musicObjectUrl);
  musicObjectUrl = URL.createObjectURL(file);

  $('bgMusic').src = musicObjectUrl;
  $('bgMusic').load();
  musicEnabled = false;
  $('musicToggle').textContent = '🎵 Music চালু / বন্ধ';
};

$('musicToggle').onclick = async () => {
  const music = $('bgMusic');

  if (!music.src) {
    alert('আগে একটি Music ফাইল বেছে নিন।');
    return;
  }

  if (musicEnabled) {
    music.pause();
    musicEnabled = false;
    $('musicToggle').textContent = '🎵 Music চালু করুন';
  } else {
    try {
      await music.play();
      musicEnabled = true;
      $('musicToggle').textContent = '🔇 Music বন্ধ করুন';
    } catch {
      alert('Music চালু করা যায়নি। অন্য একটি অডিও ফাইল বেছে নিন।');
    }
  }
};

let soundContext;

document.addEventListener('click', e => {
  if (!$('soundToggle').checked) return;
  if (!e.target.closest('button')) return;

  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    soundContext ||= new AudioContextClass();

    if (soundContext.state === 'suspended') {
      soundContext.resume();
    }

    const oscillator = soundContext.createOscillator();
    const gain = soundContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 660;
    gain.gain.value = 0.035;

    oscillator.connect(gain);
    gain.connect(soundContext.destination);

    oscillator.start();
    oscillator.stop(soundContext.currentTime + 0.055);
  } catch {}
});

async function loadPublicQuestions() {
  const root = $('publicQuestionList');
  root.textContent = 'প্রশ্ন লোড হচ্ছে...';

  try {
    const r = await fetch('/api/public-questions');
    const data = await r.json();

    if (!r.ok) throw Error(data.error || 'প্রশ্ন লোড হয়নি');

    root.innerHTML = '';

    if (!data.length) {
      root.textContent = 'এখনও কোনো অনুমোদিত প্রশ্ন নেই।';
      return;
    }

    data.forEach(q => {
      const card = document.createElement('div');
      card.className = 'qcard';
      card.textContent = q.question;
      root.append(card);
    });
  } catch (e) {
    root.textContent = e.message;
  }
}

$('submitPublicQuestion').onclick = async () => {
  const name = $('publicName').value.trim() || 'Anonymous';
  const question = $('publicQuestion').value.trim();

  if (!question) return alert('প্রশ্নটি লিখুন।');

  try {
    const r = await fetch('/api/public-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, question })
    });

    const data = await r.json();
    if (!r.ok) throw Error(data.error || 'প্রশ্ন জমা হয়নি');

    $('publicMessage').textContent =
      'প্রশ্ন জমা হয়েছে। Admin অনুমোদন করলে প্রকাশিত হবে।';
    $('publicMessage').classList.remove('hidden');
    $('publicQuestion').value = '';
  } catch (e) {
    alert(e.message);
  }
};

async function loadWebsiteQuestions() {
  const root = $('websiteQuestionList');
  root.textContent = 'প্রশ্ন লোড হচ্ছে...';

  try {
    const r = await fetch('/api/website-questions');
    const data = await r.json();

    if (!r.ok) throw Error(data.error || 'প্রশ্ন লোড হয়নি');

    root.innerHTML = '';

    if (!data.length) {
      root.textContent = 'এখনও কোনো প্রশ্ন যোগ করা হয়নি।';
      return;
    }

    data.forEach(q => {
      const card = document.createElement('div');
      card.className = 'answercard';

      const title = document.createElement('b');
      title.textContent = q.question;
      card.append(title);

      const options = document.createElement('div');

      let values = q.options;
      if (typeof values === 'string') {
        try { values = JSON.parse(values); } catch { values = []; }
      }

      if (!Array.isArray(values)) values = [];

      values.forEach(opt => {
        const label = document.createElement('label');
        label.className = 'answeroption';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'website-' + q.id;
        radio.value = opt;

        const text = document.createElement('span');
        text.textContent = opt;

        label.append(radio, text);
        options.append(label);
      });

      card.append(options);
      root.append(card);
    });
  } catch (e) {
    root.textContent = e.message;
  }
}

$('submitWebsiteAnswers').onclick = async () => {
  const playerName = $('websitePlayerName').value.trim();

  if (!playerName) return alert('আপনার নাম লিখুন।');

  const answers = {};

  $('websiteQuestionList')
    .querySelectorAll('.answercard')
    .forEach(card => {
      const radio = card.querySelector('input:checked');
      if (radio) answers[radio.name.replace('website-', '')] = radio.value;
    });

  const total = $('websiteQuestionList')
    .querySelectorAll('.answercard').length;

  if (!total) return alert('এখনও কোনো প্রশ্ন নেই।');
  if (Object.keys(answers).length !== total) {
    return alert('সব প্রশ্নের উত্তর বেছে নিন।');
  }

  try {
    const r = await fetch('/api/website-answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName, answers })
    });

    const data = await r.json();
    if (!r.ok) throw Error(data.error || 'উত্তর জমা হয়নি');

    $('websiteScore').textContent =
      `আপনার স্কোর: ${data.score} / ${data.total}`;
    $('websiteScore').classList.remove('hidden');
    $('submitWebsiteAnswers').disabled = true;
  } catch (e) {
    alert(e.message);
  }
};
