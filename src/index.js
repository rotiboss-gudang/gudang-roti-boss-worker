const GAS_URL = "https://script.google.com/macros/s/AKfycbzwBRzo8fe-0T6zwhxU6OoTHSij8WgcQI9YGGLeEeR-ROI4XkO1pzhBV_1k6O6nY344xw/exec"; // ← ganti ini

export default {
  // ========== Handle request dari frontend ==========
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    try {
      // Buat URL ke GAS
      const gasUrl = GAS_URL + url.search;

      // Cache key
      const cache = caches.default;
      const cacheKey = new Request(gasUrl, request);

      // 1. Coba ambil dari cache dulu (hanya untuk GET)
      if (request.method === "GET") {
        const cached = await cache.match(cacheKey);
        if (cached) {
          const res = new Response(cached.body, cached);
          res.headers.set("Access-Control-Allow-Origin", "*");
          res.headers.set("X-Cache", "HIT");
          return res;
        }
      }

      // 2. Kalau tidak ada cache, tembak GAS
      const gasResponse = await fetch(gasUrl, {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
        },
        body: request.method === "POST" ? await request.text() : null,
      });

      let response = new Response(gasResponse.body, gasResponse);
      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set("X-Cache", "MISS");

      // 3. Simpan ke cache (hanya GET & sukses)
      if (request.method === "GET" && gasResponse.ok) {
        response.headers.set("Cache-Control", "s-maxage=45"); // cache 45 detik
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }

      return response;
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  },

  // ========== Cron Warm-up (setiap 4 menit) ==========
  async scheduled(event, env, ctx) {
    try {
      await fetch(GAS_URL + "?action=ping");
      console.log("✅ GAS warmed up at", new Date().toISOString());
    } catch (err) {
      console.log("❌ Warm-up failed:", err.message);
    }
  },
};
