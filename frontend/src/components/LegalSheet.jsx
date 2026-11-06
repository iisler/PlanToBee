import { useEffect, useState } from 'react';
import Sheet from './Sheet';

// Kayıt ekranında Aydınlatma Metni ve Kullanım Koşulları uygulamanın içinde açılır.
// Metin public/legal/ altındaki statik sayfadan (kendi dosyamız) okunur; onay düğmesi metnin en sonundadır,
// yani kullanıcı düğmeye ulaşmak için metni sonuna kadar kaydırır. Düğmeye basınca onAccept çağrılır ve sayfa kapanır.
const LEGAL = `${import.meta.env.BASE_URL}legal/`;

const LEGAL_DOCS = {
  kvkk: { file: 'aydinlatma.html', title: 'Aydınlatma Metni', accept: 'Okudum' },
  terms: { file: 'kosullar.html', title: 'Kullanım Koşulları', accept: 'Onaylıyorum' },
};

export default function LegalSheet({ doc, onAccept, onClose }) {
  const { file, title, accept } = LEGAL_DOCS[doc];
  // { html } yüklendi, { error: true } yüklenemedi, null yükleniyor
  const [state, setState] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`${LEGAL}${file}`, { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
      .then((text) => {
        const article = new DOMParser().parseFromString(text, 'text/html').querySelector('article');
        if (!article) throw new Error('article');
        article.querySelector('h1')?.remove();  // başlık sayfanın üst çubuğunda
        if (alive) setState({ html: article.innerHTML });
      })
      .catch(() => { if (alive) setState({ error: true }); });
    return () => { alive = false; };
  }, [file, attempt]);

  return (
    <Sheet labelledBy="legal-sheet-title" onClose={onClose} className="legal-sheet">
      <div className="sheet-head">
        <h3 id="legal-sheet-title" tabIndex={-1}>{title}</h3>
        <button type="button" className="sheet-close" onClick={onClose}>Kapat</button>
      </div>
      <div className="sheet-body">
        {state === null && <div className="sheet-loading" role="status">Yükleniyor…</div>}
        {state?.error && (
          <div className="legal-error" role="alert">
            <p>Metin yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.</p>
            <button type="button" className="btn-ghost" onClick={() => { setState(null); setAttempt((a) => a + 1); }}>Tekrar dene</button>
          </div>
        )}
        {state?.html && (
          <>
            {/* Kendi statik dosyamız (public/legal/), kullanıcı girdisi değil */}
            <div className="legal-doc" dangerouslySetInnerHTML={{ __html: state.html }} />
            <button type="button" className="auth-submit legal-accept" onClick={() => { onAccept(); onClose(); }}>{accept}</button>
          </>
        )}
      </div>
    </Sheet>
  );
}
