const GAS_URL = "https://script.google.com/macros/s/AKfycbzwBRzo8fe-0T6zwhxU6OoTHSij8WgcQI9YGGLeEeR-ROI4XkO1pzhBV_1k6O6nY344xw/exec";

export default {

  // ==========================================================
  // HTTP REQUEST
  // ==========================================================
  async fetch(request, env, ctx) {

    const url = new URL(request.url);


    // ========================================================
    // CORS
    // ========================================================

    if (request.method === "OPTIONS") {

      return new Response(null, {

        headers: {

          "Access-Control-Allow-Origin": "*",

          "Access-Control-Allow-Methods":
            "GET, POST, OPTIONS",

          "Access-Control-Allow-Headers":
            "Content-Type"

        }

      });

    }


    try {

      // ======================================================
      // D1 TEST
      //
      // Endpoint:
      // /api/db-test
      //
      // Tidak melewati GAS.
      // ======================================================

      if (
        request.method === "GET" &&
        url.pathname === "/api/db-test"
      ) {

        const result =
          await env.DB.prepare(`
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
              AND name NOT LIKE 'sqlite_%'
              AND name NOT LIKE '_cf_%'
            ORDER BY name
          `).all();


        return new Response(

          JSON.stringify({

            success: true,

            database:
              "roti-boss-gudang",

            tables:
              result.results.map(
                row => row.name
              )

          }),

          {

            status: 200,

            headers: {

              "Content-Type":
                "application/json",

              "Access-Control-Allow-Origin":
                "*"

            }

          }

        );

      }

// ==========================================================
// D1 — BAHAN
// GET  /api/bahan
// POST /api/bahan
// ==========================================================

if (
  url.pathname === "/api/bahan"
) {

  // --------------------------------------------------------
  // GET — ambil semua bahan
  // --------------------------------------------------------

  if (request.method === "GET") {

    const result = await env.DB.prepare(`
      SELECT
        sku,
        nama,
        kategori,
        stok,
        satuan,
        min_stok AS minStok,
        expired
      FROM bahan
      ORDER BY nama COLLATE NOCASE ASC
    `).all();

    return new Response(
      JSON.stringify({
        success: true,
        data: result.results
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }


  // --------------------------------------------------------
  // POST — tambah bahan
  // --------------------------------------------------------

  if (request.method === "POST") {

    const data = await request.json();

    if (
      !data ||
      !data.sku ||
      !data.nama ||
      !data.satuan
    ) {

      return new Response(
        JSON.stringify({
          success: false,
          message: "SKU, nama, dan satuan wajib diisi"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }


    const sku =
      String(data.sku).trim();

    const nama =
      String(data.nama).trim();

    const kategori =
      String(data.kategori || "").trim();

    const stok =
      Number(data.stok) || 0;

    const satuan =
      String(data.satuan).trim();

    const minStok =
      Number(data.minStok) || 0;

    const expired =
      data.expired
        ? String(data.expired).trim()
        : null;


    // ------------------------------------------------------
    // INSERT
    // ------------------------------------------------------

    await env.DB.prepare(`
      INSERT INTO bahan (
        sku,
        nama,
        kategori,
        stok,
        satuan,
        min_stok,
        expired
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        sku,
        nama,
        kategori,
        stok,
        satuan,
        minStok,
        expired
      )
      .run();


    return new Response(
      JSON.stringify({
        success: true,
        message: "Bahan berhasil ditambahkan",
        data: {
          sku,
          nama,
          kategori,
          stok,
          satuan,
          minStok,
          expired
        }
      }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }


  // --------------------------------------------------------
  // METHOD TIDAK DIDUKUNG
  // --------------------------------------------------------

  return new Response(
    JSON.stringify({
      success: false,
      message: "Method tidak didukung"
    }),
    {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}


      // ======================================================
      // ROUTE LAMA → GAS
      //
      // Semua endpoint existing tetap lewat sini.
      // ======================================================

      const gasUrl =
        GAS_URL + url.search;


      // ======================================================
      // CACHE
      // ======================================================

      const cache =
        caches.default;

      const cacheKey =
        new Request(
          gasUrl,
          request
        );


      // ======================================================
      // CACHE HIT
      // ======================================================

      if (
        request.method === "GET"
      ) {

        const cached =
          await cache.match(
            cacheKey
          );


        if (cached) {

          const res =
            new Response(
              cached.body,
              cached
            );


          res.headers.set(
            "Access-Control-Allow-Origin",
            "*"
          );


          res.headers.set(
            "X-Cache",
            "HIT"
          );


          return res;

        }

      }


      // ======================================================
      // REQUEST KE GAS
      // ======================================================

      const gasResponse =
        await fetch(

          gasUrl,

          {

            method:
              request.method,

            headers: {

              "Content-Type":
                "application/json"

            },

            body:
              request.method === "POST"
                ? await request.text()
                : null

          }

        );


      // ======================================================
      // RESPONSE GAS
      // ======================================================

      let response =
        new Response(
          gasResponse.body,
          gasResponse
        );


      response.headers.set(
        "Access-Control-Allow-Origin",
        "*"
      );


      response.headers.set(
        "X-Cache",
        "MISS"
      );


      // ======================================================
      // CACHE GET
      // ======================================================

      if (
        request.method === "GET" &&
        gasResponse.ok
      ) {

        response.headers.set(
          "Cache-Control",
          "s-maxage=45"
        );


        ctx.waitUntil(

          cache.put(
            cacheKey,
            response.clone()
          )

        );

      }


      return response;


    } catch (err) {

      return new Response(

        JSON.stringify({

          success: false,

          error:
            err.message

        }),

        {

          status: 500,

          headers: {

            "Content-Type":
              "application/json",

            "Access-Control-Allow-Origin":
              "*"

          }

        }

      );

    }

  },


  // ==========================================================
  // CRON WARM-UP
  //
  // TETAP SAMA.
  // Jangan dihapus.
  // ==========================================================

  async scheduled(
    event,
    env,
    ctx
  ) {

    try {

      await fetch(
        GAS_URL +
        "?action=ping"
      );


      console.log(
        "✅ GAS warmed up at",
        new Date().toISOString()
      );


    } catch (err) {

      console.log(
        "❌ Warm-up failed:",
        err.message
      );

    }

  }

};