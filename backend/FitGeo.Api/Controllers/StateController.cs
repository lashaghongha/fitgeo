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
            try { appState = JsonSerializer.Deserialize<object>(user.AppState.StateJson, JsonOpts); }
            catch { }
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
}
