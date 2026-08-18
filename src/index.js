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