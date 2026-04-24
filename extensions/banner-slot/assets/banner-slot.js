(function () {
  function loadBanners() {
    document.querySelectorAll(".retailiq-banner-slot").forEach(function (el) {
      if (el.dataset.loaded) return;
      el.dataset.loaded = "true";

      var slotId = el.dataset.slotId;
      var shop   = el.dataset.shop;
      var appUrl = el.dataset.appUrl;

      if (!slotId || !shop || !appUrl) return;

      fetch(
        appUrl +
          "/api/banner?shop=" +
          encodeURIComponent(shop) +
          "&slotId=" +
          encodeURIComponent(slotId)
      )
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.gamAdUnitCode && data.gamNetworkCode) {
            // ── GPT path ──────────────────────────────────────────────
            var w = data.width  || 300;
            var h = data.height || 250;

            // Create GPT container
            var divId = "retailiq-gpt-" + slotId;
            var div   = document.createElement("div");
            div.id    = divId;
            div.style.width  = w + "px";
            div.style.height = h + "px";
            el.appendChild(div);

            // Load GPT script once
            if (!window.__retailiq_gpt_loaded) {
              window.__retailiq_gpt_loaded = true;
              var script  = document.createElement("script");
              script.async = true;
              script.src   = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
              document.head.appendChild(script);
            }

            window.googletag = window.googletag || { cmd: [] };
            window.googletag.cmd.push(function () {
              window.googletag
                .defineSlot(
                  "/" + data.gamNetworkCode + "/" + data.gamAdUnitCode,
                  [w, h],
                  divId
                )
                .addService(window.googletag.pubads());
              window.googletag.pubads().enableSingleRequest();
              window.googletag.enableServices();
              window.googletag.display(divId);
            });

          } else if (data.bannerUrl) {
            // ── Fallback: image path ──────────────────────────────────
            var a      = document.createElement("a");
            a.href     = data.productUrl || "#";
            a.style.display = "inline-block";
            var img    = document.createElement("img");
            img.src    = data.bannerUrl;
            img.alt    = data.productTitle || "Special offer";
            img.style.maxWidth    = "100%";
            img.style.display     = "block";
            img.style.borderRadius = "4px";
            a.appendChild(img);
            el.appendChild(a);
          }
        })
        .catch(function (e) { console.warn("RetailIQ banner error:", e); });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadBanners);
  } else {
    loadBanners();
  }
})();