import { getDb, ensureTables } from "./db.mjs";

export default async (req) => {
  try {
    const sql = getDb();
    await ensureTables(sql);

    const method = req.method;
    const url = new URL(req.url);

    // GET /api/classes — list all classes with computed stats
    if (method === "GET") {
      const rows = await sql`
        SELECT c.id, c.name, c.hourly_rate,
          COALESCE(SUM(l.duration), 0) AS total_hours,
          COALESCE(SUM(l.duration * c.hourly_rate), 0) AS total_earnings,
          COUNT(l.id) AS lecture_count
        FROM classes c
        LEFT JOIN lectures l ON l.class_id = c.id
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `;
      return Response.json(rows);
    }

    // POST /api/classes — create a new class
    if (method === "POST") {
      const body = await req.json();
      const { name, hourlyRate } = body;
      if (!name || !hourlyRate) {
        return Response.json({ error: "name and hourlyRate are required" }, { status: 400 });
      }
      const rows = await sql`
        INSERT INTO classes (name, hourly_rate)
        VALUES (${name}, ${hourlyRate})
        RETURNING id, name, hourly_rate
      `;
      return Response.json(rows[0], { status: 201 });
    }

    // DELETE /api/classes?id=123
    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) {
        return Response.json({ error: "id is required" }, { status: 400 });
      }
      await sql`DELETE FROM classes WHERE id = ${id}`;
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (err) {
    console.error("Classes API error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
};

export const config = {
  path: "/api/classes",
};
