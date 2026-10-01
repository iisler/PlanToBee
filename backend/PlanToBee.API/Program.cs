using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PlanToBee.API.Data;
using PlanToBee.API.Infrastructure;
using PlanToBee.API.Models;
using PlanToBee.API.Services;
using PlanToBee.API.Services.Email;

// Yönetici komutları (ör. `dotnet run -- admin users`): web sunucusu açılmaz, şifreli e-postaları çözüp listeler.
if (args is ["admin", ..])
    return await AdminCli.RunAsync(args[1..]);

var builder = WebApplication.CreateBuilder(args);

// Ayar doğrulaması: üretimde zorunlu ayarlar eksik/hatalıysa API anlaşılır bir mesajla durur (StartupValidation.cs).
var startup = StartupValidation.Run(builder.Configuration, builder.Environment);
if (startup.Errors.Count > 0)
{
    startup.WriteErrors(Console.Error, builder.Environment.EnvironmentName);
    return 1;
}

// Render dinlenecek portu PORT ortam değişkeniyle verir. Geliştirmede launchSettings.json (5002) geçerlidir.
// PORT yoksa konteynerde ASPNETCORE_HTTP_PORTS (Dockerfile: 8080) kullanılır.
if (!builder.Environment.IsDevelopment() && startup.Port is int port)
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// E-posta adresleri veritabanında şifreli tutulur (Infrastructure/PersonalDataProtector.cs).
builder.Services.AddSingleton(new PersonalDataProtector(startup.PersonalDataSecret));
builder.Services.AddDbContext<AppDbContext>(opt => opt.UseNpgsql(startup.ConnectionString));

// Data Protection anahtarları (şifre sıfırlama / e-posta doğrulama linklerini imzalar) veritabanında tutulur;
// konteyner yeniden başlayınca ya da Render uykusundan uyanınca önceden gönderilmiş linkler geçersiz olmaz.
// Anahtarlar veritabanına şifreli yazılır (Infrastructure/KeyEncryption.cs); şifreleme anahtarı ortam değişkenindedir.
var keyEncryptionKey = new KeyEncryptionKey(startup.KeyEncryptionSecret);
builder.Services.AddSingleton(keyEncryptionKey);
builder.Services.AddDataProtection()
    .SetApplicationName("PlanToBee")
    .PersistKeysToDbContext<AppDbContext>();
builder.Services.Configure<KeyManagementOptions>(o => o.XmlEncryptor = new AesGcmXmlEncryptor(keyEncryptionKey));

builder.Services.AddIdentity<User, IdentityRole>(opt =>
{
    opt.Password.RequireDigit = false;
    opt.Password.RequireUppercase = false;
    opt.Password.RequireNonAlphanumeric = false;
    opt.Password.RequiredLength = 6;
    opt.User.RequireUniqueEmail = true;
    // Yeni hesaplarda kullanıcı adı = e-posta (görünen ad ayrı DisplayName alanında).
    // Boş bırakmak karakter kısıtını kaldırır; eski hesapların Türkçe karakterli kullanıcı adları da geçerli kalır.
    opt.User.AllowedUserNameCharacters = "";
    // Giriş için e-posta doğrulaması zorunlu değil (doğrulanmamış kullanıcı token alır ama
    // aile/plan uç noktaları [RequireVerifiedEmail] ile kapalıdır, "E-postanı doğrula" ekranı gösterilir).
    opt.SignIn.RequireConfirmedEmail = false;
    opt.Lockout.MaxFailedAccessAttempts = 5;
    opt.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    opt.Lockout.AllowedForNewUsers = true;
    opt.Tokens.EmailConfirmationTokenProvider = EmailConfirmationTokenProvider<User>.ProviderName;
})
.AddErrorDescriber<TurkishIdentityErrorDescriber>()
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders()
.AddTokenProvider<EmailConfirmationTokenProvider<User>>(EmailConfirmationTokenProvider<User>.ProviderName);

