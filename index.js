/* =========================================================================
   IN-MEMORY DATA STORE
   (mirrors the tables defined in schema.sql — departments, lecturers,
   courses, classrooms, time_slots, timetable_entries, users)
   NOTE: this demo keeps state in memory for the duration of the session.
   Wire the same shape up to a real backend (see schema.sql + README) to get
   permanent storage.
   ========================================================================= */
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday'];

let db = {
  departments: [],
  lecturers: [],
  courses: [],
  classrooms: [],
  timeslots: [],
  timetable: []
};
let seq = { department:0, lecturer:0, course:0, classroom:0, timeslot:0, entry:0 };
const nextId = (k) => (++seq[k]);

function seed(){
  const d = (code,name) => { const id = nextId('department'); db.departments.push({id,code,name}); return id; };
  const cs = d('CS','Computer Science');
  const ee = d('EE','Electrical Engineering');
  const ma = d('MA','Mathematics');
  const ba = d('BA','Business Administration');

  const l = (name,email,deptId,max) => { const id = nextId('lecturer'); db.lecturers.push({id,name,email,departmentId:deptId,maxHours:max}); return id; };
  const l1 = l('Dr. Muhammad Bello Ibrahim','mbibrahim@gmail.com',cs,16);
  const l2 = l('Mr. Abbas Baba yaro','saniaudu@meridian.edu',cs,14);
  const l3 = l('Mr. victor Anand','vic.anand@meridian.edu',ee,16);
  const l4 = l('Mr. Salim Mahmood','msaleem333@gmail.com',ee,12);
  const l5 = l('Dr. Sofia Emmanuel','sofiaemm@meridian.edu',ma,18);
  const l6 = l('Dr. hadiza sabiu','tunde.bakare@meridian.edu',ma,14);
  const l7 = l('Prof.Audu Sani','grace.muthoni@meridian.edu',ba,12);
  const l8 = l('Dr. Ibrahim Gumbo','james.whitfield@meridian.edu',ba,14);

  const r = (name,cap,type) => { const id = nextId('classroom'); db.classrooms.push({id,name,capacity:cap,type}); return id; };
  r('Hall A',120,'Lecture Hall'); r('Hall B',90,'Lecture Hall');
  r('Room 101',45,'Seminar Room'); r('Room 102',45,'Seminar Room');
  r('Lab 1',30,'Lab'); r('Lab 2',30,'Lab');

  DAYS.forEach(day=>{
    [['08:00','09:00'],['09:00','10:00'],['10:00','11:00'],['11:00','12:00'],['13:00','14:00'],['14:00','15:00']]
      .forEach(([s,e])=>{ const id = nextId('timeslot'); db.timeslots.push({id,day,start:s,end:e}); });
  });

  const c = (code,name,deptId,lectId,sessions,cohort) => { const id = nextId('course'); db.courses.push({id,code,name,departmentId:deptId,lecturerId:lectId,sessionsPerWeek:sessions,cohortSize:cohort}); return id; };
  c('CS101','Introduction to Programming',cs,l1,3,60);
  c('CS204','Data Structures & Algorithms',cs,l1,3,50);
  c('CS310','Database Systems',cs,l2,2,45);
  c('CS330','Operating Systems',cs,l2,2,40);
  c('EE150','Circuit Theory',ee,l3,3,35);
  c('EE220','Digital Electronics',ee,l4,2,30);
  c('EE305','Signals & Systems',ee,l3,2,28);
  c('MA101','Calculus I',ma,l5,3,80);
  c('MA210','Linear Algebra',ma,l6,2,55);
  c('MA330','Probability & Statistics',ma,l5,2,50);
  c('BA110','Principles of Management',ba,l7,2,70);
  c('BA240','Financial Accounting',ba,l8,2,60);
}
seed();

/* =========================================================================
   AUTH
   ========================================================================= */
let currentUser = null;

document.getElementById('loginForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const err = document.getElementById('loginError');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });

  if (error) {
    err.textContent = error.message;
    err.style.display = 'flex';
    submitBtn.disabled = false;
    return;
  }
  err.style.display = 'none';
  await enterApp(data.user);
  submitBtn.disabled = false;
});

async function enterApp(authUser){
  const { data: profile, error: profileErr } = await sb
    .from('users')
    .select('full_name, role')
    .eq('id', authUser.id)
    .single();

  if (profileErr) {
    console.error('Could not load profile:', profileErr.message);
  }
  const name = profile?.full_name || authUser.email;
  const role = profile?.role || 'viewer';

  currentUser = { id: authUser.id, name, role };
  document.getElementById('loginScreen').style.display='none';
  const shell = document.getElementById('appShell');
  shell.classList.add('active');
  document.getElementById('mobileTopbar').classList.add('active');
  document.getElementById('userName').textContent = name;
  document.getElementById('userRole').textContent = role;
  document.getElementById('userAvatar').textContent = name.split(' ').map(w=>w[0]).slice(0,2).join('');
  renderAll();
}

// Auto-login if a session already exists (e.g. page refresh)
sb.auth.getSession().then(({ data: { session } }) => {
  if (session?.user) enterApp(session.user);
});

