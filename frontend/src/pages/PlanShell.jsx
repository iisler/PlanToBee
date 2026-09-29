import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';
import { errorCode, errorText } from '../api/errors';
import { useAuth } from '../context/AuthContext';
import { useNotice } from '../context/NoticeContext';
import PersonPicker from '../components/PersonPicker';
import PlanBanner from '../components/PlanBanner';
import DayPage from './DayPage';
import WeekPage from './WeekPage';
import FamilyPage from './FamilyPage';
import { dkey, mondayOf } from '../utils/format';

// Giriş yapmış, e-postası doğrulanmış ve ailesi olan kullanıcının ana ekranı.
export default function PlanShell() {
  const { user, logout, refreshMe } = useAuth();
  const { notify } = useNotice();
  const [family, setFamily] = useState(null);
  const [familyError, setFamilyError] = useState('');
  const [selectedId, setSelectedId] = useState(user.family.memberId);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState('day');
  const [weekSummaries, setWeekSummaries] = useState([]);
  const [subjects, setSubjects] = useState({ list: [], canEdit: false });

  const loadFamily = useCallback(async () => {
    try {
      const r = await client.get('/family');
      setFamily(r.data);
      setFamilyError('');
      // Seçili kişi aileden çıkarıldıysa kişinin kendi planına dön
      setSelectedId(id => (r.data.members.some(m => m.id === id) ? id : r.data.myMemberId));
      return r.data;
    } catch (err) {
      setFamilyError(errorText(err));
      return null;
    }
  }, []);

  useEffect(() => { loadFamily(); }, [loadFamily]);

  const myId = family?.myMemberId ?? user.family.memberId;
  const memberId = selectedId !== myId ? selectedId : undefined;
  const planParams = useMemo(() => (memberId ? { memberId } : {}), [memberId]);
  const selectedMember = family?.members.find(m => m.id === selectedId);

  // Haftalık özet (gün şeridi ve istatistikler). Hata gün sayfasında ayrıca gösterilir.
  const weekReq = useRef(0);
  const weekKey = dkey(mondayOf(currentDate));
  const loadWeek = useCallback(async () => {
    const id = ++weekReq.current;
    try {
      const res = await client.get(`/days/week/${weekKey}`, { params: planParams });
      if (id === weekReq.current) setWeekSummaries(res.data.days);
    } catch {
      if (id === weekReq.current) setWeekSummaries([]);
    }
  }, [weekKey, planParams]);
  useEffect(() => { loadWeek(); }, [loadWeek]);

  const loadSubjects = useCallback(async () => {
    try {
      const res = await client.get('/subjects', { params: planParams });
      setSubjects({ list: res.data.subjects, canEdit: res.data.canEdit });
    } catch (err) {
      setSubjects({ list: [], canEdit: false });
      notify(`Ders listesi yüklenemedi: ${errorText(err)}`);
    }
  }, [planParams, notify]);
  useEffect(() => { loadSubjects(); }, [loadSubjects]);

  // Yazma reddedildi ya da plan bulunamadı: rol veya üyelik değişmiş olabilir.
  const onAccessChanged = useCallback(async () => {
    const f = await loadFamily();
    if (f && f.id !== user.family.id) refreshMe().catch(() => {});
    loadSubjects();
  }, [loadFamily, loadSubjects, refreshMe, user.family.id]);

  async function addSubject(name) {
    try {
      const res = await client.post('/subjects', JSON.stringify(name), { headers: { 'Content-Type': 'application/json' }, params: planParams });
      setSubjects(s => ({ ...s, list: [...s.list, res.data] }));
      return true;
    } catch (err) {
      notify(errorText(err));
      if (errorCode(err) === 'plan_read_only') onAccessChanged();
      return false;
    }
  }

  async function deleteSubject(subject) {
    const snapshot = subjects;
    setSubjects(s => ({ ...s, list: s.list.filter(x => x.id !== subject.id) }));
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

  const fallbackCanEdit = selectedMember ? selectedMember.canEdit : selectedId === myId;

  return (
    <div className="wrap">
      <header className="top">
        <h1><img className="logo" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />PlanToBee</h1>
        <div className="top-right">
          {family
            ? <PersonPicker members={family.members} selectedId={selectedId} onSelect={setSelectedId} />
            : <span className="tag"><span className="av">{user.displayName?.[0]}</span>{user.displayName}</span>}
          <button className="logout-btn" onClick={logout}>Çıkış</button>
        </div>
      </header>

      <div className="viewtabs">
        <button className={view === 'day' ? 'active' : ''} onClick={() => changeView('day')}>Gün</button>
        <button className={view === 'week' ? 'active' : ''} onClick={() => changeView('week')}>Hafta Planı</button>
        <button className={view === 'family' ? 'active' : ''} onClick={() => changeView('family')}>Ailem</button>
      </div>

      {familyError && !family && (
        <div className="load-error">
          <p>Aile bilgisi yüklenemedi: {familyError}</p>
          <button className="btn" onClick={loadFamily}>Tekrar dene</button>
        </div>
      )}

      {view !== 'family' && <PlanBanner member={selectedMember} canEdit={fallbackCanEdit} />}

      {view === 'day' && (
        <DayPage
          key={selectedId}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          weekSummaries={weekSummaries}
          planParams={planParams}
          fallbackCanEdit={fallbackCanEdit}
          subjects={subjects.list}
          subjectsCanEdit={subjects.canEdit}
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
          subjects={subjects.list}
          planParams={planParams}
          fallbackCanEdit={fallbackCanEdit}
          onDataChanged={loadWeek}
          onAccessChanged={onAccessChanged}
        />
      )}
      {view === 'family' && (
        <FamilyPage
          family={family}
          reloadFamily={loadFamily}
          onOpenPlan={(id) => { setSelectedId(id); setView('day'); }}
        />
      )}
    </div>
  );
}
