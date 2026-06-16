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
    static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    // POST /api/auth/register
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest("სახელი სავალდებულოა");

        if (await db.Users.AnyAsync(u => u.Name == req.Name))
            return Conflict("ეს სახელი უკვე გამოიყენება");

        var user = new User
        {
            Name         = req.Name,
            Age          = req.Age,
            Gender       = req.Gender ?? "male",
            Height       = req.Height,
            Weight       = req.Weight,
            Goal         = req.Goal,
            Activity     = req.Activity,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(
                               string.IsNullOrWhiteSpace(req.Password)
                               ? req.Name + "_fitgeo"
                               : req.Password)
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        // Return token + profile. Frontend builds and saves its own initial state.
        return Ok(new { token = MakeToken(user), profile = Profile(user), appState = (object?)null });
    }

    // POST /api/auth/login
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var user = await db.Users
            .Include(u => u.AppState)
            .FirstOrDefaultAsync(u => u.Name == req.Name);

        if (user is null) return Unauthorized("მომხმარებელი ვერ მოიძებნა");

        var passwordToCheck = string.IsNullOrWhiteSpace(req.Password)
            ? req.Name + "_fitgeo"
            : req.Password;

        if (!BCrypt.Net.BCrypt.Verify(passwordToCheck, user.PasswordHash))
            return Unauthorized("პაროლი არასწორია");

        object? appState = null;
        if (user.AppState is not null)
            try { appState = JsonSerializer.Deserialize<object>(user.AppState.StateJson, Json); }
            catch { }

        return Ok(new { token = MakeToken(user), profile = Profile(user), appState });
    }

    string MakeToken(User user)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Name)
        };
        if (user.IsAdmin) claims.Add(new(ClaimTypes.Role, "Admin"));

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddDays(90),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    static object Profile(User u) =>
        new { u.Name, u.Age, u.Gender, u.Height, u.Weight, u.Goal, u.Activity, u.IsAdmin };
}

public record RegisterRequest(string Name, string? Age, string? Gender, string? Height,
                               string? Weight, string? Goal, string? Activity, string? Password);
public record LoginRequest(string Name, string? Password);
