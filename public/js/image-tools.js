(function () { 'use strict';
var form = document.getElementById('image-tools'), status = document.getElementById('image-tools-status');
fetch('/api/v1/studio/images/tools').then(function (r) { return r.json(); }).then(function (r) { if (!r.available) { status.textContent = 'Image tools are not available on this Studio yet. Your picture is unchanged.'; form.querySelector('button').disabled = true; } });
form.addEventListener('submit', async function (event) { event.preventDefault(); var button = form.querySelector('button'); button.disabled = true; status.textContent = 'Making your edited copy…';
try { var data = Object.fromEntries(new FormData(form)); var res = await fetch('/api/v1/studio/images/edit', { method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data) }); var out = await res.json(); if (!res.ok) throw new Error(out.detail || 'The edit failed.');
if (!out.slug || !/^[2-9a-km-zA-HJ-NP-Z]{8}$/.test(out.slug)) throw new Error('The result could not be opened.'); location.href = 'https://openvibe.pics/i/' + out.slug;
} catch (e) { status.textContent = e.message; } finally { button.disabled = false; } });
})();
