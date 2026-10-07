// Draws the sidebar from window.MD2HTML_PAGES ([outPath, title] pairs, already sorted by the generator).
// The page's own <nav> holds a link to index.html, so the page stays navigable without JavaScript.
(function () {
  var script = document.currentScript;
  var nav = document.getElementById('md2html-nav');
  var pages = window.MD2HTML_PAGES;
  if (!script || !nav || !pages) return;
  var root = script.getAttribute('data-root') || '';
  var current = script.getAttribute('data-current') || '';

  var tree = { files: [], dirs: new Map() };
  pages.forEach(function (page) {
    var parts = page[0].split('/');
    var node = tree;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!node.dirs.has(parts[i])) node.dirs.set(parts[i], { files: [], dirs: new Map() });
      node = node.dirs.get(parts[i]);
    }
    node.files.push(page);
  });

  function el(tag, text) {
    var e = document.createElement(tag);
    if (text) e.textContent = text;
    return e;
  }

  function list(node, prefix) {
    var ul = el('ul');
    node.files.forEach(function (page) {
      var a = el('a', page[1]);
      a.href = root + page[0];
      if (page[0] === current) a.setAttribute('aria-current', 'page');
      ul.appendChild(el('li')).appendChild(a);
    });
    node.dirs.forEach(function (child, name) {
      var path = prefix + name + '/';
      var details = el('details');
      details.open = current.indexOf(path) === 0;
      details.appendChild(el('summary', name));
      details.appendChild(list(child, path));
      ul.appendChild(el('li')).appendChild(details);
    });
    return ul;
  }

  nav.replaceChildren(list(tree, ''));
})();
