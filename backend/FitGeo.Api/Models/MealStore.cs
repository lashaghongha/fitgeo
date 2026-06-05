namespace FitGeo.Api.Models;

public class MealStore
{
    public int Id { get; set; }
    public string Category { get; set; } = ""; // breakfast | lunch | dinner | drinks
    public string MealsJson { get; set; } = "[]";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
