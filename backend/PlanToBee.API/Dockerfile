# PlanToBee API üretim imajı (Render: Root Directory = backend/PlanToBee.API, Dockerfile Path = ./Dockerfile).
# Derleme bağlamı bu klasördür; neyin imaja girmediği .dockerignore dosyasında.

# ---- 1. aşama: derleme ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Önce yalnızca proje dosyası: paket geri yükleme katmanı kod değişmedikçe önbellekten gelir.
COPY PlanToBee.API.csproj ./
RUN dotnet restore PlanToBee.API.csproj

COPY . ./
RUN dotnet publish PlanToBee.API.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

# ---- 2. aşama: çalışma zamanı (SDK içermez) ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Üretim ayarları (appsettings.Production.json) ile açılır.
# Render PORT ortam değişkenini verir; uygulama onu okur (Program.cs). PORT yoksa 8080 dinlenir.
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_NOLOGO=1 \
    DOTNET_CLI_TELEMETRY_OPTOUT=1

COPY --from=build /app/publish ./

# Resmi imajdaki yetkisiz "app" kullanıcısı (root olarak çalışmaz).
USER $APP_UID
EXPOSE 8080

ENTRYPOINT ["dotnet", "PlanToBee.API.dll"]
