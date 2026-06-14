using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using FitGeo.Api.Data;
using FitGeo.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace FitGeo.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, IConfiguration config) : ControllerBase
{
    static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest("სახელი სავალდებულოა");

        if (req.Name.ToLower() == "admin")
            return BadRequest("ეს სახელი დაცულია");

        if (await db.Users.AnyAsync(u => u.Name == req.Name))
            return Conflict("ეს სახელი უკვე გამოიყენება");

        var user = new User
        {
            Name = req.Name,
            Age = req.Age,
            Gender = req.Gender ?? "male",
            Height = req.Height,
            Weight = req.Weight,
            Goal = req.Goal,
            Activity = req.Activity,
            IsAdmin = req.Name.ToLower() == "admin",
            PasswordHash = req.Name.ToLower() == "admin" && !string.IsNullOrWhiteSpace(req.Password)
                ? BCrypt.Net.BCrypt.HashPassword(req.Password)
                : BCrypt.Net.BCrypt.HashPassword(req.Name + "_fitgeo")
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        var initialState = BuildInitialState(user);
        var stateRecord = new AppStateRecord
        {
            UserId = user.Id,
            StateJson = JsonSerializer.Serialize(initialState)
        };
        db.AppStates.Add(stateRecord);
        await db.SaveChangesAsync();

        return Ok(new { token = GenerateToken(user), profile = ToProfile(user), state = initialState });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var user = await db.Users
            .Include(u => u.AppState)
            .FirstOrDefaultAsync(u => u.Name == req.Name);

        if (user is null)
            return Unauthorized("მომხმარებელი ვერ მოიძებნა");

        // Admin requires password verification
        if (user.IsAdmin)
        {
            if (string.IsNullOrWhiteSpace(req.Password))
                return Unauthorized("ადმინისთვის პაროლი სავალდებულოა");
            if (!BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
                return Unauthorized("პაროლი არასწორია");
        }

        object? appState = null;
        if (user.AppState is not null)
        {
            try { appState = JsonSerializer.Deserialize<object>(user.AppState.StateJson, JsonOpts); }
            catch { }
        }

        return Ok(new { token = GenerateToken(user), profile = ToProfile(user), state = appState });
    }

    string GenerateToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Name)
        };
        if (user.IsAdmin) claims.Add(new Claim(ClaimTypes.Role, "Admin"));
        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddDays(90),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    static object ToProfile(User u) => new { u.Name, u.Age, u.Gender, u.Height, u.Weight, u.Goal, u.Activity, u.IsAdmin };

    static object BuildInitialState(User user)
    {
        // ── Parse profile values ──────────────────────────────────────
        double.TryParse(user.Weight, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out double w);
        if (w <= 0) w = 75.0;

        double.TryParse(user.Height, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out double h);
        if (h <= 0) h = 170.0;

        int.TryParse(user.Age, out int age);
        if (age <= 0) age = 25;

        bool isFemale = string.Equals(user.Gender, "female", StringComparison.OrdinalIgnoreCase);

        // ── Mifflin-St Jeor BMR ───────────────────────────────────────
        double bmr = 10 * w + 6.25 * h - 5 * age + (isFemale ? -161 : 5);

        // ── Activity multiplier ───────────────────────────────────────
        double mult = user.Activity switch
        {
            "sedentary" => 1.2,
            "light"     => 1.375,
            "moderate"  => 1.55,
            "active"    => 1.725,
            _           => 1.375
        };
        double tdee = bmr * mult;

        // ── Goal adjustment ───────────────────────────────────────────
        if (user.Goal == "lose")  tdee -= 500;
        else if (user.Goal == "gain") tdee += 300;
        int kcalGoal = (int)Math.Round(tdee);

        // ── Macros ────────────────────────────────────────────────────
        int proteinGoal = (int)Math.Round(w * 2.0);               // 2g per kg
        int fatGoal     = (int)Math.Round(tdee * 0.25 / 9.0);    // 25% of kcal
        int carbsGoal   = (int)Math.Round((tdee - proteinGoal * 4.0 - fatGoal * 9.0) / 4.0);

        // ── Water (35ml per kg) ───────────────────────────────────────
        double waterGoal = Math.Round(w * 0.035, 1);

        // ── Weight goal ───────────────────────────────────────────────
        double weightGoal = user.Goal switch
        {
            "lose"  => Math.Round(w - 10, 1),
            "gain"  => Math.Round(w + 5,  1),
            _       => w
        };

        return new
        {
            calories = new { current = 0, goal = kcalGoal },
            protein  = new { current = 0, goal = proteinGoal },
            carbs    = new { current = 0, goal = carbsGoal },
            fat      = new { current = 0, goal = fatGoal },
            water    = new { current = 0.0, goal = waterGoal },
            steps    = new { current = 0, goal = 10000 },
            weight   = new { current = w, goal = weightGoal, history = new[] { w } },
            diary    = new
            {
                breakfast = Array.Empty<object>(),
                lunch     = Array.Empty<object>(),
                dinner    = Array.Empty<object>(),
                snacks    = Array.Empty<object>()
            },
            measurements = new { chest = 0, waist = 0, hips = 0, leftArm = 0, rightArm = 0, leftThigh = 0, rightThigh = 0 },
            chatHistory  = new[] { new { role = "ai", text = $"გამარჯობა {user.Name}! მე ვარ შენი AI დიეტოლოგი. როგორ შემიძლია დაგეხმარო? 🌿" } },
            challenges   = new[]
            {
                new { id = 1, emoji = "🔥", title = "30 Day Challenge",  desc = "30 დღე ვარჯიში",           progress = 0, total = 30,  joined = false },
                new { id = 2, emoji = "👟", title = "10,000 Steps",      desc = "ყოველდღიური მიზანი",       progress = 0, total = 100, joined = false },
                new { id = 3, emoji = "🍬", title = "No Sugar Week",     desc = "7 დღე შაქრის გარეშე",      progress = 0, total = 7,   joined = false }
            },
            achievements = new[]
            {
                new { id = 1, emoji = "⭐", title = "პირველი ნაბიჯი", desc = "პროფილი შეავსე",      earned = true  },
                new { id = 2, emoji = "🏆", title = "-5 კგ",          desc = "5 კგ-ის დაკლება",     earned = false },
                new { id = 3, emoji = "💧", title = "ჰიდრატაცია",     desc = "7 დღე 3ლ წყალი",     earned = false }
            }
        };
    }
}

public record RegisterRequest(string Name, string? Age, string? Gender, string? Height, string? Weight, string? Goal, string? Activity, string? Password);
public record LoginRequest(string Name, string? Password);
