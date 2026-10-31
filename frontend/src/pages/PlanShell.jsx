import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';
import { errorCode, errorText } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import { useNotice } from '../context/NoticeContext';
import DayPage from './DayPage';
import FamilyPage from './FamilyPage';
import UserMenu from '../components/UserMenu';
import { addDays, dkey, mondayOf } from '../utils/format';
import { parseKey } from '../utils/recurrence';
import { AuditContext } from '../context/AuditContext';
import PushPrompt from '../components/PushPrompt';
import NotificationsCard from '../components/NotificationsCard';
import DeleteAccountForm from '../components/DeleteAccountForm';
import { markPromptReady, promptReady, syncPush } from '../utils/push';

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
// Hafta haritasına bir hafta yazar (entry: eski kayıttan yenisi). Yalnızca seçili hafta (center) ve iki komşusu tutulur;
// uzaktaki haftanın geç gelen yanıtı yazılmaz.
function putWeek(weeks, key, center, entry) {
  const keep = [-7, 0, 7].map(n => dkey(addDays(parseKey(center), n)));
  if (!keep.includes(key)) return weeks;
  const next = Object.fromEntries(Object.entries(weeks).filter(([k]) => keep.includes(k)));
  next[key] = entry(weeks[key]);
  return next;
}

// Profil seçilmiş aile hesabının ana ekranı. Gün ve hafta planı ailenin ortak planıdır;
// her profil görür ve ekler, kayıtlarda ekleyen profil görünür.
export default function PlanShell() {
  const { user, logout, accountDeleted, refreshMe, startSwitch } = useAuth();
  const { notify } = useNotice();
  const [family, setFamily] = useState(null);
  const [familyError, setFamilyError] = useState('');
  const [linkDate] = useState(() => dateFromUrl(window.location.href));
  const [currentDate, setCurrentDate] = useState(() => linkDate ?? new Date());
  // Görünüm: 'plan' (tek ekran plan) | 'family' (Ailem) | 'notifications' (Bildirimler)
  const [view, setView] = useState('plan');
  // Gün ekranının bölümü (Görev 10): 'bee' (Ajanda) | 'todo' (Dersler) | 'plan' (Aktiviteler). Açılışta ve bildirimden
  // gelince herkes için Bee; oturum içinde (gün değişince, Ailem'e gidip dönünce) korunur, kalıcı saklanmaz.
  const [section, setSection] = useState('bee');
  // Hafta ayrıntıları pazartesiye göre: { [pzt]: { days: 7 DayDto | null, error } }; seçili hafta ve iki komşusu
  const [weeks, setWeeks] = useState({});
  // Bildirimden gün açılınca artar: açık Hafta paneli ve ⋯ menüleri kapanır
  const [layerReset, setLayerReset] = useState(0);
  const [subjects, setSubjects] = useState([]);
  const familyHeadingRef = useRef(null);

  // Ailem ad menüsünden açılınca odak sayfa başlığına taşınır (klavye ve ekran okuyucu kullanıcıları için)
  useEffect(() => {
    if (view === 'family' || view === 'notifications' || view === 'delete-account') familyHeadingRef.current?.focus();
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
  // Bildirim izni bandı bu cihazda ilk kayıt eklendikten sonra önerilir: kullanıcı önce uygulamanın işini görür
  const [pushReady, setPushReady] = useState(promptReady);
  const onAdded = useCallback(() => { markPromptReady(); setPushReady(true); }, []);

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
      setSection('bee');
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

  // Seçili haftanın ayrıntısı (şerit, Hafta paneli ve gün kartı), hafta başına tek istek. Her ekleme, değiştirme, silme ve
  // durum değişikliğinden sonra yeniden çekilir. Bir haftaya yalnızca onun en son isteğinin yanıtı yazılır; seçili haftadan
  // uzaklaşılmışsa yanıt atılır. Seçili hafta yüklenince önceki ve sonraki hafta da sessizce çekilir: gün kaydırırken (Bee)
  // ya da ‹ › ile hafta değişince yeni hafta beklemeden açılır, ardından sunucudan yenilenir.
  const weekReq = useRef({});
  const weekKey = dkey(mondayOf(currentDate));
  const weekKeyRef = useRef(weekKey);
  const fetchWeek = useCallback(async (key, quiet = false) => {
    const id = (weekReq.current[key] ?? 0) + 1;
    weekReq.current[key] = id;
    try {
      const res = await client.get(`/days/week/${key}/details`);
      if (weekReq.current[key] === id) setWeeks(w => putWeek(w, key, weekKeyRef.current, () => ({ days: weekDaysFrom(res.data, key), error: '' })));
    } catch (err) {
      // Aynı haftanın önceki verisi varsa korunur; yoksa şerit boş sayaçlarla kalır, panel "Tekrar dene" gösterir.
      // Komşu haftanın (quiet) hatası yazılmaz: o haftaya geçilince yeniden istenir.
      if (weekReq.current[key] === id && !quiet) {
        setWeeks(w => putWeek(w, key, weekKeyRef.current, (old) => ({ days: old?.days ?? null, error: errorText(err) })));
      }
    }
  }, []);
  const loadWeek = useCallback(() => fetchWeek(weekKeyRef.current), [fetchWeek]);
  useEffect(() => {
    weekKeyRef.current = weekKey;
    loadWeek().then(() => {
      if (weekKeyRef.current !== weekKey) return;
      const mon = parseKey(weekKey);
      fetchWeek(dkey(addDays(mon, 7)), true);
      fetchWeek(dkey(addDays(mon, -7)), true);
    });
  }, [weekKey, loadWeek, fetchWeek]);
  // Gün kartındaki iyimser değişiklik (silme, durum) haftalık veriye de uygulanır: şerit ve panel beklemeden güncellenir,
  // "Geri al" ya da hata olursa aynı yoldan eski haline döner. Sonraki yenileme sunucudaki veriyle değiştirir.
  const replaceWeekDay = useCallback((day) => {
    setWeeks(w => {
      const key = Object.keys(w).find(k => w[k].days?.some(d => d.date === day.date));
      return key ? { ...w, [key]: { ...w[key], days: w[key].days.map(d => (d.date === day.date ? day : d)) } } : w;
    });
  }, []);
  const weekDays = weeks[weekKey]?.days ?? null;
  const weekError = weeks[weekKey]?.error ?? '';

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

  // Hesap silme sayfasından Vazgeç: Ailem'e dönülür ve odak silme düğmesine verilir.
  function cancelDelete() {
    changeView('family');
    setTimeout(() => document.getElementById('delete-account-open')?.focus(), 0);
  }

  // Plan ekranında başlık siyah hafta alanının içinde durur (DayPage), diğer sayfalarda en üstte
  const header = (
    <header className="top">
      <h1><img className="logo" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />PlanToBee</h1>
      <div className="top-right">
        <UserMenu name={user.profile.displayName} onSwitchProfile={(family?.profiles.length ?? 2) > 1 ? startSwitch : undefined}
          onFamily={() => changeView('family')} onNotifications={hasOthers ? () => changeView('notifications') : undefined} onLogout={logout} />
      </div>
    </header>
  );

  return (
    <AuditContext.Provider value={auditSettings}>
      <div className="wrap">
        {view !== 'plan' && header}

        {/* Ailem ve Bildirimler ad menüsünden açılır; nerede olunduğu başlıkla belirtilir */}
        {(view === 'family' || view === 'notifications') && (
          <div className="pagehead">
            <button className="btn-ghost small" onClick={() => changeView('plan')}>‹ Plana dön</button>
            <h2 ref={familyHeadingRef} tabIndex={-1}>{view === 'family' ? 'Ailem' : 'Bildirimler'}</h2>
          </div>
        )}
        {view === 'delete-account' && (
          <div className="pagehead">
            <button className="btn-ghost small" onClick={cancelDelete}>‹ Ailem</button>
            <h2 ref={familyHeadingRef} tabIndex={-1}>Hesabı sil</h2>
          </div>
        )}

        {familyError && !family && (
          <div className="load-error" role="alert">
            <p>Aile bilgisi yüklenemedi: {familyError}</p>
            <button className="btn" onClick={loadFamily}>Tekrar dene</button>
          </div>
        )}

        {view === 'plan' && (
          <DayPage
            top={header}
            banner={hasOthers && pushReady ? <PushPrompt /> : null}
            onAdded={onAdded}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            weekDays={weekDays}
            weekError={weekError}
            onRetryWeek={loadWeek}
            onDayChanged={replaceWeekDay}
            layerReset={layerReset}
            section={section}
            setSection={setSection}
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
            onDeleteAccount={() => changeView('delete-account')}
          />
        )}
        {view === 'delete-account' && (
          <DeleteAccountForm email={user.email} profileCount={family?.profiles.length}
            onCancel={cancelDelete} onDeleted={accountDeleted} />
        )}
      </div>
    </AuditContext.Provider>
  );
}
