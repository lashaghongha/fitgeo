FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY FitGeo.Api/FitGeo.Api.csproj FitGeo.Api/
RUN dotnet restore FitGeo.Api/FitGeo.Api.csproj
COPY FitGeo.Api/ FitGeo.Api/
RUN dotnet publish FitGeo.Api/FitGeo.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# SQLite DB will be stored in /data (mount a Railway volume here)
RUN mkdir -p /data
ENV ConnectionStrings__Default="Data Source=/data/fitgeo.db"

EXPOSE 8080
# Railway sets $PORT at runtime; ASP.NET Core reads ASPNETCORE_URLS
CMD PORT=${PORT:-8080} && ASPNETCORE_URLS="http://+:$PORT" dotnet FitGeo.Api.dll