document.getElementById('logoutBtn').addEventListener('click', async ()=>{
  await sb.auth.signOut();
  currentUser = null;
  document.getElementById('appShell').classList.remove('active');
  document.getElementById('mobileTopbar').classList.remove('active');
  closeMobileSidebar();
  document.getElementById('loginScreen').style.display='flex';
  document.getElementById('loginForm').reset();
});

/* =========================================================================
   NAVIGATION
   ========================================================================= */
document.querySelectorAll('.nav-btn').forEach(btn=>{
  btn.addEventListener('click', ()=> { goView(btn.dataset.view); closeMobileSidebar(); });
});
function goView(name){
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===name));
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  renderAll();
}

/* Mobile drawer controls */
function openMobileSidebar(){
  document.getElementById('sidebarEl').classList.add('mobile-open');
  document.getElementById('sidebarScrim').classList.add('active');
}
function closeMobileSidebar(){
  document.getElementById('sidebarEl').classList.remove('mobile-open');
  document.getElementById('sidebarScrim').classList.remove('active');
}
document.getElementById('hamburgerBtn').addEventListener('click', openMobileSidebar);
document.getElementById('sidebarScrim').addEventListener('click', closeMobileSidebar);

/* =========================================================================
   HELPERS
   ========================================================================= */
const $ = (sel,root=document)=>root.querySelector(sel);
const $$ = (sel,root=document)=>[...root.querySelectorAll(sel)];
const deptName = id => db.departments.find(d=>d.id==id)?.name || '—';
const deptCode = id => db.departments.find(d=>d.id==id)?.code || '—';
const lectName = id => db.lecturers.find(l=>l.id==id)?.name || '—';
const roomName = id => db.classrooms.find(r=>r.id==id)?.name || '—';
const courseOf = id => db.courses.find(c=>c.id==id);
const slotOf = id => db.timeslots.find(t=>t.id==id);
function fmtTime(t){ return t; }
function toast(msg, type='info'){
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  el.className = 'toast '+type;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, 2600);
}
function shuffle(arr){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* =========================================================================
   CLASH DETECTION
   ========================================================================= */
function checkAvailability(lecturerId, classroomId, timeslotId, excludeEntryId=null){
  for(const e of db.timetable){
    if(e.id===excludeEntryId) continue;
    if(e.timeslotId !== timeslotId) continue;
    if(e.lecturerId === lecturerId) return { ok:false, reason:`${lectName(lecturerId)} is already teaching another session in this time slot.` };
    if(e.classroomId === classroomId) return { ok:false, reason:`${roomName(classroomId)} is already booked for another session in this time slot.` };
  }
  return { ok:true };
}
function findAllClashes(){
  const clashes = [];
  const byLecturerSlot = {}, byRoomSlot = {};
  db.timetable.forEach(e=>{
    const lk = e.lecturerId+'|'+e.timeslotId;
    const rk = e.classroomId+'|'+e.timeslotId;
    (byLecturerSlot[lk] ||= []).push(e);
    (byRoomSlot[rk] ||= []).push(e);
  });
  Object.values(byLecturerSlot).filter(g=>g.length>1).forEach(g=>{
    const s = slotOf(g[0].timeslotId);
    clashes.push(`Lecturer clash — ${lectName(g[0].lecturerId)} is double-booked on ${s.day} ${s.start}: ` + g.map(e=>courseOf(e.courseId).code).join(' vs '));
  });
  Object.values(byRoomSlot).filter(g=>g.length>1).forEach(g=>{
    const s = slotOf(g[0].timeslotId);
    clashes.push(`Room clash — ${roomName(g[0].classroomId)} is double-booked on ${s.day} ${s.start}: ` + g.map(e=>courseOf(e.courseId).code).join(' vs '));
  });
  return clashes;
}

/* =========================================================================
   AUTOMATIC TIMETABLE GENERATION
   ========================================================================= */
function runGeneration(){
  db.timetable = [];
  const unscheduled = [];
  const courses = shuffle(db.courses);

  courses.forEach(course=>{
    if(!course.lecturerId){ unscheduled.push({course, missing:course.sessionsPerWeek, reason:'no lecturer assigned'}); return; }
    let placed = 0;
    let daysUsed = new Set();
    const maxAttempts = 800;
    let attempts = 0;
    while(placed < course.sessionsPerWeek && attempts < maxAttempts){
      attempts++;
      const slot = shuffle(db.timeslots)[0];
      if(daysUsed.has(slot.day) && daysUsed.size < DAYS.length) continue; // spread across days first
      const rooms = shuffle(db.classrooms.filter(r=>r.capacity >= Math.min(course.cohortSize, 9999)));
      const room = rooms[0] || db.classrooms[0];
      if(!room) break;
      const avail = checkAvailability(course.lecturerId, room.id, slot.id);
      if(avail.ok){
        db.timetable.push({ id: nextId('entry'), courseId: course.id, lecturerId: course.lecturerId, classroomId: room.id, timeslotId: slot.id });
        daysUsed.add(slot.day);
        placed++;
      }
    }
    // fallback pass allowing same-day repeats if still short
    while(placed < course.sessionsPerWeek && attempts < maxAttempts*2){
      attempts++;
      const slot = shuffle(db.timeslots)[0];
      const room = shuffle(db.classrooms)[0];
      const avail = checkAvailability(course.lecturerId, room.id, slot.id);
      if(avail.ok){
        db.timetable.push({ id: nextId('entry'), courseId: course.id, lecturerId: course.lecturerId, classroomId: room.id, timeslotId: slot.id });
        placed++;
      }
    }
    if(placed < course.sessionsPerWeek) unscheduled.push({course, missing: course.sessionsPerWeek-placed, reason:'no clash-free slot found'});
  });

  renderAll();
  const banner = document.getElementById('generationBanner');
  if(unscheduled.length===0){
    banner.innerHTML = `<div class="banner banner-ok"><span>✓</span><div><b>Timetable generated successfully</b>${db.timetable.length} sessions placed across ${db.courses.length} courses with zero clashes.</div></div>`;
    toast('Timetable generated — no clashes', 'success');
  } else {
    banner.innerHTML = `<div class="banner banner-warn"><span>⚠</span><div><b>Generated with ${unscheduled.length} unplaced session${unscheduled.length>1?'s':''}</b>${unscheduled.map(u=>`${u.course.code} — missing ${u.missing} session(s), ${u.reason}`).join('; ')}. Try adding more classrooms/time slots or adjusting sessions/week.</div></div>`;
    toast('Timetable generated with some gaps', 'error');
  }
  goView('generate');
}
function runClashScan(){
  const clashes = findAllClashes();
  const panel = document.getElementById('clashPanel');
  if(clashes.length===0){
    panel.innerHTML = `<div class="banner banner-ok" style="margin:0;"><span>✓</span><div><b>No clashes detected</b>Every lecturer and classroom is booked at most once per time slot.</div></div>`;
  } else {
    panel.innerHTML = `<div class="banner banner-warn" style="margin:0;"><span>⚠</span><div><b>${clashes.length} clash${clashes.length>1?'es':''} found</b>Resolve these from the View Timetable screen.</div></div>
    <div class="clash-list">${clashes.map(c=>`<div class="clash-item">${c}</div>`).join('')}</div>`;
  }
}

/* =========================================================================
   RENDER: DASHBOARD
   ========================================================================= */
function renderDashboard(){
  const clashes = findAllClashes();
  const stats = [
    { label:'Departments', value: db.departments.length, sub:'active academic units', accent:true },
    { label:'Lecturers', value: db.lecturers.length, sub:'teaching staff' },
    { label:'Courses', value: db.courses.length, sub:'in catalogue' },
    { label:'Classrooms', value: db.classrooms.length, sub:'bookable spaces' },
    { label:'Clashes', value: clashes.length, sub: clashes.length? 'need attention':'timetable is clean', warn:true, zero: clashes.length===0 },
  ];
  document.getElementById('statGrid').innerHTML = stats.map(s=>`
    <div class="stat-card ${s.accent?'accent':''} ${s.warn?'warn':''} ${s.zero?'zero':''}">
      <div class="stat-label">${s.label}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-sub">${s.sub}</div>
    </div>`).join('');

  const counts = {};
  db.timetable.forEach(e=>{ const dep = courseOf(e.courseId)?.departmentId; counts[dep]=(counts[dep]||0)+1; });
  const max = Math.max(1,...Object.values(counts));
  document.getElementById('dashDeptBars').innerHTML = db.departments.map(d=>{
    const v = counts[d.id]||0;
    return `<div class="bar-row"><div class="bar-label">${d.name}</div><div class="bar-track"><div class="bar-fill" style="width:${(v/max*100)||0}%"></div></div><div class="bar-val">${v}</div></div>`;
  }).join('') || `<div class="empty-state"><p>No sessions scheduled yet.</p></div>`;

  const recent = [...db.courses].slice(-5).reverse();
  document.getElementById('dashRecentCourses').innerHTML = recent.map(c=>`
    <li><span class="qname">${c.code} · ${c.name}</span><span class="qmeta">${deptCode(c.departmentId)}</span></li>`).join('') || '<li>No courses yet.</li>';
}

/* =========================================================================
   RENDER: DEPARTMENTS
   ========================================================================= */
function renderDepartments(){
  const tbody = document.getElementById('departmentsTbody');
  if(db.departments.length===0){ tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No departments yet — add one to get started.</td></tr>`; return; }
  tbody.innerHTML = db.departments.map(d=>{
    const lecCount = db.lecturers.filter(l=>l.departmentId===d.id).length;
    const courseCount = db.courses.filter(c=>c.departmentId===d.id).length;
    return `<tr>
      <td><span class="pill pill-gold">${d.code}</span></td>
      <td><strong>${d.name}</strong></td>
      <td>${lecCount}</td>
      <td>${courseCount}</td>
      <td class="row-actions">
        <button class="icon-btn" onclick="openDepartmentModal(${d.id})" title="Edit">✎</button>
        <button class="icon-btn danger" onclick="deleteDepartment(${d.id})" title="Delete">🗑</button>
      </td>
    </tr>`;
  }).join('');
}
function openDepartmentModal(id=null){
  const existing = id? db.departments.find(d=>d.id===id) : null;
  openModal(existing?'Edit Department':'Add Department', `
    <div class="field"><label>Department code</label><input id="f_code" value="${existing?.code||''}" placeholder="e.g. CS" maxlength="6"></div>
    <div class="field"><label>Department name</label><input id="f_name" value="${existing?.name||''}" placeholder="e.g. Computer Science"></div>
  `, ()=>{
    const code = $('#f_code').value.trim().toUpperCase();
    const name = $('#f_name').value.trim();
    if(!code || !name){ toast('Please fill in all fields', 'error'); return false; }
    if(existing){ existing.code=code; existing.name=name; toast('Department updated','success'); }
    else{ db.departments.push({id:nextId('department'), code, name}); toast('Department added','success'); }
    renderAll();
    return true;
  });
}
function deleteDepartment(id){
  const deps = db.lecturers.some(l=>l.departmentId===id) || db.courses.some(c=>c.departmentId===id);
  if(deps){ toast('Cannot delete — department still has lecturers or courses assigned', 'error'); return; }
  if(!confirm('Delete this department?')) return;
  db.departments = db.departments.filter(d=>d.id!==id);
  renderAll(); toast('Department deleted','success');
}

/* =========================================================================
   RENDER: LECTURERS
   ========================================================================= */
function renderLecturers(){
  const tbody = document.getElementById('lecturersTbody');
  if(db.lecturers.length===0){ tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No lecturers yet.</td></tr>`; return; }
  tbody.innerHTML = db.lecturers.map(l=>{
    const courseCount = db.courses.filter(c=>c.lecturerId===l.id).length;
    return `<tr>
      <td><strong>${l.name}</strong></td>
      <td>${l.email}</td>
      <td><span class="pill pill-blue">${deptCode(l.departmentId)}</span></td>
      <td>${l.maxHours}</td>
      <td>${courseCount}</td>
      <td class="row-actions">
        <button class="icon-btn" onclick="openLecturerModal(${l.id})" title="Edit">✎</button>
        <button class="icon-btn danger" onclick="deleteLecturer(${l.id})" title="Delete">🗑</button>
      </td>
    </tr>`;
  }).join('');
}
function deptOptions(selectedId){
  return db.departments.map(d=>`<option value="${d.id}" ${d.id==selectedId?'selected':''}>${d.name}</option>`).join('');
}
function openLecturerModal(id=null){
  const existing = id? db.lecturers.find(l=>l.id===id) : null;
  if(db.departments.length===0){ toast('Add a department first', 'error'); return; }
  openModal(existing?'Edit Lecturer':'Add Lecturer', `
    <div class="field"><label>Full name</label><input id="f_name" value="${existing?.name||''}" placeholder="e.g. Dr. Jane Doe"></div>
    <div class="field"><label>Email</label><input id="f_email" type="email" value="${existing?.email||''}" placeholder="name@meridian.edu"></div>
    <div class="field"><label>Department</label><select id="f_dept">${deptOptions(existing?.departmentId)}</select></div>
    <div class="field"><label>Max hours / week</label><input id="f_max" type="number" min="1" max="40" value="${existing?.maxHours||16}"></div>
  `, ()=>{
    const name = $('#f_name').value.trim();
    const email = $('#f_email').value.trim();
    const departmentId = Number($('#f_dept').value);
    const maxHours = Number($('#f_max').value) || 16;
    if(!name || !email){ toast('Please fill in all fields', 'error'); return false; }
    if(existing){ Object.assign(existing,{name,email,departmentId,maxHours}); toast('Lecturer updated','success'); }
    else{ db.lecturers.push({id:nextId('lecturer'), name, email, departmentId, maxHours}); toast('Lecturer added','success'); }
    renderAll();
    return true;
  });
}
function deleteLecturer(id){
  if(db.courses.some(c=>c.lecturerId===id)){ toast('Cannot delete — lecturer is assigned to a course', 'error'); return; }
  if(!confirm('Delete this lecturer?')) return;
  db.lecturers = db.lecturers.filter(l=>l.id!==id);
  renderAll(); toast('Lecturer deleted','success');
}

/* =========================================================================
   RENDER: COURSES
   ========================================================================= */
function renderCourses(){
  const tbody = document.getElementById('coursesTbody');
  if(db.courses.length===0){ tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No courses yet.</td></tr>`; return; }
  tbody.innerHTML = db.courses.map(c=>`
    <tr>
      <td><span class="pill pill-gold" style="font-family:var(--font-mono)">${c.code}</span></td>
      <td><strong>${c.name}</strong></td>
      <td><span class="pill pill-blue">${deptCode(c.departmentId)}</span></td>
      <td>${c.lecturerId? lectName(c.lecturerId) : '<span style="color:var(--red)">Unassigned</span>'}</td>
      <td>${c.sessionsPerWeek}</td>
      <td>${c.cohortSize}</td>
      <td class="row-actions">
        <button class="icon-btn" onclick="openCourseModal(${c.id})" title="Edit">✎</button>
        <button class="icon-btn danger" onclick="deleteCourse(${c.id})" title="Delete">🗑</button>
      </td>
    </tr>`).join('');
}
function lecturerOptions(selectedId, deptId){
  const pool = deptId? db.lecturers.filter(l=>l.departmentId==deptId) : db.lecturers;
  return `<option value="">— Unassigned —</option>` + pool.map(l=>`<option value="${l.id}" ${l.id==selectedId?'selected':''}>${l.name}</option>`).join('');
}
function openCourseModal(id=null){
  const existing = id? db.courses.find(c=>c.id===id) : null;
  if(db.departments.length===0){ toast('Add a department first', 'error'); return; }
  openModal(existing?'Edit Course':'Add Course', `
    <div class="field"><label>Course code</label><input id="f_code" value="${existing?.code||''}" placeholder="e.g. CS101"></div>
    <div class="field"><label>Course name</label><input id="f_name" value="${existing?.name||''}" placeholder="e.g. Introduction to Programming"></div>
    <div class="field"><label>Department</label><select id="f_dept" onchange="refreshCourseLecturerOptions()">${deptOptions(existing?.departmentId)}</select></div>
    <div class="field"><label>Lecturer</label><select id="f_lect"></select></div>
    <div class="field"><label>Sessions per week</label><input id="f_sessions" type="number" min="1" max="6" value="${existing?.sessionsPerWeek||2}"></div>
    <div class="field"><label>Cohort size</label><input id="f_cohort" type="number" min="1" value="${existing?.cohortSize||40}"></div>
  `, ()=>{
    const code = $('#f_code').value.trim().toUpperCase();
    const name = $('#f_name').value.trim();
    const departmentId = Number($('#f_dept').value);
    const lecturerId = $('#f_lect').value? Number($('#f_lect').value) : null;
    const sessionsPerWeek = Number($('#f_sessions').value) || 1;
    const cohortSize = Number($('#f_cohort').value) || 1;
    if(!code || !name){ toast('Please fill in all fields', 'error'); return false; }
    if(existing){ Object.assign(existing,{code,name,departmentId,lecturerId,sessionsPerWeek,cohortSize}); toast('Course updated','success'); }
    else{ db.courses.push({id:nextId('course'), code, name, departmentId, lecturerId, sessionsPerWeek, cohortSize}); toast('Course added','success'); }
    renderAll();
    return true;
  });
  refreshCourseLecturerOptions(existing?.lecturerId);
}
function refreshCourseLecturerOptions(selectedId){
  const deptId = Number($('#f_dept').value);
  $('#f_lect').innerHTML = lecturerOptions(selectedId, deptId);
}
function deleteCourse(id){
  if(db.timetable.some(e=>e.courseId===id)){ toast('Cannot delete — course has scheduled sessions. Regenerate the timetable after removing it.', 'error'); }
  if(!confirm('Delete this course? Any scheduled sessions for it will also be removed.')) return;
  db.courses = db.courses.filter(c=>c.id!==id);
  db.timetable = db.timetable.filter(e=>e.courseId!==id);
  renderAll(); toast('Course deleted','success');
}

/* =========================================================================
   RENDER: CLASSROOMS
   ========================================================================= */
function renderClassrooms(){
  const tbody = document.getElementById('classroomsTbody');
  if(db.classrooms.length===0){ tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No classrooms yet.</td></tr>`; return; }
  tbody.innerHTML = db.classrooms.map(r=>{
    const used = db.timetable.filter(e=>e.classroomId===r.id).length;
    return `<tr>
      <td><strong>${r.name}</strong></td>
      <td><span class="pill pill-blue">${r.type}</span></td>
      <td>${r.capacity}</td>
      <td>${used} / ${db.timeslots.length}</td>
      <td class="row-actions">
        <button class="icon-btn" onclick="openClassroomModal(${r.id})" title="Edit">✎</button>
        <button class="icon-btn danger" onclick="deleteClassroom(${r.id})" title="Delete">🗑</button>
      </td>
    </tr>`;
  }).join('');
}
function openClassroomModal(id=null){
  const existing = id? db.classrooms.find(r=>r.id===id) : null;
  openModal(existing?'Edit Classroom':'Add Classroom', `
    <div class="field"><label>Room name</label><input id="f_name" value="${existing?.name||''}" placeholder="e.g. Room 103"></div>
    <div class="field"><label>Type</label>
      <select id="f_type">
        ${['Lecture Hall','Seminar Room','Lab'].map(t=>`<option ${existing?.type===t?'selected':''}>${t}</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Capacity</label><input id="f_cap" type="number" min="1" value="${existing?.capacity||40}"></div>
  `, ()=>{
    const name = $('#f_name').value.trim();
    const type = $('#f_type').value;
    const capacity = Number($('#f_cap').value)||1;
    if(!name){ toast('Please enter a room name', 'error'); return false; }
    if(existing){ Object.assign(existing,{name,type,capacity}); toast('Classroom updated','success'); }
    else{ db.classrooms.push({id:nextId('classroom'), name, type, capacity}); toast('Classroom added','success'); }
    renderAll();
    return true;
  });
}
function deleteClassroom(id){
  if(db.timetable.some(e=>e.classroomId===id)){ toast('Cannot delete — classroom has scheduled sessions', 'error'); return; }
  if(!confirm('Delete this classroom?')) return;
  db.classrooms = db.classrooms.filter(r=>r.id!==id);
  renderAll(); toast('Classroom deleted','success');
}

/* =========================================================================
   RENDER: TIME SLOTS
   ========================================================================= */
function renderTimeslots(){
  const tbody = document.getElementById('timeslotsTbody');
  if(db.timeslots.length===0){ tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No time slots yet.</td></tr>`; return; }
  const sorted = [...db.timeslots].sort((a,b)=> DAYS.indexOf(a.day)-DAYS.indexOf(b.day) || a.start.localeCompare(b.start));
  tbody.innerHTML = sorted.map(t=>{
    const used = db.timetable.filter(e=>e.timeslotId===t.id).length;
    return `<tr>
      <td>${t.day}</td>
      <td style="font-family:var(--font-mono)">${t.start}</td>
      <td style="font-family:var(--font-mono)">${t.end}</td>
      <td>${used} session${used!==1?'s':''}</td>
      <td class="row-actions">
        <button class="icon-btn" onclick="openTimeslotModal(${t.id})" title="Edit">✎</button>
        <button class="icon-btn danger" onclick="deleteTimeslot(${t.id})" title="Delete">🗑</button>
      </td>
    </tr>`;
  }).join('');
}
function openTimeslotModal(id=null){
  const existing = id? db.timeslots.find(t=>t.id===id) : null;
  openModal(existing?'Edit Time Slot':'Add Time Slot', `
    <div class="field"><label>Day</label><select id="f_day">${DAYS.map(d=>`<option ${existing?.day===d?'selected':''}>${d}</option>`).join('')}</select></div>
    <div class="field"><label>Start time</label><input id="f_start" type="time" value="${existing?.start||'08:00'}"></div>
    <div class="field"><label>End time</label><input id="f_end" type="time" value="${existing?.end||'09:00'}"></div>
  `, ()=>{
    const day = $('#f_day').value;
    const start = $('#f_start').value;
    const end = $('#f_end').value;
    if(!start || !end || start>=end){ toast('End time must be after start time', 'error'); return false; }
    const dupe = db.timeslots.some(t=>t.day===day && t.start===start && t.end===end && t.id!==id);
    if(dupe){ toast('This exact time slot already exists', 'error'); return false; }
    if(existing){ Object.assign(existing,{day,start,end}); toast('Time slot updated','success'); }
    else{ db.timeslots.push({id:nextId('timeslot'), day, start, end}); toast('Time slot added','success'); }
    renderAll();
    return true;
  });
}
function deleteTimeslot(id){
  if(db.timetable.some(e=>e.timeslotId===id)){ toast('Cannot delete — time slot has scheduled sessions', 'error'); return; }
  if(!confirm('Delete this time slot?')) return;
  db.timeslots = db.timeslots.filter(t=>t.id!==id);
  renderAll(); toast('Time slot deleted','success');
}

/* =========================================================================
   RENDER: VIEW TIMETABLE (grid) + EDIT
   ========================================================================= */
function populateTimetableFilters(){
  const dSel = document.getElementById('ttFilterDept');
  const lSel = document.getElementById('ttFilterLecturer');
  const rSel = document.getElementById('ttFilterRoom');
  const keepD = dSel.value, keepL = lSel.value, keepR = rSel.value;
  dSel.innerHTML = '<option value="">All departments</option>' + db.departments.map(d=>`<option value="${d.id}">${d.name}</option>`).join('');
  lSel.innerHTML = '<option value="">All lecturers</option>' + db.lecturers.map(l=>`<option value="${l.id}">${l.name}</option>`).join('');
  rSel.innerHTML = '<option value="">All classrooms</option>' + db.classrooms.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  dSel.value = keepD; lSel.value = keepL; rSel.value = keepR;
}
function deptColorClass(deptId){
  const idx = db.departments.findIndex(d=>d.id===deptId);
  return 'dept-' + (idx>=0? idx%5 : 0);
}
function renderTimetableGrid(){
  const host = document.getElementById('ttGridHost');
  const fDept = document.getElementById('ttFilterDept').value;
  const fLect = document.getElementById('ttFilterLecturer').value;
  const fRoom = document.getElementById('ttFilterRoom').value;

  document.getElementById('ttLegend').innerHTML = db.departments.map((d,i)=>
    `<div class="lg-item"><span class="sw dept-${i%5}" style="background:var(--gold)"></span>${d.name}</div>`
  ).map((html,i)=>html.replace('background:var(--gold)', `border:1px solid transparent`)).join('') ||'';
  // simpler legend swatches with correct colors
  document.getElementById('ttLegend').innerHTML = db.departments.map((d,i)=>
    `<div class="lg-item"><span class="sw" style="background:${['#C08A28','#3A5F8A','#3F7D5C','#7A4E96','#3A7E7E'][i%5]}"></span>${d.name}</div>`
  ).join('');

  if(db.timetable.length===0){
    host.innerHTML = `<div class="empty-state"><div class="glyph">▧</div><h4>No timetable generated yet</h4><p>Head to "Generate & Clashes" and click Generate Timetable to build the schedule automatically.</p></div>`;
    return;
  }

  const periods = [...new Set(db.timeslots.map(t=>t.start+'|'+t.end))].sort();
  const clashSet = new Set();
  findAllClashes(); // (visual clash highlighting uses direct pair check below)

  let html = `<div class="timetable-grid">`;
  html += `<div class="tg-head" style="background:var(--paper);color:var(--slate)"></div>`;
  DAYS.forEach(d=> html += `<div class="tg-head">${d}</div>`);

  periods.forEach(p=>{
    const [start,end] = p.split('|');
    html += `<div class="tg-time">${start}<br>–<br>${end}</div>`;
    DAYS.forEach(day=>{
      const slot = db.timeslots.find(t=>t.day===day && t.start===start && t.end===end);
      let entries = slot? db.timetable.filter(e=>e.timeslotId===slot.id) : [];
      if(fDept) entries = entries.filter(e=> courseOf(e.courseId).departmentId==fDept);
      if(fLect) entries = entries.filter(e=> e.lecturerId==fLect);
      if(fRoom) entries = entries.filter(e=> e.classroomId==fRoom);
      html += `<div class="tg-cell">`;
      entries.forEach(e=>{
        const course = courseOf(e.courseId);
        const isClash = db.timetable.some(o=> o.id!==e.id && o.timeslotId===e.timeslotId && (o.lecturerId===e.lecturerId || o.classroomId===e.classroomId));
        html += `<div class="tt-block ${isClash?'clash':deptColorClass(course.departmentId)}" onclick="openEditEntry(${e.id})" title="Click to edit">
          <span class="code">${course.code}</span>
          <span class="meta">${lectName(e.lecturerId)}</span>
          <span class="meta">${roomName(e.classroomId)}</span>
        </div>`;
      });
      html += `</div>`;
    });
  });
  html += `</div>`;
  host.innerHTML = html;
}

function openEditEntry(entryId){
  const entry = db.timetable.find(e=>e.id===entryId);
  if(!entry) return;
  const course = courseOf(entry.courseId);
  openModal('Edit Session — '+course.code, `
    <div class="field"><label>Course</label><input value="${course.code} — ${course.name}" disabled style="background:var(--paper);color:var(--slate)"></div>
    <div class="field"><label>Lecturer</label><select id="f_lect">${db.lecturers.map(l=>`<option value="${l.id}" ${l.id===entry.lecturerId?'selected':''}>${l.name}</option>`).join('')}</select></div>
    <div class="field"><label>Classroom</label><select id="f_room">${db.classrooms.map(r=>`<option value="${r.id}" ${r.id===entry.classroomId?'selected':''}>${r.name} (${r.capacity})</option>`).join('')}</select></div>
    <div class="field"><label>Time slot</label><select id="f_slot">${[...db.timeslots].sort((a,b)=>DAYS.indexOf(a.day)-DAYS.indexOf(b.day)||a.start.localeCompare(b.start)).map(t=>`<option value="${t.id}" ${t.id===entry.timeslotId?'selected':''}>${t.day} ${t.start}–${t.end}</option>`).join('')}</select></div>
    <div class="field-error" id="editErr" style="display:block;"></div>
  `, ()=>{
    const lecturerId = Number($('#f_lect').value);
    const classroomId = Number($('#f_room').value);
    const timeslotId = Number($('#f_slot').value);
    const avail = checkAvailability(lecturerId, classroomId, timeslotId, entry.id);
    if(!avail.ok){ toast(avail.reason, 'error'); return false; }
    Object.assign(entry, {lecturerId, classroomId, timeslotId});
    toast('Session updated — no clashes', 'success');
    renderAll();
    return true;
  }, {extraFoot: `<button class="btn btn-danger" style="margin-right:auto" onclick="deleteEntry(${entry.id})">Remove session</button>`});
}
function deleteEntry(id){
  if(!confirm('Remove this session from the timetable?')) return;
  db.timetable = db.timetable.filter(e=>e.id!==id);
  closeModal();
  renderAll();
  toast('Session removed','success');
}

/* =========================================================================
   RENDER: SEARCH
   ========================================================================= */
function renderSearchResults(){
  const q = (document.getElementById('searchInput').value||'').toLowerCase().trim();
  const tbody = document.getElementById('searchTbody');
  let rows = db.timetable.map(e=>{
    const course = courseOf(e.courseId);
    const slot = slotOf(e.timeslotId);
    return { e, course, slot, lecturer: lectName(e.lecturerId), room: roomName(e.classroomId) };
  });
  if(q){
    rows = rows.filter(r =>
      r.course.code.toLowerCase().includes(q) ||
      r.course.name.toLowerCase().includes(q) ||
      r.lecturer.toLowerCase().includes(q) ||
      r.room.toLowerCase().includes(q) ||
      r.slot.day.toLowerCase().includes(q)
    );
  }
  rows.sort((a,b)=> DAYS.indexOf(a.slot.day)-DAYS.indexOf(b.slot.day) || a.slot.start.localeCompare(b.slot.start));

  if(rows.length===0){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">${db.timetable.length===0? 'No timetable generated yet.' : 'No sessions match your search.'}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r=>`
    <tr>
      <td><strong>${r.course.code}</strong> — ${r.course.name}</td>
      <td>${r.lecturer}</td>
      <td>${r.room}</td>
      <td>${r.slot.day}</td>
      <td style="font-family:var(--font-mono)">${r.slot.start}–${r.slot.end}</td>
      <td><button class="icon-btn" onclick="openEditEntry(${r.e.id})" title="Edit">✎</button></td>
    </tr>`).join('');
}

/* =========================================================================
   RENDER: REPORTS
   ========================================================================= */
function renderReports(){
  const lectHtml = db.lecturers.map(l=>{
    const n = db.timetable.filter(e=>e.lecturerId===l.id).length;
    const pct = Math.min(100, Math.round((n/(l.maxHours||1))*100));
    return `<div class="bar-row"><div class="bar-label">${l.name}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${pct>90?'var(--red)':'var(--gold)'}"></div></div><div class="bar-val">${n}/${l.maxHours}</div></div>`;
  }).join('') || '<p style="color:var(--slate-2);font-size:13px">No lecturers yet.</p>';
  document.getElementById('reportLecturers').innerHTML = lectHtml;

  const total = db.timeslots.length || 1;
  const roomHtml = db.classrooms.map(r=>{
    const n = db.timetable.filter(e=>e.classroomId===r.id).length;
    const pct = Math.round((n/total)*100);
    return `<div class="bar-row"><div class="bar-label">${r.name}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><div class="bar-val">${pct}%</div></div>`;
  }).join('') || '<p style="color:var(--slate-2);font-size:13px">No classrooms yet.</p>';
  document.getElementById('reportRooms').innerHTML = roomHtml;

  const deptCounts = {};
  db.timetable.forEach(e=>{ const id = courseOf(e.courseId).departmentId; deptCounts[id]=(deptCounts[id]||0)+1; });
  const maxD = Math.max(1,...Object.values(deptCounts));
  const deptHtml = db.departments.map(d=>{
    const n = deptCounts[d.id]||0;
    return `<div class="bar-row"><div class="bar-label">${d.name}</div><div class="bar-track"><div class="bar-fill" style="width:${(n/maxD*100)||0}%"></div></div><div class="bar-val">${n}</div></div>`;
  }).join('') || '<p style="color:var(--slate-2);font-size:13px">No departments yet.</p>';
  document.getElementById('reportDepts').innerHTML = deptHtml;

  const clashes = findAllClashes();
  document.getElementById('reportSummary').innerHTML = `
    <li><span class="qname">Total sessions scheduled</span><span class="qmeta">${db.timetable.length}</span></li>
    <li><span class="qname">Total course catalogue</span><span class="qmeta">${db.courses.length}</span></li>
    <li><span class="qname">Time slots available</span><span class="qmeta">${db.timeslots.length}</span></li>
    <li><span class="qname">Detected clashes</span><span class="qmeta">${clashes.length}</span></li>
    <li><span class="qname">Unassigned courses</span><span class="qmeta">${db.courses.filter(c=>!c.lecturerId).length}</span></li>
  `;
}

