namespace FitGeo.Api.Models;

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string? Age { get; set; }
    public string Gender { get; set; } = "male";
    public string? Height { get; set; }
    public string? Weight { get; set; }
    public string? Goal { get; set; }
    public string? Activity { get; set; }
    public bool IsAdmin { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public AppStateRecord? AppState { get; set; }
}
