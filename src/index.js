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
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });

    }

    try {

      // ======================================================
      // D1 TEST
      // Endpoint:
      // /api/db-test
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
            database: "roti-boss-gudang",
            tables: result.results.map(row => row.name)
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


      // ==========================================================
      // D1 — BAHAN
      // GET    /api/bahan
      // POST   /api/bahan
      // PUT    /api/bahan
      // DELETE /api/bahan
      // ==========================================================

      if (url.pathname === "/api/bahan") {

        // --------------------------------------------------------
        // GET — ambil semua bahan
        // --------------------------------------------------------

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

          const data =
            await request.json();

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

          const petugas =
            String(data.petugas || "").trim();


          // ------------------------------------------------------
          // INSERT BAHAN
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


          // ------------------------------------------------------
          // CATAT STOK AWAL SEBAGAI TRANSAKSI MASUK
          // ------------------------------------------------------

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
                expired,
                petugas
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
        // PUT — update bahan
        // --------------------------------------------------------

        if (request.method === "PUT") {

          const data =
            await request.json();

          if (!data || !data.sku) {

            return new Response(
              JSON.stringify({
                success: false,
                message: "SKU wajib diisi"
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

            return new Response(
              JSON.stringify({
                success: false,
                message: "SKU tidak ditemukan"
              }),
              {
                status: 404,
                headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*"
                }
              }
            );

          }


          return new Response(
            JSON.stringify({
              success: true,
              message: "Bahan berhasil diupdate"
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
        // DELETE — hapus bahan
        // --------------------------------------------------------

        if (request.method === "DELETE") {

          const data =
            await request.json();

          if (!data || !data.sku) {

            return new Response(
              JSON.stringify({
                success: false,
                message: "SKU wajib diisi"
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


          const result =
            await env.DB.prepare(`
              DELETE FROM bahan
              WHERE sku = ?
            `)
            .bind(sku)
            .run();


          if (result.meta.changes === 0) {

            return new Response(
              JSON.stringify({
                success: false,
                message: "SKU tidak ditemukan"
              }),
              {
                status: 404,
                headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*"
                }
              }
            );

          }


          return new Response(
            JSON.stringify({
              success: true,
              message: "Bahan berhasil dihapus"
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


      // ==========================================================
      // D1 — RESEP
      // GET    /api/resep
      // POST   /api/resep
      // PUT    /api/resep
      // DELETE /api/resep
      // ==========================================================

      if (url.pathname === "/api/resep") {

        // --------------------------------------------------------
        // GET — ambil semua resep
        // --------------------------------------------------------

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
        // POST — tambah resep
        // --------------------------------------------------------

        if (request.method === "POST") {

          const data =
            await request.json();


          if (
            !data ||
            !data.produk ||
            !data.sku ||
            data.qtyPerBatch === undefined
          ) {

            return new Response(
              JSON.stringify({
                success: false,
                message:
                  "Produk, SKU, dan qtyPerBatch wajib diisi"
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

            return new Response(
              JSON.stringify({
                success: false,
                message:
                  "Data resep tidak valid"
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


          // ------------------------------------------------------
          // Pastikan SKU bahan memang ada
          // ------------------------------------------------------

          const bahan =
            await env.DB.prepare(`
              SELECT sku
              FROM bahan
              WHERE sku = ?
            `)
            .bind(sku)
            .first();


          if (!bahan) {

            return new Response(
              JSON.stringify({
                success: false,
                message:
                  "SKU bahan tidak ditemukan"
              }),
              {
                status: 404,
                headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*"
                }
              }
            );

          }


          // ------------------------------------------------------
          // INSERT
          // ------------------------------------------------------

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


          return new Response(
            JSON.stringify({
              success: true,
              message:
                "Resep berhasil ditambahkan",
              data: {
                produk,
                sku,
                qtyPerBatch
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
        // PUT — update qty resep
        // --------------------------------------------------------

        if (request.method === "PUT") {

          const data =
            await request.json();

          if (
            !data ||
            !data.produk ||
            !data.sku ||
            data.qtyPerBatch === undefined
          ) {

            return new Response(
              JSON.stringify({
                success: false,
                message:
                  "Produk, SKU, dan qtyPerBatch wajib diisi"
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

            return new Response(
              JSON.stringify({
                success: false,
                message:
                  "qtyPerBatch harus lebih dari 0"
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

            return new Response(
              JSON.stringify({
                success: false,
                message:
                  "Item resep tidak ditemukan"
              }),
              {
                status: 404,
                headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*"
                }
              }
            );

          }


          return new Response(
            JSON.stringify({
              success: true,
              message:
                "Resep berhasil diupdate",
              data: {
                produk,
                sku,
                qtyPerBatch
              }
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
        // DELETE — hapus item resep
        // --------------------------------------------------------

        if (request.method === "DELETE") {

          const data =
            await request.json();

          if (
            !data ||
            !data.produk ||
            !data.sku
          ) {

            return new Response(
              JSON.stringify({
                success: false,
                message:
                  "Produk dan SKU wajib diisi"
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

            return new Response(
              JSON.stringify({
                success: false,
                message:
                  "Item resep tidak ditemukan"
              }),
              {
                status: 404,
                headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*"
                }
              }
            );

          }


          return new Response(
            JSON.stringify({
              success: true,
              message:
                "Resep berhasil dihapus"
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
        // METHOD TIDAK DIDUKUNG
        // --------------------------------------------------------

        return new Response(
          JSON.stringify({
            success: false,
            message:
              "Method tidak didukung"
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

      // ==========================================================
      // D1 — PRODUKSI
      // POST /api/produksi
      //
      // Produksi:
      // 1. Baca resep
      // 2. Cek semua stok bahan
      // 3. Kalau cukup → potong stok
      // 4. Catat transaksi Keluar
      // 5. Kalau ada bahan kurang → tidak ada stok yang dipotong
      // ==========================================================

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

          return new Response(
            JSON.stringify({
              success: false,
              message:
                "Produk, jumlah batch, dan petugas wajib diisi"
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

          return new Response(
            JSON.stringify({
              success: false,
              message: "Jumlah batch tidak valid"
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


        // --------------------------------------------------------
        // AMBIL RESEP + DATA BAHAN
        // --------------------------------------------------------

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

          return new Response(
            JSON.stringify({
              success: false,
              message:
                `Resep "${produk}" belum tersedia`
            }),
            {
              status: 404,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              }
            }
          );

        }


        // --------------------------------------------------------
        // HITUNG KEBUTUHAN + CEK STOK
        // --------------------------------------------------------

        const kebutuhan = [];

        for (const item of resep.results) {

          const qty =
            Number(item.qty_per_batch) *
            jumlahBatch;

          const stok =
            Number(item.stok) || 0;

          if (stok < qty) {

            return new Response(
              JSON.stringify({
                success: false,
                message:
                  `Stok ${item.nama} tidak cukup. ` +
                  `Butuh ${qty} ${item.satuan}, ` +
                  `tersedia ${stok} ${item.satuan}.`
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

          kebutuhan.push({
            sku: item.sku,
            nama: item.nama,
            qty,
            satuan: item.satuan,
            stokLama: stok,
            stokAkhir: stok - qty
          });

        }


        // --------------------------------------------------------
        // POTONG STOK + CATAT TRANSAKSI
        // --------------------------------------------------------

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


        // --------------------------------------------------------
        // RESPONSE
        // --------------------------------------------------------

        return new Response(
          JSON.stringify({
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

// ==========================================================
// D1 — TRANSAKSI
// GET /api/transaksi
// ==========================================================

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

// ==========================================================
// D1 — TRANSAKSI
// POST /api/transaksi
//
// Batalkan transaksi:
// - Keluar  -> stok dikembalikan
// - Masuk   -> stok dikurangi kembali
// - transaksi diberi tanda [DIBATALKAN]
// ==========================================================

if (
  url.pathname === "/api/transaksi" &&
  request.method === "POST"
) {

  const data = await request.json();

  const idTransaksi =
    String(
      data?.idTransaksi ||
      data?.id_transaksi ||
      ""
    ).trim();

  if (!idTransaksi) {

    return new Response(
      JSON.stringify({
        success: false,
        message: "ID transaksi wajib diisi"
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


  // --------------------------------------------------------
  // AMBIL TRANSAKSI
  // --------------------------------------------------------

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

    return new Response(
      JSON.stringify({
        success: false,
        message: "Transaksi tidak ditemukan"
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );

  }


  // --------------------------------------------------------
  // CEGAH UNDO GANDA
  // --------------------------------------------------------

  if (
    String(transaksi.keterangan || "")
      .includes("[DIBATALKAN]")
  ) {

    return new Response(
      JSON.stringify({
        success: false,
        message: "Transaksi ini sudah dibatalkan"
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


  // --------------------------------------------------------
  // AMBIL STOK TERKINI
  // --------------------------------------------------------

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

    return new Response(
      JSON.stringify({
        success: false,
        message:
          `Bahan ${transaksi.sku} tidak ditemukan`
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );

  }


  const stokSekarang =
    Number(bahan.stok) || 0;

  const qty =
    Number(transaksi.qty) || 0;


  let stokBaru;


  // --------------------------------------------------------
  // HITUNG STOK HASIL PEMBATALAN
  // --------------------------------------------------------

  if (transaksi.tipe === "Keluar") {

    stokBaru =
      stokSekarang + qty;

  } else if (transaksi.tipe === "Masuk") {

    stokBaru =
      stokSekarang - qty;

    if (stokBaru < 0) {

      return new Response(
        JSON.stringify({
          success: false,
          message:
            `Pembatalan ditolak. Stok ${transaksi.nama} ` +
            `sekarang ${stokSekarang} ${bahan.satuan}, ` +
            `tetapi perlu mengurangi ${qty} ${transaksi.satuan}.`
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

  } else {

    return new Response(
      JSON.stringify({
        success: false,
        message:
          `Tipe transaksi "${transaksi.tipe}" belum bisa dibatalkan`
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


  // --------------------------------------------------------
  // UPDATE D1
  // --------------------------------------------------------

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


  // --------------------------------------------------------
  // RESPONSE
  // --------------------------------------------------------

  return new Response(
    JSON.stringify({
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
          error: err.message
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