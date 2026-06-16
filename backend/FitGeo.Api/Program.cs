using System.Text;
using FitGeo.Api.Data;
using FitGeo.Api.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// ── Database ────────────────────────────────────────────────────────────────
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");

builder.Services.AddDbContext<AppDbContext>(opt =>
{
    if (!string.IsNullOrEmpty(databaseUrl))
    {
        // Railway injects postgresql://user:pass@host:port/db
        var uri      = new Uri(databaseUrl);
        var userInfo = uri.UserInfo.Split(':');
        var connStr  = $"Host={uri.Host};Port={uri.Port};" +
                       $"Database={uri.AbsolutePath.TrimStart('/')};" +
                       $"Username={userInfo[0]};Password={userInfo[1]};" +
                       $"SSL Mode=Require;Trust Server Certificate=true;";
        opt.UseNpgsql(connStr);
    }
    else
    {
        opt.UseSqlite("Data Source=fitgeo.db");
    }
});

// ── JWT Auth ────────────────────────────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key is not configured");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateIssuer           = false,
            ValidateAudience         = false,
            ClockSkew                = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddControllers();

// ── CORS ────────────────────────────────────────────────────────────────────
builder.Services.AddCors(opt =>
    opt.AddDefaultPolicy(policy =>
        policy.SetIsOriginAllowed(origin =>
        {
            var host = new Uri(origin).Host;
            return host == "localhost"
                || host.EndsWith(".vercel.app")
                || (builder.Configuration["AllowedOrigins"] ?? "")
                    .Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Contains(origin);
        })
        .AllowAnyHeader()
        .AllowAnyMethod()));

var app = builder.Build();

// ── Schema + Seed ───────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // Check if our tables exist; create them if not
    bool tablesExist;
    try   { await ctx.Users.AnyAsync(); tablesExist = true; }
    catch { tablesExist = false; }

    if (!tablesExist)
    {
        var script = ctx.Database.GenerateCreateScript();
        await ctx.Database.ExecuteSqlRawAsync(script);
    }

    // Seed meals if empty
    await MealSeed.SeedAsync(ctx);
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.MapGet("/",       () => Results.Ok(new { app = "FitGeo API", status = "running" }));
app.MapGet("/health", () => Results.Ok(new { status = "healthy", time = DateTime.UtcNow }));

app.Run();
