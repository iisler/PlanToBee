using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PlanToBee.API.Data;
using PlanToBee.API.Infrastructure;
using PlanToBee.API.Infrastructure.WebPush;
using PlanToBee.API.Models;
using PlanToBee.API.Services;
using PlanToBee.API.Services.Notifications;

namespace PlanToBee.API.Controllers;

public record PushConfigDto(bool Enabled, string? PublicKey);
public record SubscribeDto(
    [Required, StringLength(1000)] string Endpoint,
    [Required, StringLength(200)] string P256dh,
    [Required, StringLength(100)] string Auth,
    [StringLength(60)] string? DeviceLabel);
public record UnsubscribeDto([Required, StringLength(1000)] string Endpoint);
public record SubscribedDto(int Id);
public record PushSettingsDto(bool StudyAdded, bool ActivityAdded, bool Changes, bool StudyDone,
    bool QuietEnabled, string QuietStart, string QuietEnd, List<int> MutedMemberIds);
public record PushMemberDto(int Id, string DisplayName);
public record PushDeviceDto(int Id, string Label, int MemberId, string MemberName, DateTime CreatedAt, DateTime? LastSuccessAt, bool CanRemove);
public record PushSettingsViewDto(PushSettingsDto Settings, List<PushMemberDto> Members, List<PushDeviceDto> Devices);
public record PushTestResultDto(int Sent);