/* =========================================================================
   EXPORT / PRINT
   ========================================================================= */
function exportTimetableCSV(){
  if(db.timetable.length===0){ toast('Nothing to export yet','error'); return; }
  const rows = [['Course Code','Course Name','Department','Lecturer','Classroom','Day','Start','End']];
  [...db.timetable].sort((a,b)=>DAYS.indexOf(slotOf(a.timeslotId).day)-DAYS.indexOf(slotOf(b.timeslotId).day)).forEach(e=>{
    const c = courseOf(e.courseId); const s = slotOf(e.timeslotId);
    rows.push([c.code,c.name,deptName(c.departmentId),lectName(e.lecturerId),roomName(e.classroomId),s.day,s.start,s.end]);
  });
  const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadBlob(csv, 'timetable.csv', 'text/csv');
  toast('Timetable exported as CSV','success');
}
function exportStateJSON(){
  downloadBlob(JSON.stringify(db, null, 2), 'timetable-data.json', 'application/json');
  toast('Full dataset exported as JSON','success');
}
function downloadBlob(content, filename, mime){
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* =========================================================================
   MODAL ENGINE
   ========================================================================= */
let modalSaveHandler = null;
function openModal(title, bodyHtml, onSave, opts={}){
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  const foot = document.querySelector('.modal-foot');
  foot.querySelectorAll('.extra-foot').forEach(n=>n.remove());
  if(opts.extraFoot){
    const wrap = document.createElement('div');
    wrap.className='extra-foot';
    wrap.style.display='contents';
    wrap.innerHTML = opts.extraFoot;
    foot.prepend(wrap);
  }
  modalSaveHandler = onSave;
  document.getElementById('modalBackdrop').classList.add('active');
}
function closeModal(){
  document.getElementById('modalBackdrop').classList.remove('active');
  modalSaveHandler = null;
}
document.getElementById('modalSaveBtn').addEventListener('click', ()=>{
  if(modalSaveHandler && modalSaveHandler()!==false) closeModal();
});
document.getElementById('modalBackdrop').addEventListener('click', (e)=>{
  if(e.target.id==='modalBackdrop') closeModal();
});

/* =========================================================================
   MASTER RENDER
   ========================================================================= */
function renderAll(){
  if(!currentUser) return;
  renderDashboard();
  renderDepartments();
  renderLecturers();
  renderCourses();
  renderClassrooms();
  renderTimeslots();
  populateTimetableFilters();
  renderTimetableGrid();
  renderSearchResults();
  renderReports();
  runClashScan();
}
