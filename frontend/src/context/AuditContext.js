import { createContext, useContext } from 'react';

// Kayıt izlerinin gösterim ayarı. hideInitials: çocuk profilinde satırlarda "kim ekledi" baş harfi gösterilmez
// (plan çoğunlukla ebeveynin; ayrıntı ⋯ menüsünde).
export const AuditContext = createContext({ hideInitials: false });

export const useAuditSettings = () => useContext(AuditContext);