// Şifre sıfırlama bağlantısı 1 saat geçerli (e-posta doğrulama belirteci ayrı: 2 gün).
builder.Services.Configure<DataProtectionTokenProviderOptions>(o => o.TokenLifespan = TimeSpan.FromHours(1));
builder.Services.Configure<EmailConfirmationTokenProviderOptions>(o => o.TokenLifespan = TimeSpan.FromDays(2));

// Uygulama ve e-posta ayarları
builder.Services.Configure<AppOptions>(builder.Configuration.GetSection(AppOptions.Section));
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection(EmailOptions.Section));
// Üretimde Smtp zorunludur (StartupValidation); Log yalnızca geliştirmede kullanılabilir.
if (startup.UseSmtp)
    builder.Services.AddScoped<IAppEmailSender, SmtpEmailSender>();
else
    builder.Services.AddScoped<IAppEmailSender, LogEmailSender>();

builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton<SendThrottle>();
builder.Services.AddSingleton<MissingAccountLockout>();
builder.Services.AddScoped<MemberContext>();
builder.Services.AddScoped<FamilyService>();
builder.Services.AddScoped<AuthTokenService>();
builder.Services.AddPlanToBeeRateLimiting(builder.Configuration);
builder.Services.AddPlanToBeeHealthChecks();

// Anahtar repoda tutulmaz: yerelde `dotnet user-secrets`, sunucuda Jwt__Key ortam değişkeni (StartupValidation kontrol eder).
var jwtKey = startup.JwtKey;
builder.Services.AddAuthentication(opt =>
{
    opt.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    opt.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(opt =>
{
    opt.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        // Erişim belirteci kısa ömürlü (AuthTokenService); varsayılan 5 dk tolerans ömrü fazla uzatırdı.
        ClockSkew = TimeSpan.FromSeconds(30)
    };
    // Şifre değişince (security stamp yenilenir) eski token'lar geçersiz olur.
    opt.Events = new JwtBearerEvents
    {
        OnTokenValidated = async ctx =>
        {
            // Kısa ömürlü belirteçlere geçmeden önce verilen 30 günlük belirteçler kabul edilmez; kullanıcı bir kez
            // yeniden giriş yapar ve yenileme belirteci alır.
            var maxLifetime = TimeSpan.FromMinutes(builder.Configuration.GetValue("Jwt:AccessTokenMinutes", 15) + 1);
            if (ctx.SecurityToken.ValidTo > DateTime.UtcNow + maxLifetime)
            {
                ctx.Fail("Oturum geçersiz");
                return;
            }
            var userManager = ctx.HttpContext.RequestServices.GetRequiredService<UserManager<User>>();
            var userId = ctx.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            var stamp = ctx.Principal?.FindFirstValue(AuthClaims.SecurityStamp);
            var user = userId == null ? null : await userManager.FindByIdAsync(userId);
            if (user == null || stamp == null || stamp != await userManager.GetSecurityStampAsync(user))
            {
                ctx.Fail("Oturum geçersiz");
                return;
            }
            // E-posta doğrulama durumu her istekte veritabanından okunur (doğrulayınca yeni token gerekmez).
            (ctx.Principal!.Identity as ClaimsIdentity)?.AddClaim(
                new Claim(AuthClaims.EmailVerified, user.EmailConfirmed ? "true" : "false"));
        }
    };
});

builder.Services.AddAuthorization();
builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(allowIntegerValues: false)));

// CORS: yalnızca App:FrontendBaseUrl adresinin kökenine (şema + alan adı + port) izin verilir.
var frontendOrigin = new Uri(builder.Configuration[$"{AppOptions.Section}:FrontendBaseUrl"] ?? "http://localhost:5173")
    .GetLeftPart(UriPartial.Authority);
builder.Services.AddCors(opt =>
    opt.AddDefaultPolicy(p =>
        p.WithOrigins(frontendOrigin)
         .AllowAnyHeader()
         .AllowAnyMethod()));

