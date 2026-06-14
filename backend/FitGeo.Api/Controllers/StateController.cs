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
    static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetState()
    {
        var user = await db.Users.Include(u => u.AppState).FirstOrDefaultAsync(u => u.Id == UserId);
        if (user is null) return NotFound();

        object? appState = null;
        if (user.AppState?.StateJson is not null)
        {
            try
            {
                var doc = JsonSerializer.Deserialize<JsonElement>(user.AppState.StateJson, JsonOpts);

                // Detect corrupted weight: if weight.current == 75 (INIT default)
                // but the user registered with a different weight, rebuild state from profile.
                bool needsRepair = false;
                if (doc.TryGetProperty("weight", out var wEl) &&
                    wEl.TryGetProperty("current", out var curEl) &&
                    curEl.TryGetDouble(out double storedW) &&
                    Math.Abs(storedW - 75.0) < 0.1)
                {
                    double.TryParse(user.Weight,
                        System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture,
                        out double profileW);
                    if (profileW > 0 && Math.Abs(profileW - 75.0) > 0.5)
                        needsRepair = true;
                }

                if (needsRepair)
                {
                    // Rebuild correct state from profile, then graft in any daily
                    // progress (calories eaten, diary, water, steps) from the stored state.
                    var fresh = AuthController.BuildInitialState(user);
                    var freshJson = JsonSerializer.Serialize(fresh, JsonOpts);
                    var freshEl = JsonSerializer.Deserialize<JsonElement>(freshJson, JsonOpts);

                    // Merge: take fresh goals/weight but preserve today's progress fields
                    var dict = new Dictionary<string, JsonElement>();
                    foreach (var prop in freshEl.EnumerateObject())
                        dict[prop.Name] = prop.Value;

                    // Overwrite fresh with stored daily-progress fields
                    foreach (var field in new[] { "calories", "protein", "carbs", "fat", "water", "steps", "diary", "chatHistory", "measurements", "challenges", "achievements" })
                    {
                        if (doc.TryGetProperty(field, out var storedField))
                            dict[field] = storedField;
                    }

                    var repairedJson = JsonSerializer.Serialize(dict, JsonOpts);

                    // Persist the repaired state so the corruption is gone permanently
                    user.AppState!.StateJson = repairedJson;
                    user.AppState.UpdatedAt = DateTime.UtcNow;
                    await db.SaveChangesAsync();

                    appState = JsonSerializer.Deserialize<object>(repairedJson, JsonOpts);
                }
                else
                {
                    appState = JsonSerializer.Deserialize<object>(user.AppState.StateJson, JsonOpts);
                }
            }
            catch
            {
                try { appState = JsonSerializer.Deserialize<object>(user.AppState.StateJson, JsonOpts); } catch { }
            }
        }

        return Ok(new
        {
            profile = new { user.Name, user.Age, user.Gender, user.Height, user.Weight, user.Goal, user.Activity, user.IsAdmin },
            appState
        });
    }

    [HttpPut]
    public async Task<IActionResult> SaveState([FromBody] JsonElement body)
    {
        var record = await db.AppStates.FirstOrDefaultAsync(a => a.UserId == UserId);
        var json = body.GetRawText();

        if (record is null)
        {
            db.AppStates.Add(new AppStateRecord { UserId = UserId, StateJson = json, UpdatedAt = DateTime.UtcNow });
        }
        else
        {
            record.StateJson = json;
            record.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        return NoContent();
    }

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

        return Ok(new { user.Name, user.Age, user.Gender, user.Height, user.Weight, user.Goal, user.Activity, user.IsAdmin });
    }
}

public record UpdateProfileRequest(string? Age, string? Gender, string? Height, string? Weight, string? Goal, string? Activity);
