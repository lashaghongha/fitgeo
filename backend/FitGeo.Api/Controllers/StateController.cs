using System.Security.Claims;
using System.Text.Json;
using FitGeo.Api.Data;
using FitGeo.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FitGeo.Api.Controllers;

[ApiController]
[Route("api/state")]
[Authorize]
public class StateController(AppDbContext db) : ControllerBase
{
    static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // GET /api/state  — returns profile + saved appState
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var user = await db.Users
            .Include(u => u.AppState)
            .FirstOrDefaultAsync(u => u.Id == UserId);

        if (user is null) return NotFound();

        object? appState = null;
        if (user.AppState is not null)
            try { appState = JsonSerializer.Deserialize<object>(user.AppState.StateJson, Json); }
            catch { }

        return Ok(new
        {
            profile = new { user.Name, user.Age, user.Gender, user.Height,
                            user.Weight, user.Goal, user.Activity, user.IsAdmin },
            appState
        });
    }

    // PUT /api/state  — save full appState JSON
    [HttpPut]
    public async Task<IActionResult> Save([FromBody] JsonElement body)
    {
        var record = await db.AppStates.FirstOrDefaultAsync(a => a.UserId == UserId);
        var json   = body.GetRawText();

        if (record is null)
            db.AppStates.Add(new AppStateRecord { UserId = UserId, StateJson = json, UpdatedAt = DateTime.UtcNow });
        else
        {
            record.StateJson  = json;
            record.UpdatedAt  = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        return NoContent();
    }

    // PUT /api/state/profile  — update profile fields (including weight)
    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == UserId);
        if (user is null) return NotFound();

        if (req.Age      is not null) user.Age      = req.Age;
        if (req.Gender   is not null) user.Gender   = req.Gender;
        if (req.Height   is not null) user.Height   = req.Height;
        if (req.Weight   is not null) user.Weight   = req.Weight;
        if (req.Goal     is not null) user.Goal     = req.Goal;
        if (req.Activity is not null) user.Activity = req.Activity;

        await db.SaveChangesAsync();
        return Ok(new { user.Name, user.Age, user.Gender, user.Height,
                        user.Weight, user.Goal, user.Activity, user.IsAdmin });
    }
}

public record UpdateProfileRequest(string? Age, string? Gender, string? Height,
                                    string? Weight, string? Goal, string? Activity);
