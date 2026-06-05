using FitGeo.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FitGeo.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<AppStateRecord> AppStates => Set<AppStateRecord>();
    public DbSet<MealStore> MealStores => Set<MealStore>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasOne(u => u.AppState)
            .WithOne(a => a.User)
            .HasForeignKey<AppStateRecord>(a => a.UserId);

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Name)
            .IsUnique();
    }
}
