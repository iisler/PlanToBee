import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';
import { errorCode, errorText } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import { useNotice } from '../context/NoticeContext';
import DayPage from './DayPage';
import WeekPage from './WeekPage';
import FamilyPage from './FamilyPage';
import UserMenu from '../components/UserMenu';
import { dkey, mondayOf } from '../utils/format';
import { AuditContext } from '../context/AuditContext';
import PushPrompt from '../components/PushPrompt';
import NotificationsCard from '../components/NotificationsCard';
import { syncPush } from '../utils/push';

const VIEW_KEY = 'plantobee:view';
function readPlanView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'week' ? 'week' : 'day';
  } catch {
    return 'day';
  }
}
// Bildirime dokununca uygulama "?date=YYYY-MM-DD" ile açılır: o günün Gün ekranı gösterilir.
function dateFromUrl(url) {
  try {
    const m = new URL(url, window.location.href).searchParams.get('date')?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  } catch {
    return null;
  }
}
function writePlanView(v) {
  try { localStorage.setItem(VIEW_KEY, v); } catch { /* depolama kapalı: yalnızca bu oturumda hatırlanır */ }
}

// Profil seçilmiş aile hesabının ana ekranı. Gün ve hafta planı ailenin ortak planıdır;
// her profil görür ve ekler, kayıtlarda ekleyen profil görünür.
export default function PlanShell() {
  const { user, logout, refreshMe, startSwitch } = useAuth();
  const { notify } = useNotice();
  const [family, setFamily] = useState(null);
  const [familyError, setFamilyError] = useState('');
  const [linkDate] = useState(() => dateFromUrl(window.location.href));
  const [currentDate, setCurrentDate] = useState(() => linkDate ?? new Date());
  // Son açık plan sekmesi (Gün / Hafta Planı) hatırlanır: uygulama yeniden açılınca ve Ailem'den dönünce.
  const [view, setView] = useState(() => (linkDate ? 'day' : readPlanView()));
  const lastPlanView = useRef(view === 'family' || view === 'notifications' ? 'day' : view);
  const [weekSummaries, setWeekSummaries] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const familyHeadingRef = useRef(null);

  // Ailem ad menüsünden açılınca odak sayfa başlığına taşınır (klavye ve ekran okuyucu kullanıcıları için)
  useEffect(() => {
    if (view === 'family' || view === 'notifications') familyHeadingRef.current?.focus();
  }, [view]);

  const loadFamily = useCallback(async () => {
    try {
      const r = await client.get('/family');
      setFamily(r.data);
      setFamilyError('');
      return r.data;
    } catch (err) {
      setFamilyError(errorText(err));
      return null;
    }
  }, []);

  useEffect(() => { loadFamily(); }, [loadFamily]);

  // Bildirim aboneliği seçili profile bağlanır (uygulama açılınca ve profil değişince).
  const profileId = user.profile.id;
  useEffect(() => { syncPush(); }, [profileId]);

  // Bildirimden gelen tarih adresten silinir (yenileyince yeniden o güne atlamasın); uygulama açıkken
  // dokunulan bildirim service worker'dan mesajla gelir.
  useEffect(() => {
    if (linkDate) {
      const u = new URL(window.location.href);
      u.searchParams.delete('date');
      window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash);
    }
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e) => {
      if (e.data?.type !== 'plantobee:open') return;
      const d = dateFromUrl(e.data.url);
      if (d) { setCurrentDate(d); setView('day'); }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [linkDate]);

  const myId = family?.myProfileId ?? user.profile.id;
  // Ailede başka profil de varsa plan paylaşılıyordur: kendi kayıtlarında da "Sen ekledin" yazılır.
  const showOwn = (family?.profiles ?? []).length > 1;
  const auditSettings = useMemo(() => ({ showOwn }), [showOwn]);

  // Haftalık özet (gün şeridi ve istatistikler). Hata gün sayfasında ayrıca gösterilir.
  const weekReq = useRef(0);
  const weekKey = dkey(mondayOf(currentDate));
  const loadWeek = useCallback(async () => {
    const id = ++weekReq.current;
    try {
      const res = await client.get(`/days/week/${weekKey}`);
      if (id === weekReq.current) setWeekSummaries(res.data.days);
    } catch {
      if (id === weekReq.current) setWeekSummaries([]);
    }
  }, [weekKey]);
  useEffect(() => { loadWeek(); }, [loadWeek]);

  const loadSubjects = useCallback(async () => {
    try {
      const res = await client.get('/subjects');
      setSubjects(res.data.subjects);
    } catch (err) {
      setSubjects([]);
      notify(`Ders listesi yüklenemedi: ${errorText(err)}`);
    }
  }, [notify]);
  useEffect(() => { loadSubjects(); }, [loadSubjects]);

  // Yazma reddedildi: profilin rolü değişmiş olabilir.
  const onAccessChanged = useCallback(async () => {
    await loadFamily();
    refreshMe().catch(() => {});
    loadSubjects();
  }, [loadFamily, loadSubjects, refreshMe]);

  async function addSubject(name) {
    try {
      const res = await client.post('/subjects', JSON.stringify(name), { headers: { 'Content-Type': 'application/json' } });
      setSubjects(s => [...s, res.data]);
      return true;
    } catch (err) {
      notify(errorText(err));
      if (errorCode(err) === 'plan_read_only') onAccessChanged();
      return false;
    }
  }

  async function deleteSubject(subject) {
    const snapshot = subjects;
    setSubjects(s => s.filter(x => x.id !== subject.id));
    try {
      await client.delete(`/subjects/${subject.id}`);
    } catch (err) {
      setSubjects(snapshot);
      notify(errorText(err));
      if (errorCode(err) === 'plan_read_only') onAccessChanged();
    }
  }

  function changeView(v) {
    setView(v);
    if (v === 'family') loadFamily();
    else if (v === 'notifications') { /* plan sekmesi değişmez */ }
    else {
      lastPlanView.current = v;
      writePlanView(v);
    }
  }

  return (
    <AuditContext.Provider value={auditSettings}>
      <div className="wrap">
        <header className="top">
          <h1><img className="logo" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />PlanToBee</h1>
          <div className="top-right">
            <UserMenu name={user.profile.displayName} onSwitchProfile={(family?.profiles.length ?? 2) > 1 ? startSwitch : undefined}
              onFamily={() => changeView('family')} onNotifications={() => changeView('notifications')} onLogout={logout} />
          </div>
        </header>

        <div className="viewtabs">
          <button className={view === 'day' ? 'active' : ''} aria-pressed={view === 'day'} onClick={() => changeView('day')}>Gün</button>
          <button className={view === 'week' ? 'active' : ''} aria-pressed={view === 'week'} onClick={() => changeView('week')}>Hafta Planı</button>
        </div>

        {/* Ailem ad menüsünden açılır; sekmelerde karşılığı olmadığı için nerede olunduğu başlıkla belirtilir */}
        {(view === 'family' || view === 'notifications') && (
          <div className="pagehead">
            <button className="btn-ghost small" onClick={() => changeView(lastPlanView.current)}>‹ Plana dön</button>
            <h2 ref={familyHeadingRef} tabIndex={-1}>{view === 'family' ? 'Ailem' : 'Bildirimler'}</h2>
          </div>
        )}

        {(view === 'day' || view === 'week') && <PushPrompt />}

        {familyError && !family && (
          <div className="load-error" role="alert">
            <p>Aile bilgisi yüklenemedi: {familyError}</p>
            <button className="btn" onClick={loadFamily}>Tekrar dene</button>
          </div>
        )}

        {view === 'day' && (
          <DayPage
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            weekSummaries={weekSummaries}
            myId={myId}
            subjects={subjects}
            onAddSubject={addSubject}
            onDeleteSubject={deleteSubject}
            onDataChanged={loadWeek}
            onAccessChanged={onAccessChanged}
          />
        )}
        {view === 'week' && (
          <WeekPage
            currentDate={currentDate}
            setCurrentDate={(d) => { setCurrentDate(d); changeView('day'); }}
            subjects={subjects}
            myId={myId}
            onDataChanged={loadWeek}
            onAccessChanged={onAccessChanged}
          />
        )}
        {view === 'notifications' && <NotificationsCard />}
        {view === 'family' && !(familyError && !family) && (
          <FamilyPage
            family={family}
            reloadFamily={loadFamily}
            onProfileChanged={() => refreshMe().catch(() => {})}
          />
        )}
      </div>
    </AuditContext.Provider>
  );
}