var app = builder.Build();

foreach (var w in startup.Warnings)
    app.Logger.LogWarning("Ayar uyarısı: {Warning}", w);
app.Logger.LogInformation("Ortam: {Environment}, e-posta: {Provider}, forwarded header: {Forwarded} (ForwardLimit={Limit})",
    app.Environment.EnvironmentName, startup.UseSmtp ? "Smtp" : "Log",
    startup.Forwarded.Enabled ? "açık" : "kapalı", startup.Forwarded.ForwardLimit);

// Açılışta bekleyen migration'lar uygulanır (boş veritabanında tüm tablolar oluşur; uygulanmış olanlar atlanır).
try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var pending = db.Database.GetPendingMigrations().ToList();
    if (pending.Count > 0)
        app.Logger.LogInformation("Veritabanı migration'ları uygulanıyor: {Migrations}", string.Join(", ", pending));
    db.Database.Migrate();
    var encrypted = await PersonalDataBackfill.RunAsync(db, scope.ServiceProvider.GetRequiredService<PersonalDataProtector>());
    if (encrypted > 0)
        app.Logger.LogInformation("Şifrelenmemiş {Count} kayıttaki e-posta adresleri şifrelendi.", encrypted);
    app.Logger.LogInformation("Veritabanı hazır.");
}
catch (Exception ex)
{
    // Bağlantı dizesi/şifre loglanmaz; yalnızca hata türü ve Npgsql'in mesajı (sunucu adı içerebilir) yazılır.
    Console.Error.WriteLine("PlanToBee API başlatılamadı: veritabanına bağlanılamadı veya migration uygulanamadı.");
    Console.Error.WriteLine($"  Hata: {ex.GetType().Name}: {ex.Message}");
    Console.Error.WriteLine("  ConnectionStrings__Default değerini, Neon projesinin açık olduğunu ve SSL ayarını kontrol edin (docs/DEPLOY.md > Sorun giderme).");
    return 1;
}

// Proxy (Render) başlıkları her şeyden önce işlenir: rate limit gerçek istemci IP'sini görür.
// Uygulama içinde HTTP->HTTPS yönlendirmesi yapılmaz: bunu Render'ın önündeki proxy yapar. (Render'ın
// sağlık kontrolü konteynere düz HTTP ile gelir; uygulama içi yönlendirme bu kontrolü ve proxy arkasını bozardı.)
app.UsePlanToBeeForwardedHeaders(startup.Forwarded);
if (!app.Environment.IsDevelopment())
    app.UseHsts(); // Yalnızca HTTPS olarak tanınan isteklere (X-Forwarded-Proto: https) HSTS başlığı ekler.

// Yakalanmamış hatalar da diğer hatalarla aynı gövdeyle döner ({ code, message }); ayrıntı (yığın, SQL)
// istemciye gönderilmez, yalnızca sunucu loguna yazılır. CORS başlıkları korunur (CORS OnStarting ile ekler),
// böylece tarayıcı hatayı "Sunucuya ulaşılamadı" yerine anlaşılır mesajla gösterebilir.
app.UseExceptionHandler(errorApp => errorApp.Run(async ctx =>
{
    var ex = ctx.Features.Get<IExceptionHandlerFeature>()?.Error;
    var error = ex is DbUpdateConcurrencyException
        ? (Status: 409, Body: new ApiError("concurrency_conflict", "Kayıt bu sırada değişti. Sayfayı yenileyip tekrar dene."))
        : (Status: 500, Body: new ApiError("server_error", "Beklenmeyen bir hata oluştu. Biraz sonra tekrar dene."));
    ctx.Response.StatusCode = error.Status;
    ctx.Response.Headers.CacheControl = "no-store";
    await ctx.Response.WriteAsJsonAsync(error.Body);
}));

app.MapPlanToBeeHealthChecks();
app.UseCors();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();

app.Run();
return 0;
