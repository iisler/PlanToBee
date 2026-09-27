using System.ComponentModel.DataAnnotations;

namespace PlanToBee.API.DTOs;

// Kayıt izi: ekleyen / en son düzenleyen. IsFormerMember=true ise "Eski üye: [Ad]" gösterilir.
public record AuditMemberDto(int MemberId, string DisplayName, bool IsFormerMember);

public record StudyEntryDto(int Id, string Subject, string Topic, int Minutes, string Status,
    AuditMemberDto? CreatedBy, DateTime CreatedAt, AuditMemberDto? UpdatedBy, DateTime? UpdatedAt, bool IsImported);
public record TrainingEntryDto(int Id, string Type, int Minutes, string Note,
    AuditMemberDto? CreatedBy, DateTime CreatedAt, AuditMemberDto? UpdatedBy, DateTime? UpdatedAt, bool IsImported);
public record EventDto(int Id, string Title, string Time, string Note,
    AuditMemberDto? CreatedBy, DateTime CreatedAt, AuditMemberDto? UpdatedBy, DateTime? UpdatedAt, bool IsImported);
public record SubjectDto(int Id, string Name,
    AuditMemberDto? CreatedBy, DateTime CreatedAt, AuditMemberDto? UpdatedBy, DateTime? UpdatedAt, bool IsImported);

public record DayDto(
    string Date,
    int MemberId,
    bool CanEdit,
    List<StudyEntryDto> StudyEntries,
    List<TrainingEntryDto> TrainingEntries,
    List<EventDto> Events
);

public record WeekSummaryDto(string Date, int StudyMinutes, int EntryCount, bool TrainingDone, int TrainingCount, int EventCount);
public record WeekDto(int MemberId, bool CanEdit, List<WeekSummaryDto> Days);

public record SubjectListDto(int MemberId, bool CanEdit, List<SubjectDto> Subjects);

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

public record AddTrainingDto(
    [Required(ErrorMessage = "Antrenman türü seçin"), StringLength(50, ErrorMessage = "Antrenman türü en fazla 50 karakter olabilir")] string Type,
    [Range(1, 1440, ErrorMessage = "Süre 1 ile 1440 dakika arasında olmalı")] int Minutes,
    [StringLength(500, ErrorMessage = "Not en fazla 500 karakter olabilir")] string? Note);

public record UpdateTrainingDto(
    [Required(ErrorMessage = "Antrenman türü seçin"), StringLength(50, ErrorMessage = "Antrenman türü en fazla 50 karakter olabilir")] string Type,
    [Range(1, 1440, ErrorMessage = "Süre 1 ile 1440 dakika arasında olmalı")] int Minutes,
    [StringLength(500, ErrorMessage = "Not en fazla 500 karakter olabilir")] string? Note);

public record AddEventDto(
    [Required(ErrorMessage = "Etkinlik adı girin"), StringLength(150, ErrorMessage = "Etkinlik adı en fazla 150 karakter olabilir")] string Title,
    [StringLength(20, ErrorMessage = "Saat en fazla 20 karakter olabilir")] string? Time,
    [StringLength(500, ErrorMessage = "Not en fazla 500 karakter olabilir")] string? Note);

public record UpdateEventDto(
    [Required(ErrorMessage = "Etkinlik adı girin"), StringLength(150, ErrorMessage = "Etkinlik adı en fazla 150 karakter olabilir")] string Title,
    [StringLength(20, ErrorMessage = "Saat en fazla 20 karakter olabilir")] string? Time,
    [StringLength(500, ErrorMessage = "Not en fazla 500 karakter olabilir")] string? Note);
