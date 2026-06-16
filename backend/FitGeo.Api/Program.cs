using System.Text;
using FitGeo.Api.Data;
using FitGeo.Api.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Use Postgres on Railway (DATABASE_URL env var), SQLite locally
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
builder.Services.AddDbContext<AppDbContext>(opt =>
{
    if (!string.IsNullOrEmpty(databaseUrl))
        opt.UseNpgsql(databaseUrl);
    else
        opt.UseSqlite(builder.Configuration.GetConnectionString("Default") ?? "Data Source=fitgeo.db");
});

var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key is not configured");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddControllers();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "FitGeo API",
        Version = "v1",
        Description = "🌿 ქართული AI Fitness Tracker — Backend API"
    });

    // JWT auth ღილაკი Swagger UI-ში
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "შეიყვანე JWT token: **Bearer {token}**"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.SetIsOriginAllowed(origin =>
            {
                var uri = new Uri(origin);
                return uri.Host == "localhost" ||
                       uri.Host.EndsWith(".vercel.app") ||
                       (builder.Configuration["AllowedOrigins"] ?? "")
                           .Split(',', StringSplitOptions.RemoveEmptyEntries)
                           .Contains(origin);
            })
            .AllowAnyHeader()
            .AllowAnyMethod()));

var app = builder.Build();

// auto-migrate on startup + seed meals
using (var scope = app.Services.CreateScope())
{
    var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    ctx.Database.EnsureCreated(); // works for both SQLite and Postgres (no migrations needed)
    await MealSeed.SeedAsync(ctx);
}

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "FitGeo API v1");
    c.RoutePrefix = "swagger";
    c.DocumentTitle = "FitGeo API";
});

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// health check / root
app.MapGet("/", () => Results.Ok(new
{
    app = "FitGeo API",
    version = "1.0.0",
    status = "running",
    endpoints = new[]
    {
        "POST /api/auth/register",
        "POST /api/auth/login",
        "GET  /api/state  (auth)",
        "PUT  /api/state  (auth)"
    },
    frontend = "http://localhost:5174"
}));

app.MapGet("/health", () => Results.Ok(new { status = "healthy", time = DateTime.UtcNow }));

// serve frontend in production
if (!app.Environment.IsDevelopment())
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
    app.MapFallbackToFile("index.html");
}

app.Run();
