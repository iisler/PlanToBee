// Aktivite saati: telefonda saat seçici açılır (HH:mm). Boş bırakılabilir.
// Eski kayıtlarda saat serbest metin olabilir (ör. "akşam"); saat seçici böyle bir değeri gösteremeyeceği için
// o durumda metin alanı gösterilir, değer kaybolmaz. Alan temizlenince saat seçiciye döner.
export default function TimeInput({ value, onChange, className = '', label = 'Saat', ...rest }) {
  const legacy = !!value && !/^\d{2}:\d{2}$/.test(value);
  return (
    <input {...rest} type={legacy ? 'text' : 'time'} className={`time-input ${className}`.trim()} aria-label={label}
      placeholder={legacy ? 'Saat' : undefined} value={value} onChange={e => onChange(e.target.value)} />
  );
}
