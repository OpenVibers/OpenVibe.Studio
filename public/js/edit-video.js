/* The Studio side of "Publish on Video": the person's edit goes to OpenVibe.Video, which makes
 * the copy (the original is unchanged). The frame is plain: status beside the button. */
(function () {
    'use strict';
    var form = document.querySelector('form[data-studio-publish]');
    if (!form) return;
    var status = form.querySelector('[data-role="status"]');
    var button = form.querySelector('button[type="submit"]');
    function say(text) { if (status) status.textContent = text; }
    form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!button || button.disabled) return;
        button.disabled = true;
        say('Publishing to OpenVibe.Video…');
        fetch('/api/v1/studio/publish', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                media: form.getAttribute('data-media'),
                title: form.elements.title ? form.elements.title.value : '',
                visibility: form.elements.visibility ? form.elements.visibility.value : 'private'
            })
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (!res.ok) throw new Error(data.detail || data.title || 'OpenVibe.Video did not take the copy.');
                say('Published. Your copy is processing on OpenVibe.Video.');
                if (data.video && data.video.watch_url && status) {
                    var link = document.createElement('a');
                    link.href = data.video.watch_url;
                    link.rel = 'noopener';
                    link.textContent = 'Open your copy on Video';
                    status.appendChild(document.createTextNode(' '));
                    status.appendChild(link);
                }
            });
        }).catch(function (err) {
            say(err && err.message ? err.message : 'The copy was not published.');
            button.disabled = false;
        });
    });
})();
