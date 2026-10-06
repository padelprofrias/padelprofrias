function renderHubNav(active) {
  const el = document.getElementById("hub-nav");
  if (!el) return;
  const links = [
    ["index.html", "Inicio"],
    ["ligas.html", "Ligas"],
    ["torneos.html", "Torneos"],
    ["vivo.html", "En Vivo"]
  ];
  el.innerHTML =
    '<div class="hub-brand"><span>PADEL</span>HUB</div>' +
    '<nav class="hub-links">' +
    links.map(function (l) {
      const cls = (active === l[0] ? "active" : "") + (l[0] === "vivo.html" ? " cta" : "");
      return '<a class="' + cls.trim() + '" href="' + l[0] + '">' + l[1] + "</a>";
    }).join("") +
    "</nav>";
}
