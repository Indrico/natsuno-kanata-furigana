// Run against an isolated Electron test profile, never a personal save profile.
// Node 22+: node furigana-patch/test-runtime.cjs [http://127.0.0.1:9317]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const address = process.argv[2] || 'http://127.0.0.1:9317';
const evidence = path.join(__dirname, 'evidence');

(async () => {
    const targets = await (await fetch(address + '/json/list')).json();
    const target = targets.find(target => target.type === 'page');
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    let nextId = 0;
    const pending = new Map();
    const exceptions = [];
    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
        if (!message.id) return;
        const request = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) request.reject(new Error(JSON.stringify(message.error)));
        else request.resolve(message.result);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
    });
    const run = async (fn, ...args) => {
        const result = await send('Runtime.evaluate', {
            expression: `(${fn})(${args.map(arg => JSON.stringify(arg)).join(',')})`,
            awaitPromise: true, returnByValue: true
        });
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    const wait = async (fn, timeout = 30000) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            if (await run(fn)) return;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('Timed out: ' + fn);
    };
    const screenshot = async name => {
        const result = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(evidence, name), Buffer.from(result.data, 'base64'));
    };
    const results = [];
    try {
        await send('Runtime.enable');
        await run(() => localStorage.removeItem('natsuno-kanata.furigana.enabled'));
        await send('Page.reload');
        await wait(() => typeof globalSystem !== 'undefined' && globalSystem.setupManagersComplete && globalSystem.flowManager.currentFlow instanceof CautionFlow);
        assert.equal(await run(() => Furigana.enabled), false, 'fresh profiles default to OFF');
        await run(() => document.getElementById('caution').click());
        await wait(() => globalSystem.flowManager.currentFlow instanceof TitleFlow && globalSystem.gameManager.isBooted);
        await run(() => document.getElementById('optionOpen').click());
        await wait(() => globalSystem.uiManager.option.windowAnim === null);
        await run(() => document.getElementById('furiganaToggle').click());
        await wait(() => !!Furigana.tokenizer && !Furigana.loading);
        await wait(() => document.querySelectorAll('ruby.furigana').length > 0);
        assert.equal(await run(() => document.getElementById('furiganaToggle').getAttribute('aria-pressed')), 'true');
        await screenshot('options-on.png');
        results.push('Settings toggle loads the bundled dictionary through file:// inside app.asar.');

        const rendering = await run(() => {
            var host = document.createElement('div');
            host.innerHTML = Furigana.html('日本語を食べる。<button>水を飲む</button> &amp; かな 😀<br><span style="color: red">学校</span>');
            var before = host.innerHTML;
            Furigana.annotate(host);
            return {
                plain: Furigana.plainText(host),
                nested: host.querySelectorAll('ruby ruby').length,
                stable: before === host.innerHTML,
                reading: host.querySelector('ruby rt').textContent,
                button: Furigana.plainText(host.querySelector('button')),
                okurigana: host.innerHTML.includes('食<rt>た</rt></ruby>べる'),
                kana: Furigana.html('ひらがな カタカナ 123 ABC &amp; 😀'),
                unknown: Furigana.html('𠮷'),
                existing: Furigana.html('<ruby>漢字<rt>かんじ</rt></ruby>')
            };
        });
        assert.equal(rendering.plain, '日本語を食べる。水を飲む & かな 😀学校');
        assert.equal(rendering.nested, 0);
        assert.equal(rendering.stable, true);
        assert.equal(rendering.reading, 'にほんご');
        assert.equal(rendering.button, '水を飲む');
        assert.equal(rendering.okurigana, true);
        assert.equal(rendering.kana, 'ひらがな カタカナ 123 ABC &amp; 😀');
        assert.equal(rendering.unknown, '𠮷');
        assert.equal(rendering.existing, '<ruby>漢字<rt>かんじ</rt></ruby>');
        results.push('Readings, okurigana, HTML, whitespace, emoji, unknown kanji and existing ruby survive without duplicate annotation.');

        const animation = await run(() => {
            var line = globalSystem.uiManager.textLine[0];
            line.setupElement('logue');
            line.reset();
            line.writeLine('学校で<blue>日本語</blue>を読む。<button>水</button> &amp; 😀', '旅人');
            line.updateWrite();
            var box = line.animationBox[0];
            Furigana.toggle();
            line.updateText(box);
            Furigana.toggle();
            var steps = 0;
            while (box.hide.childNodes.length && steps++ < 1000) line.updateText(box);
            var button = box.text.querySelector('button');
            var stopped = false;
            line.onClickButton({ stopPropagation: () => { stopped = true; } }, button);
            var primary = globalSystem.uiManager.textInput[0].textBox.value;
            line.onContextMenuButton(null, button);
            return {
                remaining: box.hide.innerHTML,
                plain: Furigana.plainText(box.text),
                nestedRuby: box.text.querySelectorAll('ruby ruby').length,
                color: !!box.text.querySelector('span[style] ruby rt'),
                readingCount: box.text.querySelectorAll('ruby rt').length,
                primary: primary,
                secondary: globalSystem.uiManager.textInput[1].textBox.value,
                stopped: stopped
            };
        });
        assert.equal(animation.remaining, '');
        assert.equal(animation.plain, '旅人　学校で日本語を読む。水 & 😀');
        assert.equal(animation.nestedRuby, 0);
        assert.equal(animation.color, true);
        assert(animation.readingCount > 0);
        assert.equal(animation.primary, '水');
        assert.equal(animation.secondary, '水');
        assert.equal(animation.stopped, true);
        results.push('Real TextLine animation completes nested markup; left/right command clicks submit only the original text.');

        await run(() => document.getElementById('furiganaToggle').click());
        assert.equal(await run(() => getComputedStyle(document.querySelector('ruby.furigana rt')).display), 'none');
        assert.equal(await run(() => localStorage.getItem(Furigana.storageKey)), 'false');
        await screenshot('options-off.png');
        const midAnimation = await run(() => {
            var line = globalSystem.uiManager.textLine[0];
            line.reset();
            line.writeLine('学校へ行く。😀');
            line.updateWrite();
            var box = line.animationBox[0];
            line.updateText(box);
            var before = box.text.querySelectorAll('ruby').length;
            Furigana.toggle();
            line.skipTextAnimation();
            return { before: before, plain: Furigana.plainText(box.text), remaining: box.hide.innerHTML };
        });
        assert.equal(midAnimation.before, 0);
        assert.equal(midAnimation.plain, '学校へ行く。😀');
        assert.equal(midAnimation.remaining, '');
        await wait(() => !!document.querySelector('#logueTextArea0 ruby.furigana rt'));
        assert.equal(await run(() => document.querySelector('#logueTextArea0 ruby.furigana rt').textContent), 'がっこう', 'mid-animation toggles retain whole-word reading context');
        assert.notEqual(await run(() => getComputedStyle(document.querySelector('ruby.furigana rt')).display), 'none');
        results.push('OFF hides readings immediately; ON restores them and also works when switched during active typing.');

        await send('Page.reload');
        await wait(() => typeof Furigana !== 'undefined' && Furigana.enabled && !!Furigana.tokenizer);
        assert.equal(await run(() => localStorage.getItem(Furigana.storageKey)), 'true');
        await wait(() => globalSystem.setupManagersComplete && globalSystem.flowManager.currentFlow instanceof CautionFlow);
        await run(() => document.getElementById('caution').click());
        await wait(() => globalSystem.flowManager.currentFlow instanceof TitleFlow && globalSystem.gameManager.isBooted);
        await run(() => {
            GameModeSetting.setMode(GameModeSetting.mode.normal);
            document.getElementById('titleStart').click();
        });
        await wait(() => globalSystem.flowManager.currentFlow instanceof QuestFlow || globalSystem.flowManager.currentFlow instanceof LogueFlow);
        await wait(() => {
            var line = globalSystem.uiManager.textLine[0];
            if (line.textarea && line.textarea.querySelector('ruby.furigana rt'))
            {
                if (line.animationBox.length) line.skipTextAnimation();
                return true;
            }
            if (line.animationBox.length) line.notifyNext();
            return false;
        });
        await screenshot('story-on.png');
        results.push('ON persists after reload and readings appear in the actual opening story.');
        assert.equal(exceptions.length, 0, 'no uncaught renderer exceptions');
        fs.writeFileSync(path.join(evidence, 'runtime-verification.json'), JSON.stringify({
            runtime: await run(() => navigator.userAgent),
            archive: target.url,
            passed: results,
            rendererExceptions: exceptions
        }, null, 2) + '\n');
        console.log(results.map(result => 'PASS: ' + result).join('\n'));
    } finally {
        socket.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
