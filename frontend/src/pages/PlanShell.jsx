import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';
import { errorCode, errorText } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import { useNotice } from '../context/NoticeContext';
import DayPage from './DayPage';
import FamilyPage from './FamilyPage';
import UserMenu from '../components/UserMenu';
import { addDays, dkey, mondayOf } from '../utils/format';
import { AuditContext } from '../context/AuditContext';
import PushPrompt from '../components/PushPrompt';
import NotificationsCard from '../components/NotificationsCard';
import { syncPush } from '../utils/push';

// Önceki sürümlerin görünüm tercihleri (Gün / Hafta Planı sekmesi, Tablo / Liste). Artık okunmaz; silinir.
function dropLegacyPrefs() {
  try {
    localStorage.removeItem('plantobee:view');
    localStorage.removeItem('weekMode');
  } catch { /* depolama kapalı */ }
}
// Bildirime dokununca uygulama "?date=YYYY-MM-DD" ile açılır: o gün seçilir. Geçersiz tarih (2026-13-40) yok sayılır.
function dateFromUrl(url) {
  try {
    const m = new URL(url, window.location.href).searchParams.get('date')?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
  } catch {
    return null;
  }
}
// GET /days/week/{pzt}/details cevabı tarihe göre 7 güne eşlenir (eksik gün boş listelerle)
function weekDaysFrom(data, mondayKey) {
  const [y, mo, d] = mondayKey.split('-').map(Number);
  const mon = new Date(y, mo - 1, d);
  const byDate = new Map((data?.days ?? []).map(x => [x.date, x]));
  return Array.from({ length: 7 }, (_, i) => {
    const k = dkey(addDays(mon, i));
    return byDate.get(k) ?? { date: k, studyEntries: [], events: [] };
  });
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
  // Görünüm: 'plan' (tek ekran plan) | 'family' (Ailem) | 'notifications' (Bildirimler)
  const [view, setView] = useState('plan');
  // Seçili haftanın ayrıntısı: { key: pazartesi, days: 7 DayDto | null, error }
  const [week, setWeek] = useState({ key: '', days: null, error: '' });
  // Bildirimden gün açılınca artar: açık Hafta paneli ve ⋯ menüleri kapanır
  const [layerReset, setLayerReset] = useState(0);
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
  useEffect(() => { dropLegacyPrefs(); }, []);

  // Bildirim aboneliği seçili profile bağlanır (uygulama açılınca ve profil değişince).
  const profileId = user.profile.id;
  useEffect(() => { syncPush(); }, [profileId]);

  // Bildirimden gelen tarih adresten silinir (yenileyince yeniden o güne atlamasın); uygulama açıkken
  // dokunulan bildirim service worker'dan mesajla gelir.
  useEffect(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.has('date')) {
      // Geçersiz tarih de silinir (bugün açılır, adreste kalmaz)
      u.searchParams.delete('date');
      window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash);
    }
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e) => {
      if (e.data?.type !== 'plantobee:open') return;
      const d = dateFromUrl(e.data.url);
      if (!d) return;
      // Önce açık katman kapanır, sonra plan görünümünde o gün seçilir (şerit o günün haftasını gösterir)
      setLayerReset(n => n + 1);
      setView('plan');
      setCurrentDate(d);
      window.scrollTo(0, 0);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  const myId = family?.myProfileId ?? user.profile.id;
  // Bildirimler yalnızca ailede başka profil varsa anlamlı (tek başına kullanımda bildirim gönderecek kimse yok).
  const hasOthers = (family?.profiles ?? []).length > 1;
  // Çocuk profilinde satırlarda "kim ekledi" baş harfi gösterilmez
  const hideInitials = user.profile.role === 'Child';
  const auditSettings = useMemo(() => ({ hideInitials }), [hideInitials]);

  // Seçili haftanın ayrıntısı (şerit ve Hafta paneli), tek istek. Her ekleme, değiştirme, silme ve durum
  // değişikliğinden sonra yeniden çekilir. Yalnızca en son isteğin yanıtı yazılır: ‹ › hızlıca basılınca önceki
  // haftanın geç gelen yanıtı ekrandaki haftanın üzerine yazılmaz; gösterilen veri her zaman seçili haftanındır.
  const weekReq = useRef(0);
  const weekKey = dkey(mondayOf(currentDate));
  const weekKeyRef = useRef(weekKey);
  const loadWeek = useCallback(async () => {
    const key = weekKeyRef.current;
    const id = ++weekReq.current;
    try {
      const res = await client.get(`/days/week/${key}/details`);
      if (id === weekReq.current) setWeek({ key, days: weekDaysFrom(res.data, key), error: '' });
    } catch (err) {
      // Aynı haftanın önceki verisi varsa korunur; yoksa şerit boş sayaçlarla kalır, panel "Tekrar dene" gösterir
      if (id === weekReq.current) setWeek(w => ({ key, days: w.key === key ? w.days : null, error: errorText(err) }));
    }
  }, []);
  useEffect(() => { weekKeyRef.current = weekKey; loadWeek(); }, [weekKey, loadWeek]);
  // Gün kartındaki iyimser değişiklik (silme, durum) haftalık veriye de uygulanır: şerit ve panel beklemeden güncellenir,
  // "Geri al" ya da hata olursa aynı yoldan eski haline döner. Sonraki yenileme sunucudaki veriyle değiştirir.
  const replaceWeekDay = useCallback((day) => {
    setWeek(w => (w.days && w.days.some(d => d.date === day.date)
      ? { ...w, days: w.days.map(d => (d.date === day.date ? day : d)) } : w));
  }, []);
  const weekDays = week.key === weekKey ? week.days : null;
  const weekError = week.key === weekKey ? week.error : '';

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
  }

  return (
    <AuditContext.Provider value={auditSettings}>
      <div className="wrap">
        <header className="top">
          <h1><img className="logo" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />PlanToBee</h1>
          <div className="top-right">
            <UserMenu name={user.profile.displayName} onSwitchProfile={(family?.profiles.length ?? 2) > 1 ? startSwitch : undefined}
              onFamily={() => changeView('family')} onNotifications={hasOthers ? () => changeView('notifications') : undefined} onLogout={logout} />
          </div>
        </header>

        {/* Ailem ve Bildirimler ad menüsünden açılır; nerede olunduğu başlıkla belirtilir */}
        {(view === 'family' || view === 'notifications') && (
          <div className="pagehead">
            <button className="btn-ghost small" onClick={() => changeView('plan')}>‹ Plana dön</button>
            <h2 ref={familyHeadingRef} tabIndex={-1}>{view === 'family' ? 'Ailem' : 'Bildirimler'}</h2>
          </div>
        )}

        {view === 'plan' && hasOthers && <PushPrompt />}

        {familyError && !family && (
          <div className="load-error" role="alert">
            <p>Aile bilgisi yüklenemedi: {familyError}</p>
            <button className="btn" onClick={loadFamily}>Tekrar dene</button>
          </div>
        )}

        {view === 'plan' && (
          <DayPage
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            weekDays={weekDays}
            weekError={weekError}
            onRetryWeek={loadWeek}
            onDayChanged={replaceWeekDay}
            layerReset={layerReset}
            myId={myId}
            subjects={subjects}
            onAddSubject={addSubject}
            onDeleteSubject={deleteSubject}
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
