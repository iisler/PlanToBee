using System.ComponentModel.DataAnnotations;
using PlanToBee.API.Models;

namespace PlanToBee.API.DTOs;

// Tekrarlayan aktivite (seri). DaysOfWeek: 1 = Pazartesi ... 7 = Pazar, artan sırada.
// Exceptions: serinin görünmediği günler ("yalnızca bu gün" silinmiş ya da seriden ayrılmış), artan sırada.
public record SeriesDto(int Id, string Kind, string Title, string Time, string? EndTime, string Note,
    List<int> DaysOfWeek, string StartDate, string UntilDate, List<string> Exceptions, bool CanEdit,
    AuditMemberDto? CreatedBy, DateTime CreatedAt, AuditMemberDto? UpdatedBy, DateTime? UpdatedAt);

// Seri oluşturma. StartDate: tekrarın ilk günü (formun açıldığı gün). UntilDate dahil, StartDate'ten önce olamaz,
// en fazla StartDate + 1 yıl. Time/EndTime kuralları tek aktiviteyle aynı (EndTime yalnızca Time ile, ondan farklı).
// Sporda süre (Minutes) tutulmaz. Exceptions isteğe bağlı: "Geri al" için silinen serinin istisnalarını geri yükler.
public record AddSeriesDto(
    EventKind? Kind,
    [StringLength(150, ErrorMessage = "Aktivite adı en fazla 150 karakter olabilir")] string? Title,
    [StringLength(20, ErrorMessage = "Saat en fazla 20 karakter olabilir")] string? Time,
    [StringLength(20, ErrorMessage = "Bitiş saati en fazla 20 karakter olabilir")] string? EndTime,
    [StringLength(500, ErrorMessage = "Not en fazla 500 karakter olabilir")] string? Note,
    [MaxLength(7, ErrorMessage = "En fazla 7 gün seçilebilir")] List<int>? DaysOfWeek,
    string? StartDate,
    string? UntilDate,
    [MaxLength(400, ErrorMessage = "Çok fazla istisna günü")] List<string>? Exceptions = null);

// "Tüm tekrarlar" düzenleme: kuralın tamamı yeniden gönderilir (tür ve başlangıç tarihi değişmez).
// EndTime null ya da "" bitişi siler (seriyi yalnızca yeni istemci düzenler, korunacak eski değer yok).
public record UpdateSeriesDto(
    [StringLength(150, ErrorMessage = "Aktivite adı en fazla 150 karakter olabilir")] string? Title,
    [StringLength(20, ErrorMessage = "Saat en fazla 20 karakter olabilir")] string? Time,
    [StringLength(20, ErrorMessage = "Bitiş saati en fazla 20 karakter olabilir")] string? EndTime,
    [StringLength(500, ErrorMessage = "Not en fazla 500 karakter olabilir")] string? Note,
    [MaxLength(7, ErrorMessage = "En fazla 7 gün seçilebilir")] List<int>? DaysOfWeek,
    string? UntilDate);

// "Yalnızca bu gün" silme.
public record SkipSeriesDateDto(string? Date);

// "Yalnızca bu gün" düzenleme: o gün seriden ayrılır ve verilen alanlarla normal aktivite olur (tür seriden gelir).
public record DetachSeriesDateDto(
    string? Date,
    [StringLength(150, ErrorMessage = "Aktivite adı en fazla 150 karakter olabilir")] string? Title,
    [StringLength(20, ErrorMessage = "Saat en fazla 20 karakter olabilir")] string? Time,
    [StringLength(20, ErrorMessage = "Bitiş saati en fazla 20 karakter olabilir")] string? EndTime,
    [StringLength(500, ErrorMessage = "Not en fazla 500 karakter olabilir")] string? Note);

// "Tüm tekrarlar" silme cevabı. Truncated: seri kısaltıldı (from'dan önceki günler kaldı; "Geri al" = Series'in
// alanlarıyla PUT /api/series/{id}). false: seri tamamen silindi ("Geri al" = Series'in alanlarıyla POST /api/series).
// Series her iki durumda da silmeden önceki hâldir.
public record DeleteSeriesResultDto(bool Truncated, SeriesDto Series);
