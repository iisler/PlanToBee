import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';
import { errorCode, errorText } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import { useNotice } from '../context/NoticeContext';
import DayPage from './DayPage';
import FamilyPage from './FamilyPage';
import WeekPage from './WeekPage';
import LessonsPage from './LessonsPage';
import AddSheet from '../components/AddSheet';
import TabBar from '../components/TabBar';
import ProfileSheet from '../components/ProfileSheet';
import ImportSheet from '../components/ImportSheet';
import { addDays, dayTitle, dkey, initial, mondayOf } from '../utils/format';
import { patchEntry } from '../hooks/useMutation';
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

// Profil seçilmiş aile hesabının ana ekranı (Görev 17 "Akış"). Gün ve hafta planı ailenin ortak planıdır;
// her profil görür ve ekler, kayıtlarda ekleyen profil görünür.
// Alt menü (Görev 17b): Bugün (DayPage) · Hafta (WeekPage; Dersler sayfası oradan açılır) · + (Aktivite / Ders → AddSheet) ·
// Program yükle (ImportSheet) · Aile (FamilyPage). Profil paneli her sayfanın sağ üstündeki baş harf düğmesinden açılır.
export default function PlanShell() {
  const { user, logout, accountDeleted, refreshMe, startSwitch } = useAuth();
  const { notify } = useNotice();
  const [family, setFamily] = useState(null);
  const [familyError, setFamilyError] = useState('');
  const [linkDate] = useState(() => dateFromUrl(window.location.href));
  const [currentDate, setCurrentDate] = useState(() => linkDate ?? new Date());
  // Görünüm: 'plan' (Bugün) | 'week' (Hafta) | 'lessons' (Dersler) | 'family' (Aile) | 'notifications' | 'delete-account'
  const [view, setView] = useState('plan');
  // Hafta ayrıntıları pazartesiye göre: { [pzt]: { days: 7 DayDto | null, error } }; seçili hafta ve iki komşusu
  const [weeks, setWeeks] = useState({});
  // Bildirimden gün açılınca ya da alt menüye dokununca artar: açık ⋯ menüleri ve alt sayfalar kapanır
  const [layerReset, setLayerReset] = useState(0);
  // Gün ekranı dışından (Ekle sayfası, Dersler) veri değişince artar: gün sunucudan yeniden okunur
  const [refreshKey, setRefreshKey] = useState(0);
  // Ekle sayfası (alt menüdeki + → Aktivite / Ders): null | { type, date, study?, event? }
  const [addSheet, setAddSheet] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  // Program yükleme paneli (alt menüdeki Program yükle, Görev 15)
  const [importOpen, setImportOpen] = useState(false);
  const addBtnRef = useRef(null);
  const importBtnRef = useRef(null);
  const profileBtnRef = useRef(null);
  const [subjects, setSubjects] = useState([]);
  const headingRef = useRef(null);

  // Sayfa değişince odak sayfa başlığına taşınır (klavye ve ekran okuyucu kullanıcıları için)
  useEffect(() => {
    if (view !== 'plan') headingRef.current?.focus({ preventScroll: true });
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
      // Önce açık katmanlar kapanır, sonra Bugün ekranında o gün seçilir
      setLayerReset(n => n + 1);
      setProfileOpen(false);
      setAddSheet(null);
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

  // Seçili haftanın ayrıntısı (petek, Hafta ve Dersler sayfaları, gün ekranı), hafta başına tek istek. Her ekleme, değiştirme,
  // silme ve durum değişikliğinden sonra yeniden çekilir. Bir haftaya yalnızca onun en son isteğinin yanıtı yazılır; seçili
  // haftadan uzaklaşılmışsa yanıt atılır. Seçili hafta yüklenince önceki ve sonraki hafta da sessizce çekilir: gün kaydırırken
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
      // Aynı haftanın önceki verisi varsa korunur; yoksa petek boş kalır, sayfalar "Tekrar dene" gösterir.
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
  // İyimser değişiklik (silme, durum) haftalık veriye de uygulanır: petek ve sayfalar beklemeden güncellenir,
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
  const failed = (err) => {
    notify(errorText(err));
    if (errorCode(err) === 'plan_read_only') onAccessChanged();
  };

  async function addSubject(name) {
    try {
      const res = await client.post('/subjects', JSON.stringify(name), { headers: { 'Content-Type': 'application/json' } });
      setSubjects(s => [...s, res.data]);
      return true;
    } catch (err) {
      failed(err);
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
      failed(err);
    }
  }

  // Gün ekranı dışından yapılan değişiklikten sonra: hafta ve (açıksa) gün yeniden okunur
  const refresh = useCallback(() => {
    loadWeek();
    setRefreshKey(n => n + 1);
  }, [loadWeek]);

  // Ekle sayfası ve sesle ekleme: kayıt seçilen güne eklenir (body.repeat varsa seri, Görev 11). Bugün ekranındaysa o gün
  // açılır; başka sayfada yer değişmez, bildirim ne eklendiğini söyler. Dönüş: başarılıysa true.
  async function addEntry(key, type, { repeat, ...body }) {
    try {
      if (type === 'study') await client.post(`/days/${key}/entries`, body);
      else if (repeat) await client.post('/series', { ...body, ...repeat });
      else await client.post(`/days/${key}/events`, body);
    } catch (err) {
      failed(err);
      return false;
    }
    const target = parseKey(key);
    onAdded();
    if (view === 'plan') setCurrentDate(target);
    const monday = dkey(mondayOf(target));
    if (monday !== weekKeyRef.current) fetchWeek(monday, true);
    refresh();
    notify(`${type === 'study' ? body.subject : body.title} eklendi: ${dayTitle(target)}`, 'info');
    return true;
  }
  const openAdd = (type = 'study', extra = {}) => setAddSheet({ type, date: dkey(view === 'plan' ? currentDate : new Date()), ...extra });
  // Ekle ekranı kapanınca (Ekle ya da Vazgeç, 17c) Bugün ekranına dönülür: eklenince eklenen gün, vazgeçince başka
  // sayfadan gelindiyse bugün açılır.
  const addedRef = useRef(false);
  function closeAdd() {
    setAddSheet(null);
    if (!addedRef.current && view !== 'plan') setCurrentDate(new Date());
    addedRef.current = false;
    setView('plan');
    window.scrollTo(0, 0);
  }
  async function submitAdd(key, type, body) {
    const ok = await addEntry(key, type, body);
    if (ok) { addedRef.current = true; setCurrentDate(parseKey(key)); }
    return ok;
  }
  // Sesle eklemedeki "Düzenle": Ekle sayfası o gün ve o taslakla açılır
  const quickEdit = (key, type, draft) => setAddSheet({ type, date: key, [type]: draft });

  // Dersler sayfası: başka bir günün dersinin durumu (iyimser; hata olursa sunucudaki hâl geri gelir)
  async function setLessonStatus(day, entry, status) {
    replaceWeekDay(patchEntry(day, 'studyEntries', entry.id, { status }));
    try {
      await client.patch(`/days/${day.date}/entries/${entry.id}/status`, { status });
    } catch (err) {
      failed(err);
    }
    refresh();
  }
  // Geride kalan dersi bugüne taşır: bugüne saatsiz olarak eklenir, eski günden silinir.
  async function moveToToday(day, entry) {
    try {
      await client.post(`/days/${dkey(new Date())}/entries`, { subject: entry.subject, topic: entry.topic ?? '', minutes: entry.minutes, startTime: '' });
      await client.delete(`/days/${day.date}/entries/${entry.id}`);
      notify(`${entry.subject} bugüne alındı`, 'info');
    } catch (err) {
      failed(err);
    }
    refresh();
  }

  function changeView(v) {
    setView(v);
    if (v === 'family') loadFamily();
    window.scrollTo(0, 0);
  }

  // Alt menü her sayfada ve alt sayfaların üstünde görünür (Görev 17b). Menüye dokununca açık alt sayfalar (Ekle, Program yükle,
  // profil, ⋯ menüsü, düzenleme, ders listesi) kapanır; keep: dokunulan düğmenin kendi sayfası açık kalır.
  function closeLayers(keep) {
    setProfileOpen(false);
    if (keep !== 'add') setAddSheet(null);
    if (keep !== 'import') setImportOpen(false);
    setLayerReset(n => n + 1);
  }
  // Bugün: gün ekranı; zaten oradaysa bugüne döner.
  function goToday() {
    closeLayers();
    if (view === 'plan') setCurrentDate(new Date());
    else setView('plan');
    window.scrollTo(0, 0);
  }
  // + → Aktivite / Ders: Ekle sayfası o türle açılır; zaten açıksa yalnızca tür değişir (gün ve yazılanlar kalır).
  function chooseAdd(type) {
    closeLayers('add');
    setAddSheet(s => (s ? { ...s, type } : { type, date: dkey(view === 'plan' ? currentDate : new Date()) }));
  }
  function openImport() {
    closeLayers('import');
    setImportOpen(true);
  }
  // Hafta ya da Dersler sayfasında bir güne dokununca o gün Bugün ekranında açılır
  function pickDay(date) {
    setCurrentDate(new Date(date));
    changeView('plan');
  }
  const stepWeek = (n) => setCurrentDate(d => addDays(mondayOf(d), 7 * n));

  // Program yüklendi: hafta yenilenir; "Geri al" o yüklemede eklenen bütün serileri siler.
  function imported({ importId, count }) {
    setImportOpen(false);
    onAdded();
    refresh();
    notify(`${count} kayıt eklendi`, 'info', {
      duration: 10000,
      action: {
        label: 'Geri al',
        onClick: async () => {
          try {
            await client.delete(`/series/bulk/${importId}`);
            notify('Program geri alındı', 'info');
          } catch (err) {
            notify(errorText(err));
          }
          refresh();
        },
      },
    });
  }

  // Hesap silme sayfasından Vazgeç: Aile'ye dönülür ve odak silme düğmesine verilir.
  function cancelDelete() {
    changeView('family');
    setTimeout(() => document.getElementById('delete-account-open')?.focus(), 0);
  }

  // Profil düğmesi: her sayfanın sağ üstünde profilin baş harfi (cihazı kimin kullandığını da gösterir)
  const name = user.profile.displayName;
  const avatar = (
    <button type="button" ref={profileBtnRef} className="avbtn" aria-haspopup="dialog" aria-label={`Profil: ${name}`} onClick={() => setProfileOpen(true)}>
      {initial(name)}
    </button>
  );
  const monday = mondayOf(currentDate);
  // Ekle sayfası açıkken hiçbir sekme seçili görünmez; Dersler, Hafta'nın alt sayfasıdır.
  const active = importOpen ? 'import' : addSheet ? null
    : view === 'plan' ? 'today' : view === 'week' || view === 'lessons' ? 'week' : view === 'notifications' ? null : 'family';
  const pageTitle = { family: 'Aile', notifications: 'Bildirimler', 'delete-account': 'Hesabı sil' }[view];

  return (
    <AuditContext.Provider value={auditSettings}>
      <div className="wrap">
        {pageTitle && (
          <header className="pghead">
            {view === 'delete-account'
              ? <button className="btn-ghost small" onClick={cancelDelete}>‹ Aile</button>
              : view === 'notifications' && <button className="btn-ghost small" onClick={() => changeView('plan')}>‹ Bugün</button>}
            <div className="pg-title"><h1 ref={headingRef} tabIndex={-1}>{pageTitle}</h1></div>
            {avatar}
          </header>
        )}

        {familyError && !family && (
          <div className="load-error" role="alert">
            <p>Aile bilgisi yüklenemedi: {familyError}</p>
            <button className="btn" onClick={loadFamily}>Tekrar dene</button>
          </div>
        )}

        {view === 'plan' && (
          <DayPage
            banner={hasOthers && pushReady ? <PushPrompt /> : null}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            weekDays={weekDays}
            onDayChanged={replaceWeekDay}
            layerReset={layerReset}
            refreshKey={refreshKey}
            myId={myId}
            subjects={subjects}
            onDataChanged={loadWeek}
            onAccessChanged={onAccessChanged}
            onQuickAdd={addEntry}
            onQuickEdit={quickEdit}
            onOpenAdd={openAdd}
            avatar={avatar}
          />
        )}
        {view === 'week' && (
          <WeekPage monday={monday} days={weekDays} error={weekError} onRetry={loadWeek} onStep={stepWeek} onPick={pickDay}
            onLessons={() => changeView('lessons')} headingRef={headingRef}>
            {avatar}
          </WeekPage>
        )}
        {view === 'lessons' && (
          <LessonsPage monday={monday} days={weekDays} error={weekError} onRetry={loadWeek} onStep={stepWeek} onPick={pickDay}
            onStatus={setLessonStatus} onMove={moveToToday} subjects={subjects} onAddSubject={addSubject} onDeleteSubject={deleteSubject}
            onBack={() => changeView('week')} layerReset={layerReset} headingRef={headingRef}>
            {avatar}
          </LessonsPage>
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

      <TabBar active={active} addRef={addBtnRef} importRef={importBtnRef} onToday={goToday} onAdd={chooseAdd} onImport={openImport}
        onWeek={() => { closeLayers(); changeView('week'); }} onFamily={() => { closeLayers(); changeView('family'); }} />
      {addSheet && (
        <AddSheet init={addSheet} type={addSheet.type} subjects={subjects} weekDays={weekDays}
          onAddSubject={addSubject} onDeleteSubject={deleteSubject} onSubmit={submitAdd}
          onClose={closeAdd} returnFocusRef={addBtnRef} />
      )}
      {importOpen && (
        <ImportSheet subjects={subjects} onClose={() => setImportOpen(false)} onDone={imported} returnFocusRef={importBtnRef} />
      )}
      {profileOpen && (
        <ProfileSheet name={name} role={user.profile.role} familyName={family?.name ?? user.family?.name}
          onSwitchProfile={(family?.profiles.length ?? 2) > 1 ? startSwitch : undefined}
          onNotifications={hasOthers ? () => changeView('notifications') : undefined} onLogout={logout}
          onClose={() => setProfileOpen(false)} returnFocusRef={profileBtnRef} />
      )}
    </AuditContext.Provider>
  );
}
