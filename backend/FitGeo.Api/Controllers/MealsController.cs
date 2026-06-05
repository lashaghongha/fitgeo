using System.Text.Json;
using FitGeo.Api.Data;
using FitGeo.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FitGeo.Api.Controllers;

[ApiController]
[Route("api/meals")]
public class MealsController(AppDbContext db) : ControllerBase
{
    static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };
    static readonly string[] Categories = ["breakfast", "lunch", "dinner", "drinks"];

    // GET /api/meals  — public, returns all 4 categories
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var stores = await db.MealStores.ToListAsync();
        var result = new Dictionary<string, object>();
        foreach (var cat in Categories)
        {
            var row = stores.FirstOrDefault(s => s.Category == cat);
            var parsed = row is not null
                ? JsonSerializer.Deserialize<object>(row.MealsJson, JsonOpts)
                : (object)Array.Empty<object>();
            result[cat] = parsed ?? Array.Empty<object>();
        }
        return Ok(result);
    }

    // GET /api/meals/{category}
    [HttpGet("{category}")]
    public async Task<IActionResult> GetCategory(string category)
    {
        if (!Categories.Contains(category)) return BadRequest("Invalid category");
        var row = await db.MealStores.FirstOrDefaultAsync(s => s.Category == category);
        if (row is null) return Ok(Array.Empty<object>());
        var parsed = JsonSerializer.Deserialize<object>(row.MealsJson, JsonOpts);
        return Ok(parsed);
    }

    // POST /api/meals/{category}/item  — admin only, add a meal
    [HttpPost("{category}/item")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddItem(string category, [FromBody] JsonElement item)
    {
        if (!Categories.Contains(category)) return BadRequest("Invalid category");
        var row = await db.MealStores.FirstOrDefaultAsync(s => s.Category == category);
        if (row is null) return NotFound("Category store not initialised");

        var list = JsonSerializer.Deserialize<List<JsonElement>>(row.MealsJson, JsonOpts) ?? [];
        list.Add(item);
        row.MealsJson = JsonSerializer.Serialize(list);
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = "დაემატა", count = list.Count });
    }

    // PUT /api/meals/{category}/item/{id}  — admin only, update a meal by id field
    [HttpPut("{category}/item/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateItem(string category, string id, [FromBody] JsonElement item)
    {
        if (!Categories.Contains(category)) return BadRequest("Invalid category");
        var row = await db.MealStores.FirstOrDefaultAsync(s => s.Category == category);
        if (row is null) return NotFound();

        var list = JsonSerializer.Deserialize<List<JsonElement>>(row.MealsJson, JsonOpts) ?? [];
        var idx = list.FindIndex(m =>
            m.TryGetProperty("id", out var idProp) && idProp.GetString() == id);
        if (idx < 0) return NotFound("კერძი ვერ მოიძებნა");

        list[idx] = item;
        row.MealsJson = JsonSerializer.Serialize(list);
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = "განახლდა" });
    }

    // DELETE /api/meals/{category}/item/{id}  — admin only
    [HttpDelete("{category}/item/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteItem(string category, string id)
    {
        if (!Categories.Contains(category)) return BadRequest("Invalid category");
        var row = await db.MealStores.FirstOrDefaultAsync(s => s.Category == category);
        if (row is null) return NotFound();

        var list = JsonSerializer.Deserialize<List<JsonElement>>(row.MealsJson, JsonOpts) ?? [];
        var before = list.Count;
        list.RemoveAll(m => m.TryGetProperty("id", out var idProp) && idProp.GetString() == id);
        if (list.Count == before) return NotFound("კერძი ვერ მოიძებნა");

        row.MealsJson = JsonSerializer.Serialize(list);
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = "წაიშალა" });
    }
}
