import { useCallback, useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { errorCode, errorText } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import { useNotice } from '../context/NoticeContext';
import DayPage from './DayPage';
import WeekPage from './WeekPage';
import FamilyPage from './FamilyPage';
import UserMenu from '../components/UserMenu';
import { dkey, mondayOf } from '../utils/format';

// Giriş yapmış, e-postası doğrulanmış ve ailesi olan kullanıcının ana ekranı.
// Gün ve hafta planı ailenin ortak planıdır; herkes kendi hesabıyla görür ve ekler.
export default function PlanShell() {
  const { user, logout, refreshMe } = useAuth();
  const { notify } = useNotice();
  const [family, setFamily] = useState(null);
  const [familyError, setFamilyError] = useState('');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState('day');
  const [weekSummaries, setWeekSummaries] = useState([]);
  const [subjects, setSubjects] = useState([]);

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

  const myId = family?.myMemberId ?? user.family.memberId;

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

  // Yazma reddedildi: rol veya üyelik değişmiş olabilir.
  const onAccessChanged = useCallback(async () => {
    const f = await loadFamily();
    if (f && f.id !== user.family.id) refreshMe().catch(() => {});
    loadSubjects();
  }, [loadFamily, loadSubjects, refreshMe, user.family.id]);

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
    <div className="wrap">
      <header className="top">
        <h1><img className="logo" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />PlanToBee</h1>
        <div className="top-right">
          <UserMenu name={user.displayName} onFamily={() => changeView('family')} />
          <button className="logout-btn" onClick={logout}>Çıkış</button>
        </div>
      </header>

      <div className="viewtabs">
        <button className={view === 'day' ? 'active' : ''} onClick={() => changeView('day')}>Gün</button>
        <button className={view === 'week' ? 'active' : ''} onClick={() => changeView('week')}>Hafta Planı</button>
      </div>

      {familyError && !family && (
        <div className="load-error">
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
          setCurrentDate={(d) => { setCurrentDate(d); setView('day'); }}
          subjects={subjects}
          myId={myId}
          onDataChanged={loadWeek}
          onAccessChanged={onAccessChanged}
        />
      )}
      {view === 'family' && (
        <FamilyPage
          family={family}
          reloadFamily={loadFamily}
        />
      )}
    </div>
  );
}
