namespace FitGeo.Api.Models;

public class AppStateRecord
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string StateJson { get; set; } = "{}";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
}