// Bildirimler (Web Push): cihaz aboneliği, profil ayarları, cihaz listesi.
// - Abonelik cihazda seçili profil adına tutulur; profil değişince aynı uç nokta yeniden gönderilir ve abonelik
//   yeni profile geçer.
// - Ayarlar seçili profile aittir; herkes yalnızca kendi ayarını değiştirir.
// - Cihaz listesini ailedeki herkes görür; ebeveyn her cihazı, çocuk yalnızca kendi cihazlarını kaldırabilir.
[ApiController]
[Route("api/push")]
[Authorize]
[RequireVerifiedEmail]
[EnableRateLimiting(RateLimitPolicies.Api)]
public partial class PushController(AppDbContext db, MemberContext members, IOptions<WebPushOptions> options,
    IServiceProvider services) : ControllerBase
{
    // Bir ailede en fazla bu kadar cihaz; aşılırsa en eski abonelik silinir.
    private const int MaxDevicesPerFamily = 20;

    [HttpGet("config")]
    public IActionResult Config() =>
        Ok(new PushConfigDto(options.Value.Enabled, options.Value.Enabled ? services.GetRequiredService<VapidKey>().PublicKey : null));

    [HttpPut("subscription")]
    public async Task<IActionResult> Subscribe(SubscribeDto dto)
    {
        if (!options.Value.Enabled) return Err.BadRequest("push_disabled", "Bildirimler bu sunucuda kapalı.");
        var me = await members.GetCurrentAsync();
        if (me == null) return await members.MissingAsync();
        if (!PushEndpointPolicy.IsAllowed(dto.Endpoint, options.Value.TestEndpointHosts, out _))
            return Err.BadRequest("push_endpoint", "Bu bildirim adresi desteklenmiyor.");
        if (!ValidKey(dto.P256dh, 65, 0x04) || !ValidKey(dto.Auth, 16))
            return Err.BadRequest("push_keys", "Bildirim anahtarları geçersiz.");

        var endpoint = dto.Endpoint.Trim();
        var sub = await db.PushSubscriptions.FirstOrDefaultAsync(s => s.EndpointIndex == endpoint);
        if (sub == null)
        {
            sub = new PushSubscription { Endpoint = endpoint, EndpointIndex = endpoint, CreatedAt = DateTime.UtcNow };
            db.PushSubscriptions.Add(sub);
            var existing = await db.PushSubscriptions.Where(s => s.FamilyId == me.FamilyId)
                .OrderBy(s => s.CreatedAt).Select(s => s.Id).ToListAsync();
            if (existing.Count >= MaxDevicesPerFamily)
                await db.PushSubscriptions.Where(s => existing.Take(existing.Count - MaxDevicesPerFamily + 1).ToList().Contains(s.Id)).ExecuteDeleteAsync();
        }
        // Uç noktayı bilen cihazın kendisidir; cihaz başka hesaba/profile geçtiyse abonelik ona taşınır.
        sub.FamilyId = me.FamilyId;
        sub.MemberId = me.Id;
        sub.P256dh = dto.P256dh.Trim();
        sub.Auth = dto.Auth.Trim();
        sub.DeviceLabel = CleanLabel(dto.DeviceLabel);
        await db.SaveChangesAsync();
        return Ok(new SubscribedDto(sub.Id));
    }

    // Çıkışta ve "Bu cihaz" kapatılınca. Uç nokta ailede yoksa da 204 (cihaz zaten abone değil).
    [HttpDelete("subscription")]
    public async Task<IActionResult> Unsubscribe(UnsubscribeDto dto)
    {
        var owner = await members.GetOwnerAsync();
        if (owner == null) return Err.FamilyRequired();
        var endpoint = dto.Endpoint.Trim();
        await db.PushSubscriptions.Where(s => s.EndpointIndex == endpoint && s.FamilyId == owner.FamilyId).ExecuteDeleteAsync();
        return NoContent();
    }

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings()
    {
        var me = await members.GetCurrentAsync();
        if (me == null) return await members.MissingAsync();
        var pref = await db.NotificationPreferences.AsNoTracking().FirstOrDefaultAsync(p => p.MemberId == me.Id)
                   ?? NotificationPreference.Defaults(me.Id);
        var others = await db.FamilyMembers.AsNoTracking()
            .Where(m => m.FamilyId == me.FamilyId && m.Status == MemberStatus.Active && m.Id != me.Id)
            .OrderBy(m => m.CreatedAt).Select(m => new PushMemberDto(m.Id, m.DisplayName)).ToListAsync();
        var devices = await db.PushSubscriptions.AsNoTracking()
            .Where(s => s.FamilyId == me.FamilyId)
            .OrderBy(s => s.CreatedAt)
            .Select(s => new { s.Id, s.DeviceLabel, s.MemberId, s.Member!.DisplayName, s.CreatedAt, s.LastSuccessAt })
            .ToListAsync();
        var parent = me.Role == FamilyRole.Parent;
        return Ok(new PushSettingsViewDto(
            ToDto(pref),
            others,
            devices.Select(d => new PushDeviceDto(d.Id, d.DeviceLabel, d.MemberId, d.DisplayName, d.CreatedAt, d.LastSuccessAt,
                parent || d.MemberId == me.Id)).ToList()));
    }

    [HttpPut("settings")]
    public async Task<IActionResult> SaveSettings(PushSettingsDto dto)
    {
        var me = await members.GetCurrentAsync();
        if (me == null) return await members.MissingAsync();
        if (!TryTime(dto.QuietStart, out var start) || !TryTime(dto.QuietEnd, out var end))
            return Err.BadRequest("validation", "Sessiz saatler SS:dd biçiminde olmalı (örn. 22:00).");
        if (dto.MutedMemberIds.Count > 50) return Err.BadRequest("validation", "Geçersiz profil listesi.");
        // Yalnızca ailedeki profiller saklanır.
        var familyIds = await db.FamilyMembers.Where(m => m.FamilyId == me.FamilyId).Select(m => m.Id).ToListAsync();
        var muted = dto.MutedMemberIds.Where(id => id != me.Id && familyIds.Contains(id)).Distinct().ToList();

        var pref = await db.NotificationPreferences.FirstOrDefaultAsync(p => p.MemberId == me.Id);
        if (pref == null)
        {
            pref = NotificationPreference.Defaults(me.Id);
            db.NotificationPreferences.Add(pref);
        }
        pref.StudyAdded = dto.StudyAdded;
        pref.ActivityAdded = dto.ActivityAdded;
        pref.Changes = dto.Changes;
        pref.StudyDone = dto.StudyDone;
        pref.QuietEnabled = dto.QuietEnabled;
        pref.QuietStart = start;
        pref.QuietEnd = end;
        pref.MutedMemberIds = muted;
        await db.SaveChangesAsync();
        return Ok(ToDto(pref));
    }

    [HttpDelete("devices/{id:int}")]
    public async Task<IActionResult> RemoveDevice(int id)
    {
        var me = await members.GetCurrentAsync();
        if (me == null) return await members.MissingAsync();
        var sub = await db.PushSubscriptions.FirstOrDefaultAsync(s => s.Id == id && s.FamilyId == me.FamilyId);
        if (sub == null) return Err.NotFound();
        if (me.Role != FamilyRole.Parent && sub.MemberId != me.Id)
            return Err.Forbidden("read_only", "Yalnızca kendi cihazlarını kaldırabilirsin.");
        db.PushSubscriptions.Remove(sub);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // Kullanıcının kendi cihazlarına hemen bir deneme bildirimi gönderir.
    [HttpPost("test")]
    public async Task<IActionResult> Test()
    {
        if (!options.Value.Enabled) return Err.BadRequest("push_disabled", "Bildirimler bu sunucuda kapalı.");
        var me = await members.GetCurrentAsync();
        if (me == null) return await members.MissingAsync();
        var app = services.GetRequiredService<IOptions<AppOptions>>().Value;
        var sent = await services.GetRequiredService<PushSender>().SendToMemberAsync(me.Id,
            new PushMessage("Bildirimler çalışıyor 🎉", $"{me.DisplayName}, aileden gelen güncellemeleri buradan göreceksin.", app.Link("/")));
        return Ok(new PushTestResultDto(sent));
    }

    private static PushSettingsDto ToDto(NotificationPreference p) =>
        new(p.StudyAdded, p.ActivityAdded, p.Changes, p.StudyDone, p.QuietEnabled,
            p.QuietStart.ToString("HH:mm"), p.QuietEnd.ToString("HH:mm"), p.MutedMemberIds);

    private static bool TryTime(string? s, out TimeOnly t)
    {
        t = default;
        return s != null && TimeRegex().IsMatch(s) && TimeOnly.TryParseExact(s, "HH:mm", out t);
    }

    private static bool ValidKey(string value, int length, byte? first = null)
    {
        try
        {
            var bytes = Base64Url.Decode(value);
            return bytes.Length == length && (first == null || bytes[0] == first);
        }
        catch (FormatException) { return false; }
    }

    // Yalnızca harf, rakam, boşluk ve birkaç işaret; en fazla 60 karakter.
    private static string CleanLabel(string? label)
    {
        var s = LabelRegex().Replace(label ?? "", "").Trim();
        return s.Length == 0 ? "Cihaz" : s.Length > 60 ? s[..60] : s;
    }

    [GeneratedRegex(@"^\d{2}:\d{2}$")]
    private static partial Regex TimeRegex();
    [GeneratedRegex(@"[^\p{L}\p{N} ·()\-_.]")]
    private static partial Regex LabelRegex();
}
