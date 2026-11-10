/* Studio's video tools: trim a range from the player, take a cover frame, and publish a copy on
 * OpenVibe.Video through its cuts service. The page is usable without it (plain form fields), but
 * with it the buttons read the player's current time. */
(function () {
    'use strict';
    var form = document.querySelector('form[data-studio-publish]');
    if (!form) return;
    var video = document.querySelector('[data-studio-video]');
    var status = form.querySelector('[data-role="status"]');
    var timeEl = form.querySelector('[data-role="time"]');
    var rangeEl = form.querySelector('[data-role="range"]');
    var coverEl = form.querySelector('[data-role="cover"]');
    var button = form.querySelector('button[type="submit"]');
    var start = form.elements.start;
    var end = form.elements.end;
    var duration = Number(form.getAttribute('data-duration')) || 0;
    var cover = null;
    var polls = 0;

    function say(text) { if (status) status.textContent = text || ''; }
    function clock(seconds) {
        var n = Math.max(0, Math.round(Number(seconds) || 0));
        return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
    }
    function spoken(seconds) {
        var n = Math.max(0, Math.round(Number(seconds) || 0));
        if (n < 60) return n + ' s';
        return Math.floor(n / 60) + ' min' + (n % 60 ? ' ' + (n % 60) + ' s' : '');
    }
    function here() { return video && Number.isFinite(video.currentTime) ? video.currentTime : 0; }
    function useDuration() {
        if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
        duration = video.duration;
        if (!end.value) end.value = duration.toFixed(2);
        update();
    }
    function update() {
        if (timeEl) timeEl.textContent = clock(here());
        var a = Number(start.value), b = Number(end.value);
        if (rangeEl && Number.isFinite(a) && Number.isFinite(b) && b > a) {
            rangeEl.textContent = 'Keeps ' + clock(a) + ' to ' + clock(b) + ' (' + spoken(b - a) + ')';
        }
    }
    function rangeError() {
        var a = Number(start.value), b = Number(end.value);
        if (!Number.isFinite(a) || !Number.isFinite(b)) return 'Choose a start and an end in seconds.';
        if (a < 0) return 'The start cannot be before the video begins.';
        if (duration > 0 && (a > duration + 0.05 || b > duration + 0.05)) return 'The range has to stay inside the video.';
        if (b <= a) return 'The end has to be after the start.';
        if (b - a < 1) return 'Keep at least one second of the video.';
        return null;
    }
    function readPlayer() {
        if (!video) return;
        update();
    }
    if (video) {
        video.addEventListener('loadedmetadata', useDuration);
        video.addEventListener('timeupdate', readPlayer);
        video.addEventListener('seeked', readPlayer);
    }
    start.addEventListener('input', update);
    end.addEventListener('input', update);
    var setStart = form.querySelector('[data-set-start]');
    var setEnd = form.querySelector('[data-set-end]');
    var setCover = form.querySelector('[data-set-cover]');
    if (setStart) setStart.addEventListener('click', function () { start.value = here().toFixed(2); update(); });
    if (setEnd) setEnd.addEventListener('click', function () { end.value = here().toFixed(2); update(); });
    if (setCover) setCover.addEventListener('click', function () {
        cover = here();
        if (coverEl) coverEl.textContent = 'Cover: ' + clock(cover);
    });

    function poll(id) {
        fetch('/api/v1/studio/publish/' + encodeURIComponent(id), { credentials: 'same-origin' })
            .then(function (res) {
                return res.json().catch(function () { return {}; }).then(function (data) {
                    if (!res.ok) throw new Error(data.detail || data.title || 'The edit could not be read.');
                    var cut = data.cut || {};
                    if (cut.status === 'done') {
                        say('Published. Your copy is ready on OpenVibe.Video.');
                        if (cut.result && cut.result.watch_url && status) {
                            var link = document.createElement('a');
                            link.href = cut.result.watch_url;
                            link.rel = 'noopener';
                            link.textContent = 'Open your copy on Video';
                            status.appendChild(document.createTextNode(' '));
                            status.appendChild(link);
                        }
                        button.disabled = false;
                        return;
                    }
                    if (cut.status === 'failed') {
                        say(cut.error || 'The copy was not made. Try again.');
                        button.disabled = false;
                        return;
                    }
                    polls += 1;
                    if (polls > 300) { say('The copy is taking longer than expected. Open OpenVibe.Video to check it.'); button.disabled = false; return; }
                    var pct = cut.status === 'rendering' ? ' ' + Math.round((Number(cut.progress) || 0) * 100) + '%' : '';
                    say(cut.status === 'rendering' ? 'Making the copy…' + pct : 'Waiting for the cuts service…');
                    window.setTimeout(function () { poll(id); }, 2000);
                });
            }).catch(function (err) {
                say(err && err.message ? err.message : 'The edit could not be read.');
                button.disabled = false;
            });
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!button || button.disabled) return;
        var problem = rangeError();
        if (problem) { say(problem); return; }
        button.disabled = true;
        polls = 0;
        say('Publishing to OpenVibe.Video…');
        var payload = {
            media: form.getAttribute('data-media'),
            start: Number(start.value),
            end: Number(end.value),
            title: form.elements.title ? form.elements.title.value : '',
            visibility: form.elements.visibility ? form.elements.visibility.value : 'private'
        };
        if (cover != null) payload.cover = Number(cover.toFixed(2));
        fetch('/api/v1/studio/publish', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (!res.ok) throw new Error(data.detail || data.title || 'OpenVibe.Video did not take the trim.');
                var cut = data.cut || {};
                if (!cut.id) throw new Error('OpenVibe.Video did not start the trim.');
                if (cut.status === 'done' && cut.result) { say('Published.'); button.disabled = false; return; }
                say('Waiting for the cuts service…');
                window.setTimeout(function () { poll(cut.id); }, 1000);
            });
        }).catch(function (err) {
            say(err && err.message ? err.message : 'The trim was not published.');
            button.disabled = false;
        });
    });

    useDuration();
    update();
})();
