using System.Text.Json;
using FitGeo.Api.Data;
using FitGeo.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FitGeo.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController(AppDbContext db) : ControllerBase
{
    // GET /api/admin/stats
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var users = await db.Users.ToListAsync();
        var today = DateTime.UtcNow.Date;

        var goalBreakdown = users
            .GroupBy(u => u.Goal ?? "unknown")
            .ToDictionary(g => g.Key, g => g.Count());

        var activityBreakdown = users
            .GroupBy(u => u.Activity ?? "unknown")
            .ToDictionary(g => g.Key, g => g.Count());

        var genderBreakdown = users
            .GroupBy(u => u.Gender)
            .ToDictionary(g => g.Key, g => g.Count());

        return Ok(new
        {
            totalUsers        = users.Count,
            todayRegistered   = users.Count(u => u.CreatedAt.Date == today),
            thisWeek          = users.Count(u => u.CreatedAt >= DateTime.UtcNow.AddDays(-7)),
            goalBreakdown,
            activityBreakdown,
            genderBreakdown
        });
    }

    // GET /api/admin/users?search=&page=1&pageSize=20
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers(
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = db.Users.Include(u => u.AppState).AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(u => u.Name.Contains(search));

        var total = await query.CountAsync();
        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var result = users.Select(u =>
        {
            double calories = 0;
            if (u.AppState != null)
            {
                try
                {
                    var doc = JsonDocument.Parse(u.AppState.StateJson);
                    if (doc.RootElement.TryGetProperty("calories", out var cal) &&
                        cal.TryGetProperty("current", out var cur))
                        calories = cur.GetDouble();
                }
                catch { }
            }
            return new
            {
                u.Id,
                u.Name,
                u.Age,
                u.Gender,
                u.Height,
                u.Weight,
                u.Goal,
                u.Activity,
                u.IsAdmin,
                createdAt = u.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                todayCalories = (int)calories
            };
        });

        return Ok(new { total, page, pageSize, users = result });
    }

    // DELETE /api/admin/users/{id}
    [HttpDelete("users/{id:int}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await db.Users.Include(u => u.AppState).FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return NotFound("მომხმარებელი ვერ მოიძებნა");
        if (user.IsAdmin) return BadRequest("ადმინს ვერ წაშლი");

        if (user.AppState is not null)
            db.AppStates.Remove(user.AppState);

        db.Users.Remove(user);
        await db.SaveChangesAsync();
        return Ok(new { message = $"{user.Name} წაიშალა" });
    }

    // PUT /api/admin/users/{id}/toggle-admin
    [HttpPut("users/{id:int}/toggle-admin")]
    public async Task<IActionResult> ToggleAdmin(int id)
    {
        var user = await db.Users.FindAsync(id);
        if (user is null) return NotFound();
        user.IsAdmin = !user.IsAdmin;
        await db.SaveChangesAsync();
        return Ok(new { user.Id, user.Name, user.IsAdmin });
    }
}
