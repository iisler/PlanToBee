using System.ComponentModel.DataAnnotations;

namespace PlanToBee.API.DTOs;

// Kayıt izi: ekleyen / en son düzenleyen. IsFormerMember=true ise "Eski üye: [Ad]" gösterilir.
// Kayıtlardaki CanEdit: istek sahibi bu kaydı düzenleyip silebilir mi (ebeveyn ya da kaydı ekleyen).
public record AuditMemberDto(int MemberId, string DisplayName, bool IsFormerMember);

public record StudyEntryDto(int Id, string Subject, string Topic, int Minutes, string Status, bool CanEdit,
    AuditMemberDto? CreatedBy, DateTime CreatedAt, AuditMemberDto? UpdatedBy, DateTime? UpdatedAt, bool IsImported);
// Etkinlik ya da antrenman. Kind: "Event" | "Training". Etkinlikte Title dolu; antrenmanda TrainingType ve Minutes dolu.
public record EventDto(int Id, string Kind, string Title, string Time, string Note, string? TrainingType, int? Minutes, bool CanEdit,
    AuditMemberDto? CreatedBy, DateTime CreatedAt, AuditMemberDto? UpdatedBy, DateTime? UpdatedAt, bool IsImported);
public record SubjectDto(int Id, string Name, bool CanEdit,
    AuditMemberDto? CreatedBy, DateTime CreatedAt, AuditMemberDto? UpdatedBy, DateTime? UpdatedAt, bool IsImported);

// Ailenin ortak planındaki bir gün. Ailedeki herkes kayıt ekleyebilir.
// Events: etkinlikler ve antrenmanlar tek listede; önce saati olanlar saat sırasıyla, sonra saatsizler eklenme sırasıyla.
public record DayDto(
    string Date,
    List<StudyEntryDto> StudyEntries,
    List<EventDto> Events
);

// EventCount antrenmanları saymaz; antrenmanlar TrainingCount ve TrainingMinutes'tadır.
public record WeekSummaryDto(string Date, int StudyMinutes, int EntryCount, bool TrainingDone, int TrainingCount, int TrainingMinutes, int EventCount);
public record WeekDto(List<WeekSummaryDto> Days);

// GET /api/days/week/{monday}/details: haftanın 7 günü, her biri GET /api/days/{date} cevabıyla aynı biçimde.
public record WeekDetailsDto(List<DayDto> Days);

public record SubjectListDto(List<SubjectDto> Subjects);

// Bir kayıt en fazla bir tam gün (1440 dk) sürebilir.
public record AddStudyEntryDto(
    [Required(ErrorMessage = "Ders seçin"), StringLength(100, ErrorMessage = "Ders adı en fazla 100 karakter olabilir")] string Subject,
    [StringLength(200, ErrorMessage = "Konu en fazla 200 karakter olabilir")] string? Topic,
    [Range(1, 1440, ErrorMessage = "Süre 1 ile 1440 dakika arasında olmalı")] int Minutes);

// Status boş bırakılırsa mevcut durum korunur.
public record UpdateStudyEntryDto(
    [Required(ErrorMessage = "Ders seçin"), StringLength(100, ErrorMessage = "Ders adı en fazla 100 karakter olabilir")] string Subject,
    [StringLength(200, ErrorMessage = "Konu en fazla 200 karakter olabilir")] string? Topic,
    [Range(1, 1440, ErrorMessage = "Süre 1 ile 1440 dakika arasında olmalı")] int Minutes,
    string? Status);

public record PatchStatusDto([Required] string Status);

// Kind: "Event" (varsayılan) ya da "Training".
// - Etkinlik: Title zorunlu; TrainingType ve Minutes yok sayılır.
// - Antrenman: TrainingType (hazır tür ya da kullanıcının yazdığı) zorunlu, Minutes 1-1440; Title yok sayılır.
// Time boş ya da SS:dd. Kaydın türü sonradan değiştirilemez (UpdateEventDto'da Kind yok).
public record AddEventDto(
    Models.EventKind? Kind,
    [StringLength(150, ErrorMessage = "Etkinlik adı en fazla 150 karakter olabilir")] string? Title,
    [StringLength(20, ErrorMessage = "Saat en fazla 20 karakter olabilir")] string? Time,
    [StringLength(500, ErrorMessage = "Not en fazla 500 karakter olabilir")] string? Note,
    [StringLength(50, ErrorMessage = "Antrenman türü en fazla 50 karakter olabilir")] string? TrainingType,
    int? Minutes);

public record UpdateEventDto(
    [StringLength(150, ErrorMessage = "Etkinlik adı en fazla 150 karakter olabilir")] string? Title,
    [StringLength(20, ErrorMessage = "Saat en fazla 20 karakter olabilir")] string? Time,
    [StringLength(500, ErrorMessage = "Not en fazla 500 karakter olabilir")] string? Note,
    [StringLength(50, ErrorMessage = "Antrenman türü en fazla 50 karakter olabilir")] string? TrainingType,
    int? Minutes);
