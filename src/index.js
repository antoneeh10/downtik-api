export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // 1. handle preflight request browser
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 2. ambil url target yang mau di-relay dari query param
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url"); // contoh: ?url=https://api.tikwm.com/api/

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "p, isi param ?url= dulu bre 😭" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    try {
      // 3. buat request baru buat ditembak ke target (nge-relay)
      // kita kloning request asli tapi ganti url-nya ke targetUrl
      const newRequest = new Request(targetUrl, {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers),
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          // lu bisa override header lain di sini kalau perlu
        },
        body: request.method !== "GET" && request.method !== "HEAD" ? await request.text() : undefined,
        redirect: "follow"
      });

      // 4. tembak ke server target!
      const response = await fetch(newRequest);

      // 5. ambil hasilnya, balikin ke frontend bareng header cors
      const responseBody = await response.text();
      
      return new Response(responseBody, {
        status: response.status,
        headers: {
          ...Object.fromEntries(response.headers),
          ...corsHeaders, // timpah header cors bawaan target pake punya kita biar aman
          "X-Proxied-By": "Cloudflare-Worker-Relay"
        }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: "relay rontok cok", msg: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  }
};
