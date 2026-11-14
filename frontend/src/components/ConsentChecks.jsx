import { useState } from 'react';
import LegalSheet from './LegalSheet';

// Yasal metin onay kutuları (kayıt ve yeniden onay ekranı). value: { kvkk, terms }; her biri okunan / kabul edilen
// metnin sürümü (LegalSheet'ten), true (metinde sürüm yoksa) ya da null (işaretsiz). docs: gösterilecek kutular.
// Aydınlatma bir bilgilendirmedir, açık rıza değildir (KVKK m.10): kutu yalnızca okunduğunu kaydeder.
// İşaretsiz kutuya dokunmak metni açar; kutu metnin sonundaki düğmeyle ("Okudum" / "Onaylıyorum") işaretlenir.
// İşaretliyken dokunmak işareti kaldırır.
export default function ConsentChecks({ docs = ['kvkk', 'terms'], value, onChange }) {
  const [open, setOpen] = useState(null);

  function toggle(doc, checked) {
    if (checked) setOpen(doc);
    else onChange({ ...value, [doc]: null });
  }

  function openDoc(e, doc) {
    e.preventDefault(); // etiketin kutuyu değiştirmesini engeller
    setOpen(doc);
  }

  return (
    <>
      {docs.includes('kvkk') && (
        <label className="terms-check">
          <input type="checkbox" checked={value.kvkk != null} onChange={(e) => toggle('kvkk', e.target.checked)} required />
          <span>Kişisel verilerimin işlenmesine ilişkin <button type="button" className="link-btn" onClick={(e) => openDoc(e, 'kvkk')}>Aydınlatma Metni</button>'ni okudum.</span>
        </label>
      )}
      {docs.includes('terms') && (
        <label className="terms-check">
          <input type="checkbox" checked={value.terms != null} onChange={(e) => toggle('terms', e.target.checked)} required />
          <span><button type="button" className="link-btn" onClick={(e) => openDoc(e, 'terms')}>Kullanım Koşulları</button>'nı kabul ediyorum.</span>
        </label>
      )}
      {open && (
        <LegalSheet doc={open} onClose={() => setOpen(null)}
          onAccept={(version) => onChange({ ...value, [open]: version ?? true })} />
      )}
    </>
  );
}

