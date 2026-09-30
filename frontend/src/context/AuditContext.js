import { createContext, useContext } from 'react';

// Kayıt izlerinin gösterim ayarı. showOwn: ailede birden fazla hesap varsa (plan gerçekten paylaşılıyorsa)
// kişinin kendi eklediği kayıtlarda da "Sen ekledin" yazılır; tek kişilik ailede gereksiz kalabalık olmasın.
export const AuditContext = createContext({ showOwn: false });

export const useAuditSettings = () => useContext(AuditContext);
