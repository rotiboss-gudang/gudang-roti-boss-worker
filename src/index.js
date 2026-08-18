const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzwBRzo8fe-0T6zwhxU6OoTHSij8WgcQI9YGGLeEeR-ROI4XkO1pzhBV_1k6O6nY344xw/exec";


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
            "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type"
        }
      });

    }


    try {

      // ======================================================
      // D1 TEST
      // GET /api/db-test
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


        return json({
          success: true,
          database: "roti-boss-gudang",
          tables: result.results.map(
            row => row.name
          )
        });

      }


      // ======================================================
      // D1 — BAHAN
      // ======================================================

      if (url.pathname === "/api/bahan") {


        // ====================================================
        // GET — SEMUA BAHAN
        // ====================================================

        if (request.method === "GET") {

          const result =
            await env.DB.prepare(`
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


          return json({
            success: true,
            data: result.results
          });

        }


        // ====================================================
        // POST — TAMBAH BAHAN
        // ====================================================

        if (request.method === "POST") {

          const data =
            await request.json();


          if (
            !data ||
            !data.sku ||
            !data.nama ||
            !data.satuan
          ) {

            return json({
              success: false,
              message:
                "SKU, nama, dan satuan wajib diisi"
            }, 400);

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

          const petugas =
            String(data.petugas || "").trim();


          if (stok < 0) {

            return json({
              success: false,
              message:
                "Stok tidak boleh negatif"
            }, 400);

          }


          // --------------------------------------------------
          // INSERT BAHAN
          // --------------------------------------------------

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


          // --------------------------------------------------
          // CATAT STOK AWAL
          // --------------------------------------------------

          if (stok > 0) {

            await env.DB.prepare(`
              INSERT INTO transaksi (
                id_transaksi,
                timestamp,
                tipe,
                sku,
                nama,
                qty,
                satuan,
                stok_lama,
                stok_akhir,
                keterangan,
                petugas
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              crypto.randomUUID(),
              new Date().toISOString(),
              "Masuk",
              sku,
              nama,
              stok,
              satuan,
              0,
              stok,
              "Stok awal",
              petugas
            )
            .run();

          }


          return json({
            success: true,
            message:
              "Bahan berhasil ditambahkan",
            data: {
              sku,
              nama,
              kategori,
              stok,
              satuan,
              minStok,
              expired,
              petugas
            }
          }, 201);

        }


        // ====================================================
        // PUT — UPDATE BAHAN
        // ====================================================

        if (request.method === "PUT") {

          const data =
            await request.json();


          if (!data || !data.sku) {

            return json({
              success: false,
              message: "SKU wajib diisi"
            }, 400);

          }


          const sku =
            String(data.sku).trim();

          const nama =
            String(data.nama || "").trim();

          const kategori =
            String(data.kategori || "").trim();

          const stok =
            Number(data.stok) || 0;

          const satuan =
            String(data.satuan || "").trim();

          const minStok =
            Number(data.minStok) || 0;

          const expired =
            data.expired
              ? String(data.expired).trim()
              : null;


          if (stok < 0) {

            return json({
              success: false,
              message:
                "Stok tidak boleh negatif"
            }, 400);

          }


          const result =
            await env.DB.prepare(`
              UPDATE bahan
              SET
                nama = ?,
                kategori = ?,
                stok = ?,
                satuan = ?,
                min_stok = ?,
                expired = ?
              WHERE sku = ?
            `)
            .bind(
              nama,
              kategori,
              stok,
              satuan,
              minStok,
              expired,
              sku
            )
            .run();


          if (result.meta.changes === 0) {

            return json({
              success: false,
              message:
                "SKU tidak ditemukan"
            }, 404);

          }


          return json({
            success: true,
            message:
              "Bahan berhasil diupdate"
          });

        }


        // ====================================================
        // DELETE — HAPUS BAHAN
        // ====================================================

        if (request.method === "DELETE") {

          const data =
            await request.json();


          if (!data || !data.sku) {

            return json({
              success: false,
              message:
                "SKU wajib diisi"
            }, 400);

          }


          const sku =
            String(data.sku).trim();


          const result =
            await env.DB.prepare(`
              DELETE FROM bahan
              WHERE sku = ?
            `)
            .bind(sku)
            .run();


          if (result.meta.changes === 0) {

            return json({
              success: false,
              message:
                "SKU tidak ditemukan"
            }, 404);

          }


          return json({
            success: true,
            message:
              "Bahan berhasil dihapus"
          });

        }


        return json({
          success: false,
          message:
            "Method tidak didukung"
        }, 405);

      }


      // ======================================================
      // D1 — RESEP
      // ======================================================

      if (url.pathname === "/api/resep") {


        // ====================================================
        // GET
        // ====================================================

        if (request.method === "GET") {

          const result =
            await env.DB.prepare(`
              SELECT
                produk,
                sku,
                qty_per_batch AS qtyPerBatch
              FROM resep
              ORDER BY
                produk COLLATE NOCASE ASC,
                sku COLLATE NOCASE ASC
            `).all();


          return json({
            success: true,
            data: result.results
          });

        }


        // ====================================================
        // POST
        // ====================================================

        if (request.method === "POST") {

          const data =
            await request.json();


          if (
            !data ||
            !data.produk ||
            !data.sku ||
            data.qtyPerBatch === undefined
          ) {

            return json({
              success: false,
              message:
                "Produk, SKU, dan qtyPerBatch wajib diisi"
            }, 400);

          }


          const produk =
            String(data.produk).trim();

          const sku =
            String(data.sku).trim();

          const qtyPerBatch =
            Number(data.qtyPerBatch);


          if (
            !produk ||
            !sku ||
            !Number.isFinite(qtyPerBatch) ||
            qtyPerBatch <= 0
          ) {

            return json({
              success: false,
              message:
                "Data resep tidak valid"
            }, 400);

          }


          const bahan =
            await env.DB.prepare(`
              SELECT sku
              FROM bahan
              WHERE sku = ?
            `)
            .bind(sku)
            .first();


          if (!bahan) {

            return json({
              success: false,
              message:
                "SKU bahan tidak ditemukan"
            }, 404);

          }


          await env.DB.prepare(`
            INSERT INTO resep (
              produk,
              sku,
              qty_per_batch
            )
            VALUES (?, ?, ?)
          `)
          .bind(
            produk,
            sku,
            qtyPerBatch
          )
          .run();


          return json({
            success: true,
            message:
              "Resep berhasil ditambahkan",
            data: {
              produk,
              sku,
              qtyPerBatch
            }
          }, 201);

        }


        // ====================================================
        // PUT
        // ====================================================

        if (request.method === "PUT") {

          const data =
            await request.json();


          if (
            !data ||
            !data.produk ||
            !data.sku ||
            data.qtyPerBatch === undefined
          ) {

            return json({
              success: false,
              message:
                "Produk, SKU, dan qtyPerBatch wajib diisi"
            }, 400);

          }


          const produk =
            String(data.produk).trim();

          const sku =
            String(data.sku).trim();

          const qtyPerBatch =
            Number(data.qtyPerBatch);


          if (
            !Number.isFinite(qtyPerBatch) ||
            qtyPerBatch <= 0
          ) {

            return json({
              success: false,
              message:
                "qtyPerBatch harus lebih dari 0"
            }, 400);

          }


          const result =
            await env.DB.prepare(`
              UPDATE resep
              SET qty_per_batch = ?
              WHERE produk = ?
                AND sku = ?
            `)
            .bind(
              qtyPerBatch,
              produk,
              sku
            )
            .run();


          if (result.meta.changes === 0) {

            return json({
              success: false,
              message:
                "Item resep tidak ditemukan"
            }, 404);

          }


          return json({
            success: true,
            message:
              "Resep berhasil diupdate",
            data: {
              produk,
              sku,
              qtyPerBatch
            }
          });

        }


        // ====================================================
        // DELETE
        // ====================================================

        if (request.method === "DELETE") {

          const data =
            await request.json();


          if (
            !data ||
            !data.produk ||
            !data.sku
          ) {

            return json({
              success: false,
              message:
                "Produk dan SKU wajib diisi"
            }, 400);

          }


          const produk =
            String(data.produk).trim();

          const sku =
            String(data.sku).trim();


          const result =
            await env.DB.prepare(`
              DELETE FROM resep
              WHERE produk = ?
                AND sku = ?
            `)
            .bind(
              produk,
              sku
            )
            .run();


          if (result.meta.changes === 0) {

            return json({
              success: false,
              message:
                "Item resep tidak ditemukan"
            }, 404);

          }


          return json({
            success: true,
            message:
              "Resep berhasil dihapus"
          });

        }


        return json({
          success: false,
          message:
            "Method tidak didukung"
        }, 405);

      }


      // ======================================================
      // D1 — PRODUKSI
      // POST /api/produksi
      // ======================================================

      if (
        url.pathname === "/api/produksi" &&
        request.method === "POST"
      ) {

        const data =
          await request.json();


        if (
          !data ||
          !data.produk ||
          data.jumlahBatch === undefined ||
          !data.petugas
        ) {

          return json({
            success: false,
            message:
              "Produk, jumlah batch, dan petugas wajib diisi"
          }, 400);

        }


        const produk =
          String(data.produk).trim();

        const jumlahBatch =
          Number(data.jumlahBatch);

        const petugas =
          String(data.petugas).trim();


        if (
          !produk ||
          !Number.isFinite(jumlahBatch) ||
          jumlahBatch <= 0
        ) {

          return json({
            success: false,
            message:
              "Jumlah batch tidak valid"
          }, 400);

        }


        // ----------------------------------------------------
        // AMBIL RESEP
        // ----------------------------------------------------

        const resep =
          await env.DB.prepare(`
            SELECT
              r.sku,
              r.qty_per_batch,
              b.nama,
              b.stok,
              b.satuan
            FROM resep r
            INNER JOIN bahan b
              ON b.sku = r.sku
            WHERE r.produk = ?
            ORDER BY r.sku
          `)
          .bind(produk)
          .all();


        if (
          !resep.results ||
          resep.results.length === 0
        ) {

          return json({
            success: false,
            message:
              `Resep "${produk}" belum tersedia`
          }, 404);

        }


        // ----------------------------------------------------
        // CEK SEMUA STOK DULU
        // ----------------------------------------------------

        const kebutuhan = [];


        for (const item of resep.results) {

          const qty =
            Number(item.qty_per_batch) *
            jumlahBatch;

          const stok =
            Number(item.stok) || 0;


          if (stok < qty) {

            return json({
              success: false,
              message:
                `Stok ${item.nama} tidak cukup. ` +
                `Butuh ${qty} ${item.satuan}, ` +
                `tersedia ${stok} ${item.satuan}.`
            }, 400);

          }


          kebutuhan.push({
            sku: item.sku,
            nama: item.nama,
            qty,
            satuan: item.satuan,
            stokLama: stok,
            stokAkhir: stok - qty
          });

        }


        // ----------------------------------------------------
        // UPDATE + TRANSAKSI
        // ----------------------------------------------------

        const statements = [];


        for (const item of kebutuhan) {

          statements.push(
            env.DB.prepare(`
              UPDATE bahan
              SET stok = ?
              WHERE sku = ?
            `)
            .bind(
              item.stokAkhir,
              item.sku
            )
          );


          statements.push(
            env.DB.prepare(`
              INSERT INTO transaksi (
                id_transaksi,
                timestamp,
                tipe,
                sku,
                nama,
                qty,
                satuan,
                stok_lama,
                stok_akhir,
                keterangan,
                petugas
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              crypto.randomUUID(),
              new Date().toISOString(),
              "Keluar",
              item.sku,
              item.nama,
              item.qty,
              item.satuan,
              item.stokLama,
              item.stokAkhir,
              `Produksi ${produk} (${jumlahBatch} batch)`,
              petugas
            )
          );

        }


        await env.DB.batch(statements);


        return json({
          success: true,
          message:
            `Produksi "${produk}" ${jumlahBatch} batch berhasil.`,
          data: {
            produk,
            jumlahBatch,
            petugas,
            bahan: kebutuhan.map(item => ({
              sku: item.sku,
              nama: item.nama,
              qty: item.qty,
              satuan: item.satuan,
              stokAkhir: item.stokAkhir
            }))
          }
        });

      }


      // ======================================================
      // D1 — TRANSAKSI
      // GET /api/transaksi
      // ======================================================

      if (
        url.pathname === "/api/transaksi" &&
        request.method === "GET"
      ) {

        const result =
          await env.DB.prepare(`
            SELECT
              id_transaksi,
              timestamp,
              tipe,
              sku,
              nama,
              qty,
              satuan,
              stok_lama AS stokLama,
              stok_akhir AS stokAkhir,
              keterangan,
              petugas
            FROM transaksi
            ORDER BY timestamp DESC
            LIMIT 200
          `).all();


        return json({
          success: true,
          data: result.results
        });

      }


      // ======================================================
      // D1 — TRANSAKSI
      // POST /api/transaksi
      //
      // MODE 1:
      // idTransaksi -> BATALKAN
      //
      // MODE 2:
      // sku + tipe + qty -> SIMPAN
      // ======================================================

      if (
        url.pathname === "/api/transaksi" &&
        request.method === "POST"
      ) {

        const data =
          await request.json();


        const idTransaksi =
          String(
            data?.idTransaksi ||
            data?.id_transaksi ||
            ""
          ).trim();


        // ====================================================
        // MODE 1 — BATALKAN TRANSAKSI
        // ====================================================

        if (idTransaksi) {

          const transaksi =
            await env.DB.prepare(`
              SELECT
                id_transaksi,
                tipe,
                sku,
                nama,
                qty,
                satuan,
                stok_lama,
                stok_akhir,
                keterangan,
                petugas
              FROM transaksi
              WHERE id_transaksi = ?
            `)
            .bind(idTransaksi)
            .first();


          if (!transaksi) {

            return json({
              success: false,
              message:
                "Transaksi tidak ditemukan"
            }, 404);

          }


          if (
            String(transaksi.keterangan || "")
              .includes("[DIBATALKAN]")
          ) {

            return json({
              success: false,
              message:
                "Transaksi ini sudah dibatalkan"
            }, 400);

          }


          const bahan =
            await env.DB.prepare(`
              SELECT
                sku,
                stok,
                satuan
              FROM bahan
              WHERE sku = ?
            `)
            .bind(transaksi.sku)
            .first();


          if (!bahan) {

            return json({
              success: false,
              message:
                `Bahan ${transaksi.sku} tidak ditemukan`
            }, 404);

          }


          const stokSekarang =
            Number(bahan.stok) || 0;

          const qty =
            Number(transaksi.qty) || 0;


          let stokBaru;


          if (transaksi.tipe === "Keluar") {

            stokBaru =
              stokSekarang + qty;

          }

          else if (
            transaksi.tipe === "Masuk"
          ) {

            stokBaru =
              stokSekarang - qty;


            if (stokBaru < 0) {

              return json({
                success: false,
                message:
                  `Pembatalan ditolak. Stok ${transaksi.nama} ` +
                  `sekarang ${stokSekarang} ${bahan.satuan}, ` +
                  `tetapi perlu mengurangi ${qty} ${transaksi.satuan}.`
              }, 400);

            }

          }

          else if (
            transaksi.tipe === "Rusak-Expired"
          ) {

            stokBaru =
              stokSekarang + qty;

          }

          else {

            return json({
              success: false,
              message:
                `Tipe transaksi "${transaksi.tipe}" ` +
                `belum bisa dibatalkan`
            }, 400);

          }


          const keteranganBaru =
            `${transaksi.keterangan || ""} [DIBATALKAN]`;


          await env.DB.batch([

            env.DB.prepare(`
              UPDATE bahan
              SET stok = ?
              WHERE sku = ?
            `)
            .bind(
              stokBaru,
              transaksi.sku
            ),


            env.DB.prepare(`
              UPDATE transaksi
              SET keterangan = ?
              WHERE id_transaksi = ?
            `)
            .bind(
              keteranganBaru,
              idTransaksi
            )

          ]);


          return json({
            success: true,
            message:
              `Transaksi berhasil dibatalkan. ` +
              `Stok ${transaksi.nama}: ` +
              `${stokSekarang} → ${stokBaru} ${bahan.satuan}.`,
            data: {
              idTransaksi,
              sku: transaksi.sku,
              tipe: transaksi.tipe,
              qty,
              stokLama: stokSekarang,
              stokAkhir: stokBaru
            }
          });

        }


        // ====================================================
        // MODE 2 — SIMPAN TRANSAKSI
        // ====================================================

        if (
          !data ||
          !data.sku ||
          !data.tipe
        ) {

          return json({
            success: false,
            message:
              "Data transaksi tidak lengkap"
          }, 400);

        }


        const sku =
          String(data.sku).trim();

        const tipe =
          String(data.tipe).trim();

        const nama =
          String(data.nama || "").trim();

        const satuan =
          String(data.satuan || "").trim();

        const petugas =
          String(data.petugas || "Unknown").trim();

        const keterangan =
          String(data.keterangan || "").trim();

        const qty =
          Number(data.qty);


        if (
          !sku ||
          !tipe ||
          !Number.isFinite(qty) ||
          qty <= 0
        ) {

          return json({
            success: false,
            message:
              "SKU, tipe, dan jumlah transaksi tidak valid"
          }, 400);

        }


        // ----------------------------------------------------
        // AMBIL BAHAN
        // ----------------------------------------------------

        const bahan =
          await env.DB.prepare(`
            SELECT
              sku,
              nama,
              stok,
              satuan,
              expired
            FROM bahan
            WHERE sku = ?
          `)
          .bind(sku)
          .first();


        if (!bahan) {

          return json({
            success: false,
            message:
              "SKU tidak ditemukan!"
          }, 404);

        }


        const stokLama =
          Number(bahan.stok) || 0;


        let stokBaru;


        // ----------------------------------------------------
        // MASUK
        // ----------------------------------------------------

        if (tipe === "Masuk") {

          stokBaru =
            stokLama + qty;

        }


        // ----------------------------------------------------
        // KELUAR / RUSAK
        // ----------------------------------------------------

        else if (
          tipe === "Keluar" ||
          tipe === "Rusak-Expired"
        ) {

          if (
            qty > stokLama &&
            !data.forceNegative
          ) {

            return json({
              success: false,
              message:
                `Stok gak cukup! Sisa cuma ` +
                `${stokLama} ${bahan.satuan}.`,
              stokTersedia:
                stokLama
            }, 400);

          }


          stokBaru =
            Math.max(
              0,
              stokLama - qty
            );

        }


        else {

          return json({
            success: false,
            message:
              `Tipe transaksi "${tipe}" tidak dikenal`
          }, 400);

        }


        // ----------------------------------------------------
        // EXPIRED — HANYA MASUK
        // ----------------------------------------------------

        const expired =
          data.exp && tipe === "Masuk"
            ? String(data.exp).trim()
            : null;


        // ----------------------------------------------------
        // ID TRANSAKSI
        // ----------------------------------------------------

        const newId =
          crypto.randomUUID();

        const timestamp =
          new Date().toISOString();


        // ----------------------------------------------------
        // UPDATE + INSERT ATOMIC
        // ----------------------------------------------------

        const statements = [];


        statements.push(
          env.DB.prepare(`
            UPDATE bahan
            SET
              stok = ?
              ${expired ? ", expired = ?" : ""}
            WHERE sku = ?
          `)
          .bind(
            ...(expired
              ? [
                  stokBaru,
                  expired,
                  sku
                ]
              : [
                  stokBaru,
                  sku
                ])
          )
        );


        statements.push(
          env.DB.prepare(`
            INSERT INTO transaksi (
              id_transaksi,
              timestamp,
              tipe,
              sku,
              nama,
              qty,
              satuan,
              stok_lama,
              stok_akhir,
              keterangan,
              petugas
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            newId,
            timestamp,
            tipe,
            sku,
            nama || bahan.nama,
            qty,
            satuan || bahan.satuan,
            stokLama,
            stokBaru,
            keterangan,
            petugas
          )
        );


        await env.DB.batch(statements);


        return json({
          success: true,
          message:
            `${tipe} berhasil! ` +
            `${nama || bahan.nama}: ` +
            `${stokLama} → ${stokBaru} ` +
            `${satuan || bahan.satuan}`,
          stokLama,
          stokBaru,
          idTransaksi: newId
        });

      }


      // ======================================================
      // ROUTE LAMA → GAS
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

      if (request.method === "GET") {

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
              request.method === "POST" ||
              request.method === "PUT" ||
              request.method === "DELETE"
                ? await request.text()
                : null
          }
        );


      // ======================================================
      // RESPONSE GAS
      // ======================================================

      const response =
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

      console.error(
        "Worker Error:",
        err
      );


      return json({
        success: false,
        error:
          err.message
      }, 500);

    }

  },


  // ==========================================================
  // CRON WARM-UP
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


// ==========================================================
// HELPER — JSON RESPONSE
// ==========================================================

function json(
  data,
  status = 200
) {

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
        "Access-Control-Allow-Origin":
          "*"
      }
    }
  );

}