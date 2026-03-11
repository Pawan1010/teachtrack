import { getDb, ensureTables } from "./db.mjs";

export default async (req) => {
  try {
    const sql = getDb();
    await ensureTables(sql);

    const method = req.method;
    const url = new URL(req.url);

    // GET /api/lectures?month=2026-03  (optional filter)
    if (method === "GET") {
      const month = url.searchParams.get("month");
      let rows;
      if (month) {
        rows = await sql`
          SELECT l.id, l.class_id, c.name AS class_name, c.hourly_rate,
            l.date, l.duration, l.topic, l.paid,
            (l.duration * c.hourly_rate) AS earnings
          FROM lectures l
          JOIN classes c ON c.id = l.class_id
          WHERE TO_CHAR(l.date, 'YYYY-MM') = ${month}
          ORDER BY l.date DESC
        `;
      } else {
        rows = await sql`
          SELECT l.id, l.class_id, c.name AS class_name, c.hourly_rate,
            l.date, l.duration, l.topic, l.paid,
            (l.duration * c.hourly_rate) AS earnings
          FROM lectures l
          JOIN classes c ON c.id = l.class_id
          ORDER BY l.date DESC
        `;
      }
      return Response.json(rows);
    }

    // POST /api/lectures — create a lecture
    if (method === "POST") {
      const body = await req.json();
      const { classId, date, duration, topic, paid } = body;
      if (!classId || !date || !duration) {
        return Response.json(
          { error: "classId, date, and duration are required" },
          { status: 400 }
        );
      }
      const rows = await sql`
        INSERT INTO lectures (class_id, date, duration, topic, paid)
        VALUES (${classId}, ${date}, ${duration}, ${topic || ""}, ${paid || false})
        RETURNING id, class_id, date, duration, topic, paid
      `;
      return Response.json(rows[0], { status: 201 });
    }

    // PUT /api/lectures?id=123 — toggle payment status
    if (method === "PUT") {
      const id = url.searchParams.get("id");
      if (!id) {
        return Response.json({ error: "id is required" }, { status: 400 });
      }
      const rows = await sql`
        UPDATE lectures SET paid = NOT paid WHERE id = ${id}
        RETURNING id, paid
      `;
      if (rows.length === 0) {
        return Response.json({ error: "Lecture not found" }, { status: 404 });
      }
      return Response.json(rows[0]);
    }

    // DELETE /api/lectures?id=123
    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) {
        return Response.json({ error: "id is required" }, { status: 400 });
      }
      await sql`DELETE FROM lectures WHERE id = ${id}`;
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (err) {
    console.error("Lectures API error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
};

export const config = {
  path: "/api/lectures",
};
