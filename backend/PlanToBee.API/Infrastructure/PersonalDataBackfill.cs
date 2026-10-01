using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using PlanToBee.API.Data;

namespace PlanToBee.API.Infrastructure;

// E-posta şifrelemesinden önce yazılmış kayıtları (açık metin e-posta / kullanıcı adı) bir kerelik şifreler.
// Açılışta migration'lardan sonra çalışır; şifrelenecek kayıt kalmadıysa hiçbir şey yapmaz.
// Şifreleme anahtarı veritabanında olmadığı için bu adım SQL migration'ı olarak yazılamaz.
// Loglara yalnızca kayıt sayısı yazılır, adresler yazılmaz.
public static class PersonalDataBackfill
{
    private sealed record Column(string Name, bool Index);

    private static readonly (string Table, Column[] Columns)[] Targets =
    [
        ("Users", [new("Email", false), new("UserName", false), new("NormalizedEmail", true), new("NormalizedUserName", true)]),
        ("Invitations", [new("Email", false), new("NormalizedEmail", true)]),
    ];

    public static async Task<int> RunAsync(AppDbContext db, PersonalDataProtector protector)
    {
        var conn = db.Database.GetDbConnection();
        var opened = conn.State != System.Data.ConnectionState.Open;
        if (opened) await conn.OpenAsync();
        try
        {
            await using var tx = await conn.BeginTransactionAsync();
            var total = 0;
            foreach (var (table, columns) in Targets)
                total += await BackfillTable(conn, tx, protector, table, columns);
            await tx.CommitAsync();
            return total;
        }
        finally
        {
            if (opened) await conn.CloseAsync();
        }
    }

    private static async Task<int> BackfillTable(DbConnection conn, DbTransaction tx, PersonalDataProtector protector, string table, Column[] columns)
    {
        // Öneki olmayan (henüz dönüştürülmemiş) en az bir alanı olan satırlar
        var pending = string.Join(" OR ", columns.Select(c =>
            $"(\"{c.Name}\" IS NOT NULL AND \"{c.Name}\" NOT LIKE '{(c.Index ? "h1:" : "e1:")}%')"));
        var select = $"SELECT \"Id\", {string.Join(", ", columns.Select(c => $"\"{c.Name}\""))} FROM \"{table}\" WHERE {pending}";

        var rows = new List<(object Id, string?[] Values)>();
        await using (var cmd = conn.CreateCommand())
        {
            cmd.Transaction = tx;
            cmd.CommandText = select;
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var values = new string?[columns.Length];
                for (var i = 0; i < columns.Length; i++)
                    values[i] = reader.IsDBNull(i + 1) ? null : reader.GetString(i + 1);
                rows.Add((reader.GetValue(0), values));
            }
        }

        foreach (var (id, values) in rows)
        {
            await using var cmd = conn.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = $"UPDATE \"{table}\" SET {string.Join(", ", columns.Select((c, i) => $"\"{c.Name}\" = @p{i}"))} WHERE \"Id\" = @id";
            for (var i = 0; i < columns.Length; i++)
            {
                var converted = columns[i].Index ? protector.Index(values[i]) : protector.Encrypt(values[i]);
                AddParameter(cmd, $"@p{i}", converted);
            }
            AddParameter(cmd, "@id", id);
            await cmd.ExecuteNonQueryAsync();
        }
        return rows.Count;
    }

    private static void AddParameter(DbCommand cmd, string name, object? value)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = name;
        p.Value = value ?? DBNull.Value;
        cmd.Parameters.Add(p);
    }
}
